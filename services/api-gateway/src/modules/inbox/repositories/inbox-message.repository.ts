import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThan, MoreThan } from 'typeorm';
import { InboxMessage, MessageMetadata } from '../entities/inbox-message.entity';
import { InboxChannel, MessageDirection, MessageDeliveryStatus } from '../entities/inbox.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface FindMessagesOptions {
  page?: number;
  limit?: number;
  before?: Date;
  after?: Date;
}

@Injectable()
export class InboxMessageRepository {
  constructor(
    @InjectRepository(InboxMessage)
    private readonly repo: Repository<InboxMessage>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxMessageRepository');
  }

  /**
   * Create a new message
   */
  async create(data: Partial<InboxMessage>): Promise<InboxMessage> {
    const startTime = this.logger.logOperationStart('create message');
    const message = this.repo.create(data);
    const result = await this.repo.save(message);
    this.logger.logDbQuery('insert message', 1, { messageId: result.id });
    this.logger.logOperationEnd('create message', startTime);
    return result;
  }

  /**
   * Find message by ID
   */
  async findById(tenantId: string, id: string): Promise<InboxMessage | null> {
    const startTime = this.logger.logOperationStart('find message by id', { messageId: id });
    const result = await this.repo.findOne({
      where: { tenantId, id },
    });
    this.logger.logDbQuery('select message', result ? 1 : 0);
    this.logger.logOperationEnd('find message by id', startTime);
    return result;
  }

  /**
   * Find messages by thread
   */
  async findByThread(
    tenantId: string,
    threadId: string,
    options: FindMessagesOptions = {},
  ): Promise<{ items: InboxMessage[]; total: number }> {
    const startTime = this.logger.logOperationStart('find messages by thread', { threadId });
    const { page = 1, limit = 50, before, after } = options;

    const where: FindOptionsWhere<InboxMessage> = { tenantId, threadId };
    if (before) where.createdAt = LessThan(before);
    if (after) where.createdAt = MoreThan(after);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('select messages', items.length, { total });
    this.logger.logOperationEnd('find messages by thread', startTime);
    return { items, total };
  }

  /**
   * Find messages by contact
   */
  async findByContact(
    tenantId: string,
    contactId: string,
    options: FindMessagesOptions = {},
  ): Promise<{ items: InboxMessage[]; total: number }> {
    const startTime = this.logger.logOperationStart('find messages by contact', { contactId });
    const { page = 1, limit = 50 } = options;

    const [items, total] = await this.repo.findAndCount({
      where: { tenantId, contactId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('select messages', items.length, { total });
    this.logger.logOperationEnd('find messages by contact', startTime);
    return { items, total };
  }

  /**
   * Find message by external ID
   */
  async findByExternalId(
    tenantId: string,
    externalMessageId: string,
  ): Promise<InboxMessage | null> {
    const startTime = this.logger.logOperationStart('find message by external id');

    // Use JSON query for metadata.externalMessageId
    const result = await this.repo
      .createQueryBuilder('message')
      .where('message.tenant_id = :tenantId', { tenantId })
      .andWhere("message.metadata->>'externalMessageId' = :externalMessageId", { externalMessageId })
      .getOne();

    this.logger.logDbQuery('select message by external id', result ? 1 : 0);
    this.logger.logOperationEnd('find message by external id', startTime);
    return result;
  }

  /**
   * Update message
   */
  async update(
    tenantId: string,
    id: string,
    data: Partial<InboxMessage>,
  ): Promise<InboxMessage | null> {
    const startTime = this.logger.logOperationStart('update message', { messageId: id });
    await this.repo.update({ tenantId, id }, data);
    const result = await this.findById(tenantId, id);
    this.logger.logDbQuery('update message', result ? 1 : 0);
    this.logger.logOperationEnd('update message', startTime);
    return result;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    tenantId: string,
    id: string,
    status: MessageDeliveryStatus,
    timestamp?: Date,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('update delivery status', { messageId: id, status });
    const updates: Partial<InboxMessage> = { deliveryStatus: status };

    switch (status) {
      case MessageDeliveryStatus.SENT:
        updates.sentAt = timestamp || new Date();
        break;
      case MessageDeliveryStatus.DELIVERED:
        updates.deliveredAt = timestamp || new Date();
        break;
      case MessageDeliveryStatus.READ:
        updates.readAt = timestamp || new Date();
        break;
      case MessageDeliveryStatus.FAILED:
        updates.failedAt = timestamp || new Date();
        break;
    }

    await this.repo.update({ tenantId, id }, updates);
    this.logger.logDbQuery('update delivery status', 1);
    this.logger.logOperationEnd('update delivery status', startTime);
  }

  /**
   * Mark messages as read
   */
  async markAsRead(tenantId: string, threadId: string): Promise<number> {
    const startTime = this.logger.logOperationStart('mark messages as read', { threadId });
    const result = await this.repo.update(
      {
        tenantId,
        threadId,
        direction: MessageDirection.INBOUND,
        readAt: undefined,
      },
      { readAt: new Date() },
    );
    const affected = result.affected || 0;
    this.logger.logDbQuery('mark messages as read', affected);
    this.logger.logOperationEnd('mark messages as read', startTime);
    return affected;
  }

  /**
   * Count unread messages in thread
   */
  async countUnread(tenantId: string, threadId: string): Promise<number> {
    return this.repo.count({
      where: {
        tenantId,
        threadId,
        direction: MessageDirection.INBOUND,
        readAt: undefined,
      },
    });
  }

  /**
   * Get last message in thread
   */
  async getLastMessage(tenantId: string, threadId: string): Promise<InboxMessage | null> {
    return this.repo.findOne({
      where: { tenantId, threadId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Count total messages
   */
  async countByTenant(tenantId: string): Promise<number> {
    return this.repo.count({ where: { tenantId } });
  }

  /**
   * Count unread messages for tenant
   */
  async countUnreadByTenant(tenantId: string): Promise<number> {
    return this.repo.count({
      where: {
        tenantId,
        direction: MessageDirection.INBOUND,
        readAt: undefined,
      },
    });
  }
}
