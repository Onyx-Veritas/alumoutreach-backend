import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InboxThreadRepository } from '../repositories/inbox-thread.repository';
import { InboxMessageRepository } from '../repositories/inbox-message.repository';
import { InboxActivityRepository } from '../repositories/inbox-activity.repository';
import { InboxMessage, MessageMetadata } from '../entities/inbox-message.entity';
import { InboxChannel, MessageDirection, MessageDeliveryStatus, ActivityType } from '../entities/inbox.enums';
import {
  SendMessageDto,
  AddNoteDto,
  ListMessagesQueryDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from '../dto/inbox.dto';
import { InboxMapper } from '../mappers/inbox.mapper';
import { InboxValidators } from '../validators/inbox.validators';
import { InboxEventFactory, INBOX_EVENTS } from '../events/inbox.events';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { InboxService } from './inbox.service';

@Injectable()
export class InboxMessageService {
  private readonly mapper: InboxMapper;
  private readonly validators: InboxValidators;

  constructor(
    private readonly threadRepo: InboxThreadRepository,
    private readonly messageRepo: InboxMessageRepository,
    private readonly activityRepo: InboxActivityRepository,
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxMessageService');
    this.mapper = new InboxMapper();
    this.validators = new InboxValidators();
  }

  /**
   * List messages in a thread
   */
  async listMessages(
    tenantId: string,
    threadId: string,
    query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    const startTime = this.logger.logOperationStart('list messages', { threadId });

    // Verify thread exists
    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const { items, total } = await this.messageRepo.findByThread(tenantId, threadId, {
      page: query.page || 1,
      limit: query.limit || 50,
      before: query.before ? new Date(query.before) : undefined,
      after: query.after ? new Date(query.after) : undefined,
    });

    const messages = this.mapper.toMessageResponseDtos(items);
    const page = query.page || 1;
    const limit = query.limit || 50;

    this.logger.logOperationEnd('list messages', startTime, { count: items.length, total });

    return {
      items: messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get message by ID
   */
  async getMessage(tenantId: string, messageId: string): Promise<MessageResponseDto> {
    const message = await this.messageRepo.findById(tenantId, messageId);
    if (!message) {
      throw new NotFoundException(`Message not found: ${messageId}`);
    }
    return this.mapper.toMessageResponseDto(message);
  }

  /**
   * Send outbound message
   */
  async sendMessage(
    tenantId: string,
    threadId: string,
    dto: SendMessageDto,
    userId?: string,
    correlationId?: string,
  ): Promise<MessageResponseDto> {
    const startTime = this.logger.logOperationStart('send message', { threadId });

    // Verify thread exists
    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    // Validate DTO with thread channel
    const channel = thread.channel;
    const validation = this.validators.validateSendMessageDto(dto, channel);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Check if can send message
    const canSend = this.validators.canSendMessage(thread);
    if (!canSend.valid) {
      throw new BadRequestException(canSend.error);
    }

    // Create message
    const metadata: MessageMetadata = {
      subject: dto.subject,
      cc: dto.cc,
      bcc: dto.bcc,
    };

    const message = await this.messageRepo.create({
      tenantId,
      threadId,
      contactId: thread.contactId,
      direction: MessageDirection.OUTBOUND,
      channel,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      templateId: dto.templateId,
      deliveryStatus: MessageDeliveryStatus.PENDING,
      metadata,
      sentBy: userId,
    });

    // Update thread
    await this.inboxService.updateThreadForNewMessage(
      tenantId,
      threadId,
      MessageDirection.OUTBOUND,
      new Date(),
    );

    // Publish event for pipeline to process
    const event = InboxEventFactory.createMessageSentEvent(
      tenantId,
      message.id,
      threadId,
      thread.contactId,
      channel,
      dto.templateId,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.MESSAGE_SENT, event);

    // Also publish to pipeline for delivery
    await this.eventBus.publish(`pipeline.message.send.${channel}`, {
      ...event,
      messageId: message.id,
      threadId,
      contactId: thread.contactId,
      channel,
      content: dto.content,
      templateId: dto.templateId,
      mediaUrl: dto.mediaUrl,
      metadata,
    });

    this.logger.logOperationEnd('send message', startTime, { messageId: message.id });

    return this.mapper.toMessageResponseDto(message);
  }

  /**
   * Add internal note
   */
  async addNote(
    tenantId: string,
    threadId: string,
    dto: AddNoteDto,
    userId?: string,
    correlationId?: string,
  ): Promise<MessageResponseDto> {
    const startTime = this.logger.logOperationStart('add note', { threadId });

    // Verify thread exists
    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    // Create internal message
    const message = await this.messageRepo.create({
      tenantId,
      threadId,
      contactId: thread.contactId,
      direction: MessageDirection.SYSTEM,
      channel: InboxChannel.INTERNAL,
      content: dto.content,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      deliveredAt: new Date(),
      sentBy: userId,
      metadata: {
        messageType: 'note',
      },
    });

    // Record activity
    await this.activityRepo.recordNoteAdded(tenantId, threadId, dto.content, userId);

    this.logger.logOperationEnd('add note', startTime, { messageId: message.id });

    return this.mapper.toMessageResponseDto(message);
  }

  /**
   * Record inbound message
   */
  async recordInboundMessage(
    tenantId: string,
    threadId: string,
    contactId: string,
    channel: InboxChannel,
    content: string,
    metadata?: MessageMetadata,
    correlationId?: string,
  ): Promise<InboxMessage> {
    const startTime = this.logger.logOperationStart('record inbound message', { threadId, channel });

    const message = await this.messageRepo.create({
      tenantId,
      threadId,
      contactId,
      direction: MessageDirection.INBOUND,
      channel,
      content,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      deliveredAt: new Date(),
      metadata: metadata || {},
    });

    // Update thread
    await this.inboxService.updateThreadForNewMessage(
      tenantId,
      threadId,
      MessageDirection.INBOUND,
      new Date(),
    );

    // Publish event
    const event = InboxEventFactory.createMessageReceivedEvent(
      tenantId,
      message.id,
      threadId,
      contactId,
      channel,
      content,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.MESSAGE_RECEIVED, event);

    this.logger.logOperationEnd('record inbound message', startTime, { messageId: message.id });

    return message;
  }

  /**
   * Update message delivery status
   */
  async updateDeliveryStatus(
    tenantId: string,
    messageId: string,
    status: MessageDeliveryStatus,
    timestamp?: Date,
    correlationId?: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('update delivery status', { messageId, status });

    const message = await this.messageRepo.findById(tenantId, messageId);
    if (!message) {
      this.logger.warn('Message not found for delivery status update', { messageId });
      return;
    }

    await this.messageRepo.updateDeliveryStatus(tenantId, messageId, status, timestamp);

    // Publish appropriate event
    const updatedMessage = await this.messageRepo.findById(tenantId, messageId);
    if (updatedMessage) {
      let subject: string;
      switch (status) {
        case MessageDeliveryStatus.DELIVERED:
          subject = INBOX_EVENTS.MESSAGE_DELIVERED;
          break;
        case MessageDeliveryStatus.READ:
          subject = INBOX_EVENTS.MESSAGE_READ;
          break;
        case MessageDeliveryStatus.FAILED:
          subject = INBOX_EVENTS.MESSAGE_FAILED;
          break;
        default:
          subject = INBOX_EVENTS.MESSAGE_SENT;
      }

      const event = InboxEventFactory.createMessageReceivedEvent(
        tenantId,
        updatedMessage.id,
        updatedMessage.threadId,
        updatedMessage.contactId,
        updatedMessage.channel,
        updatedMessage.content || undefined,
        correlationId,
      );
      await this.eventBus.publish(subject, event);
    }

    this.logger.logOperationEnd('update delivery status', startTime);
  }

  /**
   * Check if message is duplicate
   */
  async isDuplicateMessage(tenantId: string, externalMessageId: string): Promise<boolean> {
    const existing = await this.messageRepo.findByExternalId(tenantId, externalMessageId);
    return existing !== null;
  }
}
