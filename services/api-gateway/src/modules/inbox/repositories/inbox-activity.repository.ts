import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { InboxActivity } from '../entities/inbox-activity.entity';
import { ActivityType } from '../entities/inbox.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface FindActivitiesOptions {
  type?: ActivityType;
  page?: number;
  limit?: number;
}

@Injectable()
export class InboxActivityRepository {
  constructor(
    @InjectRepository(InboxActivity)
    private readonly repo: Repository<InboxActivity>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxActivityRepository');
  }

  /**
   * Create a new activity
   */
  async create(data: Partial<InboxActivity>): Promise<InboxActivity> {
    const startTime = this.logger.logOperationStart('create activity');
    const activity = this.repo.create(data);
    const result = await this.repo.save(activity);
    this.logger.logDbQuery('insert activity', 1, { activityId: result.id });
    this.logger.logOperationEnd('create activity', startTime);
    return result;
  }

  /**
   * Find activities by thread
   */
  async findByThread(
    tenantId: string,
    threadId: string,
    options: FindActivitiesOptions = {},
  ): Promise<{ items: InboxActivity[]; total: number }> {
    const startTime = this.logger.logOperationStart('find activities by thread', { threadId });
    const { type, page = 1, limit = 50 } = options;

    const where: FindOptionsWhere<InboxActivity> = { tenantId, threadId };
    if (type) where.type = type;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('select activities', items.length, { total });
    this.logger.logOperationEnd('find activities by thread', startTime);
    return { items, total };
  }

  /**
   * Record assignment activity
   */
  async recordAssignment(
    tenantId: string,
    threadId: string,
    oldAssignedTo: string | null,
    newAssignedTo: string,
    createdBy?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.ASSIGNED,
      oldValue: oldAssignedTo ? { assignedTo: oldAssignedTo } : null,
      newValue: { assignedTo: newAssignedTo },
      description: `Thread assigned to ${newAssignedTo}`,
      createdBy,
    });
  }

  /**
   * Record status change activity
   */
  async recordStatusChange(
    tenantId: string,
    threadId: string,
    oldStatus: string,
    newStatus: string,
    reason?: string,
    createdBy?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.STATUS_CHANGED,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, reason },
      description: `Status changed from ${oldStatus} to ${newStatus}${reason ? `: ${reason}` : ''}`,
      createdBy,
    });
  }

  /**
   * Record tag added activity
   */
  async recordTagAdded(
    tenantId: string,
    threadId: string,
    tag: string,
    createdBy?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.TAG_ADDED,
      oldValue: null,
      newValue: { tag },
      description: `Tag "${tag}" added`,
      createdBy,
    });
  }

  /**
   * Record tag removed activity
   */
  async recordTagRemoved(
    tenantId: string,
    threadId: string,
    tag: string,
    createdBy?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.TAG_REMOVED,
      oldValue: { tag },
      newValue: null,
      description: `Tag "${tag}" removed`,
      createdBy,
    });
  }

  /**
   * Record note added activity
   */
  async recordNoteAdded(
    tenantId: string,
    threadId: string,
    note: string,
    createdBy?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.NOTE_ADDED,
      oldValue: null,
      newValue: { note },
      description: 'Note added',
      createdBy,
    });
  }

  /**
   * Record system event activity
   */
  async recordSystemEvent(
    tenantId: string,
    threadId: string,
    eventType: string,
    eventData: Record<string, unknown>,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.SYSTEM_EVENT,
      oldValue: null,
      newValue: { eventType, ...eventData },
      description: `System event: ${eventType}`,
      createdBy: null,
    });
  }

  /**
   * Record thread created activity
   */
  async recordThreadCreated(
    tenantId: string,
    threadId: string,
    source?: string,
  ): Promise<InboxActivity> {
    return this.create({
      tenantId,
      threadId,
      type: ActivityType.THREAD_CREATED,
      oldValue: null,
      newValue: { source },
      description: source ? `Thread created from ${source}` : 'Thread created',
      createdBy: null,
    });
  }
}
