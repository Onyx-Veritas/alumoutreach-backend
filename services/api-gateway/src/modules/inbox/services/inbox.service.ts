import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InboxThreadRepository, FindThreadsOptions } from '../repositories/inbox-thread.repository';
import { InboxMessageRepository } from '../repositories/inbox-message.repository';
import { InboxActivityRepository } from '../repositories/inbox-activity.repository';
import { InboxThread } from '../entities/inbox-thread.entity';
import { InboxChannel, ThreadStatus, ThreadPriority, MessageDirection } from '../entities/inbox.enums';
import {
  ListThreadsQueryDto,
  AssignThreadDto,
  UpdateThreadStatusDto,
  UpdateThreadPriorityDto,
  ThreadTagsDto,
  ThreadResponseDto,
  ThreadSummaryResponseDto,
  PaginatedThreadsResponseDto,
  InboxStatsDto,
} from '../dto/inbox.dto';
import { InboxMapper } from '../mappers/inbox.mapper';
import { InboxValidators } from '../validators/inbox.validators';
import { InboxEventFactory, INBOX_EVENTS } from '../events/inbox.events';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

@Injectable()
export class InboxService {
  private readonly mapper: InboxMapper;
  private readonly validators: InboxValidators;

  constructor(
    private readonly threadRepo: InboxThreadRepository,
    private readonly messageRepo: InboxMessageRepository,
    private readonly activityRepo: InboxActivityRepository,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxService');
    this.mapper = new InboxMapper();
    this.validators = new InboxValidators();
  }

  /**
   * List threads with filters
   */
  async listThreads(
    tenantId: string,
    query: ListThreadsQueryDto,
  ): Promise<PaginatedThreadsResponseDto> {
    const startTime = this.logger.logOperationStart('list threads');

    const options: FindThreadsOptions = {
      status: query.status,
      channel: query.channel,
      assignedTo: query.assignedTo,
      unassigned: query.unassigned,
      starred: query.starred,
      includeArchived: query.includeArchived,
      page: query.page || 1,
      limit: query.limit || 20,
      sortBy: query.sortBy || 'lastMessageAt',
      sortOrder: query.sortOrder || 'DESC',
    };

    const { items, total } = await this.threadRepo.findMany(tenantId, options);
    const threads = items.map((t) => this.mapper.toThreadSummaryDto(t));

    this.logger.logOperationEnd('list threads', startTime, { count: items.length, total });

    return {
      items: threads,
      total,
      page: options.page!,
      limit: options.limit!,
      totalPages: Math.ceil(total / options.limit!),
    };
  }

  /**
   * Get thread by ID
   */
  async getThread(tenantId: string, threadId: string): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('get thread', { threadId });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    this.logger.logOperationEnd('get thread', startTime);

    return this.mapper.toThreadResponseDto(thread);
  }

  /**
   * Get thread by contact and channel
   */
  async getThreadByContactAndChannel(
    tenantId: string,
    contactId: string,
    channel: InboxChannel,
  ): Promise<InboxThread | null> {
    return this.threadRepo.findByContactAndChannel(tenantId, contactId, channel);
  }

  /**
   * Find or create thread
   */
  async findOrCreateThread(
    tenantId: string,
    contactId: string,
    channel: InboxChannel,
    metadata?: Record<string, unknown>,
    correlationId?: string,
  ): Promise<{ thread: InboxThread; created: boolean }> {
    const startTime = this.logger.logOperationStart('find or create thread', { contactId, channel });

    const result = await this.threadRepo.findOrCreate(tenantId, contactId, channel, metadata);

    if (result.created) {
      // Record activity
      await this.activityRepo.recordThreadCreated(tenantId, result.thread.id, channel);

      // Publish event
      const event = InboxEventFactory.createThreadCreatedEvent(
        tenantId,
        result.thread.id,
        contactId,
        channel,
        correlationId,
      );
      await this.eventBus.publish(INBOX_EVENTS.THREAD_CREATED, event);
    }

    this.logger.logOperationEnd('find or create thread', startTime, { created: result.created });

    return result;
  }

  /**
   * Assign thread to user
   */
  async assignThread(
    tenantId: string,
    threadId: string,
    dto: AssignThreadDto,
    userId?: string,
    correlationId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('assign thread', { threadId, assignedTo: dto.assignedTo });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const validation = this.validators.canAssignThread(thread);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const oldAssignedTo = thread.assignedTo;
    const updated = await this.threadRepo.assignTo(tenantId, threadId, dto.assignedTo);

    // Record activity
    await this.activityRepo.recordAssignment(tenantId, threadId, oldAssignedTo, dto.assignedTo, userId);

    // Publish event
    const event = InboxEventFactory.createThreadAssignedEvent(
      tenantId,
      threadId,
      thread.contactId,
      thread.channel,
      dto.assignedTo,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.THREAD_ASSIGNED, event);

    this.logger.logOperationEnd('assign thread', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Unassign thread
   */
  async unassignThread(
    tenantId: string,
    threadId: string,
    userId?: string,
    correlationId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('unassign thread', { threadId });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const oldAssignedTo = thread.assignedTo;
    await this.threadRepo.unassign(tenantId, threadId);

    // Record activity
    if (oldAssignedTo) {
      await this.activityRepo.recordAssignment(tenantId, threadId, oldAssignedTo, 'unassigned', userId);
    }

    this.logger.logOperationEnd('unassign thread', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Update thread status
   */
  async updateThreadStatus(
    tenantId: string,
    threadId: string,
    dto: UpdateThreadStatusDto,
    userId?: string,
    correlationId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('update thread status', { threadId, status: dto.status });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const validation = this.validators.canChangeStatus(thread, dto.status);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const oldStatus = thread.status;
    await this.threadRepo.updateStatus(tenantId, threadId, dto.status, userId);

    // Record activity
    await this.activityRepo.recordStatusChange(tenantId, threadId, oldStatus, dto.status, dto.reason, userId);

    // Publish event
    const event = InboxEventFactory.createThreadStatusChangedEvent(
      tenantId,
      threadId,
      thread.contactId,
      thread.channel,
      dto.status,
      correlationId,
    );
    await this.eventBus.publish(INBOX_EVENTS.THREAD_STATUS_CHANGED, event);

    this.logger.logOperationEnd('update thread status', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Update thread priority
   */
  async updateThreadPriority(
    tenantId: string,
    threadId: string,
    dto: UpdateThreadPriorityDto,
    userId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('update thread priority', { threadId, priority: dto.priority });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    await this.threadRepo.update(tenantId, threadId, { priority: dto.priority });

    this.logger.logOperationEnd('update thread priority', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Add tags to thread
   */
  async addTags(
    tenantId: string,
    threadId: string,
    dto: ThreadTagsDto,
    userId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('add thread tags', { threadId, tags: dto.tags });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const existingTags = (thread.metadata?.tags as string[]) || [];
    const newTags = [...new Set([...existingTags, ...dto.tags])];

    await this.threadRepo.update(tenantId, threadId, {
      metadata: { ...thread.metadata, tags: newTags },
    });

    // Record activity for each new tag
    for (const tag of dto.tags) {
      if (!existingTags.includes(tag)) {
        await this.activityRepo.recordTagAdded(tenantId, threadId, tag, userId);
      }
    }

    this.logger.logOperationEnd('add thread tags', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Remove tags from thread
   */
  async removeTags(
    tenantId: string,
    threadId: string,
    dto: ThreadTagsDto,
    userId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('remove thread tags', { threadId, tags: dto.tags });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    const existingTags = (thread.metadata?.tags as string[]) || [];
    const newTags = existingTags.filter((t) => !dto.tags.includes(t));

    await this.threadRepo.update(tenantId, threadId, {
      metadata: { ...thread.metadata, tags: newTags },
    });

    // Record activity for each removed tag
    for (const tag of dto.tags) {
      if (existingTags.includes(tag)) {
        await this.activityRepo.recordTagRemoved(tenantId, threadId, tag, userId);
      }
    }

    this.logger.logOperationEnd('remove thread tags', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Star/unstar thread
   */
  async toggleStar(
    tenantId: string,
    threadId: string,
    starred: boolean,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('toggle thread star', { threadId, starred });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    await this.threadRepo.update(tenantId, threadId, { isStarred: starred });

    this.logger.logOperationEnd('toggle thread star', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Archive/unarchive thread
   */
  async toggleArchive(
    tenantId: string,
    threadId: string,
    archived: boolean,
    userId?: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('toggle thread archive', { threadId, archived });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    await this.threadRepo.update(tenantId, threadId, { isArchived: archived });

    // Record activity
    await this.activityRepo.recordSystemEvent(tenantId, threadId, archived ? 'thread_archived' : 'thread_unarchived', {});

    this.logger.logOperationEnd('toggle thread archive', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Mark thread as read
   */
  async markAsRead(
    tenantId: string,
    threadId: string,
  ): Promise<ThreadResponseDto> {
    const startTime = this.logger.logOperationStart('mark thread as read', { threadId });

    const thread = await this.threadRepo.findById(tenantId, threadId);
    if (!thread) {
      throw new NotFoundException(`Thread not found: ${threadId}`);
    }

    // Mark all messages in thread as read
    await this.messageRepo.markAsRead(tenantId, threadId);

    // Reset unread count
    await this.threadRepo.resetUnreadCount(tenantId, threadId);

    this.logger.logOperationEnd('mark thread as read', startTime);

    return this.getThread(tenantId, threadId);
  }

  /**
   * Get inbox stats
   */
  async getStats(tenantId: string): Promise<InboxStatsDto> {
    const startTime = this.logger.logOperationStart('get inbox stats');

    const stats = await this.threadRepo.getStats(tenantId);
    const totalMessages = await this.messageRepo.countByTenant(tenantId);
    const unreadMessages = await this.messageRepo.countUnreadByTenant(tenantId);

    this.logger.logOperationEnd('get inbox stats', startTime);

    return {
      totalThreads: stats.total,
      openThreads: stats.open,
      pendingThreads: stats.pending,
      escalatedThreads: stats.escalated,
      closedThreads: stats.closed,
      unassignedThreads: stats.unassigned,
      totalMessages,
      unreadMessages,
      byChannel: stats.byChannel,
    };
  }

  /**
   * Update thread after new message
   */
  async updateThreadForNewMessage(
    tenantId: string,
    threadId: string,
    direction: MessageDirection,
    timestamp: Date,
  ): Promise<void> {
    await this.threadRepo.updateLastMessageAt(tenantId, threadId, timestamp);
    await this.threadRepo.incrementMessageCount(tenantId, threadId);

    if (direction === MessageDirection.INBOUND) {
      await this.threadRepo.incrementUnreadCount(tenantId, threadId);
    }
  }
}
