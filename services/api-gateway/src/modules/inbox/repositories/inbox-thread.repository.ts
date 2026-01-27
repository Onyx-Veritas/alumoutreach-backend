import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, IsNull, Not, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { InboxThread, ThreadMetadata } from '../entities/inbox-thread.entity';
import { InboxChannel, ThreadStatus, ThreadPriority } from '../entities/inbox.enums';
import { ListThreadsQueryDto } from '../dto/inbox.dto';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface FindThreadsOptions {
  status?: ThreadStatus;
  channel?: InboxChannel;
  assignedTo?: string;
  unassigned?: boolean;
  starred?: boolean;
  includeArchived?: boolean;
  contactId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class InboxThreadRepository {
  constructor(
    @InjectRepository(InboxThread)
    private readonly repo: Repository<InboxThread>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxThreadRepository');
  }

  /**
   * Create a new thread
   */
  async create(data: Partial<InboxThread>): Promise<InboxThread> {
    const startTime = this.logger.logOperationStart('create thread');
    const thread = this.repo.create(data);
    const result = await this.repo.save(thread);
    this.logger.logDbQuery('insert thread', 1, { threadId: result.id });
    this.logger.logOperationEnd('create thread', startTime);
    return result;
  }

  /**
   * Find thread by ID
   */
  async findById(tenantId: string, id: string): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('find thread by id', { threadId: id });
    const result = await this.repo.findOne({
      where: { tenantId, id },
    });
    this.logger.logDbQuery('select thread', result ? 1 : 0);
    this.logger.logOperationEnd('find thread by id', startTime);
    return result;
  }

  /**
   * Find thread by contact and channel
   */
  async findByContactAndChannel(
    tenantId: string,
    contactId: string,
    channel: InboxChannel,
  ): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('find thread by contact and channel');
    const result = await this.repo.findOne({
      where: { tenantId, contactId, channel, isArchived: false },
      order: { createdAt: 'DESC' },
    });
    this.logger.logDbQuery('select thread', result ? 1 : 0);
    this.logger.logOperationEnd('find thread by contact and channel', startTime);
    return result;
  }

  /**
   * Find or create thread
   */
  async findOrCreate(
    tenantId: string,
    contactId: string,
    channel: InboxChannel,
    metadata?: ThreadMetadata,
  ): Promise<{ thread: InboxThread; created: boolean }> {
    const startTime = this.logger.logOperationStart('find or create thread');

    // Try to find existing open thread
    let thread = await this.repo.findOne({
      where: { tenantId, contactId, channel, isArchived: false },
      order: { createdAt: 'DESC' },
    });

    let created = false;
    if (!thread) {
      thread = this.repo.create({
        tenantId,
        contactId,
        channel,
        status: ThreadStatus.OPEN,
        priority: ThreadPriority.NORMAL,
        metadata: metadata || {},
      });
      await this.repo.save(thread);
      created = true;
      this.logger.logDbQuery('insert thread', 1);
    } else {
      this.logger.logDbQuery('select thread', 1);
    }

    this.logger.logOperationEnd('find or create thread', startTime, { created });
    return { thread, created };
  }

  /**
   * Find threads with filters
   */
  async findMany(
    tenantId: string,
    options: FindThreadsOptions,
  ): Promise<{ items: InboxThread[]; total: number }> {
    const startTime = this.logger.logOperationStart('find threads');
    const {
      status,
      channel,
      assignedTo,
      unassigned,
      starred,
      includeArchived,
      contactId,
      page = 1,
      limit = 20,
      sortBy = 'lastMessageAt',
      sortOrder = 'DESC',
    } = options;

    const where: FindOptionsWhere<InboxThread> = { tenantId };

    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (assignedTo) where.assignedTo = assignedTo;
    if (unassigned) where.assignedTo = IsNull();
    if (starred) where.isStarred = true;
    if (!includeArchived) where.isArchived = false;
    if (contactId) where.contactId = contactId;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('select threads', items.length, { total });
    this.logger.logOperationEnd('find threads', startTime);
    return { items, total };
  }

  /**
   * Find unassigned threads
   */
  async findUnassigned(tenantId: string, limit = 100): Promise<InboxThread[]> {
    const startTime = this.logger.logOperationStart('find unassigned threads');
    const items = await this.repo.find({
      where: {
        tenantId,
        assignedTo: IsNull(),
        status: Not(ThreadStatus.CLOSED),
        isArchived: false,
      },
      order: { lastMessageAt: 'DESC' },
      take: limit,
    });
    this.logger.logDbQuery('select unassigned threads', items.length);
    this.logger.logOperationEnd('find unassigned threads', startTime);
    return items;
  }

  /**
   * Update thread
   */
  async update(
    tenantId: string,
    id: string,
    data: Partial<InboxThread>,
  ): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('update thread', { threadId: id });
    await this.repo.update({ tenantId, id }, data);
    const result = await this.findById(tenantId, id);
    this.logger.logDbQuery('update thread', result ? 1 : 0);
    this.logger.logOperationEnd('update thread', startTime);
    return result;
  }

  /**
   * Increment unread count
   */
  async incrementUnreadCount(tenantId: string, id: string): Promise<void> {
    await this.repo.increment({ tenantId, id }, 'unreadCount', 1);
    this.logger.logDbQuery('increment unread count', 1);
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(tenantId: string, id: string): Promise<void> {
    await this.repo.increment({ tenantId, id }, 'messageCount', 1);
    this.logger.logDbQuery('increment message count', 1);
  }

  /**
   * Reset unread count
   */
  async resetUnreadCount(tenantId: string, id: string): Promise<void> {
    await this.repo.update({ tenantId, id }, { unreadCount: 0 });
    this.logger.logDbQuery('reset unread count', 1);
  }

  /**
   * Update last message timestamp
   */
  async updateLastMessageAt(tenantId: string, id: string, timestamp: Date): Promise<void> {
    await this.repo.update({ tenantId, id }, { lastMessageAt: timestamp });
    this.logger.logDbQuery('update last message at', 1);
  }

  /**
   * Assign thread to user
   */
  async assignTo(
    tenantId: string,
    id: string,
    assignedTo: string,
  ): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('assign thread', { threadId: id, assignedTo });
    await this.repo.update(
      { tenantId, id },
      { assignedTo, assignedAt: new Date() },
    );
    const result = await this.findById(tenantId, id);
    this.logger.logDbQuery('assign thread', result ? 1 : 0);
    this.logger.logOperationEnd('assign thread', startTime);
    return result;
  }

  /**
   * Unassign thread
   */
  async unassign(tenantId: string, id: string): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('unassign thread', { threadId: id });
    await this.repo.update(
      { tenantId, id },
      { assignedTo: null, assignedAt: null },
    );
    const result = await this.findById(tenantId, id);
    this.logger.logDbQuery('unassign thread', result ? 1 : 0);
    this.logger.logOperationEnd('unassign thread', startTime);
    return result;
  }

  /**
   * Update thread status
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: ThreadStatus,
    userId?: string,
  ): Promise<InboxThread | null> {
    const startTime = this.logger.logOperationStart('update thread status', { threadId: id, status });
    const updates: Partial<InboxThread> = { status };

    if (status === ThreadStatus.CLOSED) {
      updates.closedAt = new Date();
      updates.closedBy = userId || null;
    } else if (status === ThreadStatus.OPEN) {
      updates.closedAt = null;
      updates.closedBy = null;
    }

    await this.repo.update({ tenantId, id }, updates);
    const result = await this.findById(tenantId, id);
    this.logger.logDbQuery('update thread status', result ? 1 : 0);
    this.logger.logOperationEnd('update thread status', startTime);
    return result;
  }

  /**
   * Get thread stats
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    open: number;
    pending: number;
    escalated: number;
    closed: number;
    unassigned: number;
    byChannel: Record<string, number>;
  }> {
    const startTime = this.logger.logOperationStart('get thread stats');

    const [total, open, pending, escalated, closed, unassigned] = await Promise.all([
      this.repo.count({ where: { tenantId, isArchived: false } }),
      this.repo.count({ where: { tenantId, status: ThreadStatus.OPEN, isArchived: false } }),
      this.repo.count({ where: { tenantId, status: ThreadStatus.PENDING, isArchived: false } }),
      this.repo.count({ where: { tenantId, status: ThreadStatus.ESCALATED, isArchived: false } }),
      this.repo.count({ where: { tenantId, status: ThreadStatus.CLOSED, isArchived: false } }),
      this.repo.count({ where: { tenantId, assignedTo: IsNull(), isArchived: false, status: Not(ThreadStatus.CLOSED) } }),
    ]);

    const channelCounts = await this.repo
      .createQueryBuilder('thread')
      .select('thread.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .where('thread.tenant_id = :tenantId', { tenantId })
      .andWhere('thread.is_archived = false')
      .groupBy('thread.channel')
      .getRawMany();

    const byChannel: Record<string, number> = {};
    for (const row of channelCounts) {
      byChannel[row.channel] = parseInt(row.count, 10);
    }

    this.logger.logOperationEnd('get thread stats', startTime);
    return { total, open, pending, escalated, closed, unassigned, byChannel };
  }

  /**
   * Count threads assigned to user
   */
  async countAssignedTo(tenantId: string, userId: string): Promise<number> {
    return this.repo.count({
      where: {
        tenantId,
        assignedTo: userId,
        status: Not(ThreadStatus.CLOSED),
        isArchived: false,
      },
    });
  }
}
