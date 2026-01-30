import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, In } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { Campaign, CampaignStatus } from '../entities/campaign.entity';
import { CampaignRun, CampaignRunStatus } from '../entities/campaign-run.entity';
import { CampaignMessage, DispatchStatus } from '../entities/campaign-message.entity';
import { CampaignSearchDto, CampaignMessageSearchDto } from '../dto/campaign.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CampaignRepository {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignRun)
    private readonly runRepo: Repository<CampaignRun>,
    @InjectRepository(CampaignMessage)
    private readonly messageRepo: Repository<CampaignMessage>,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignRepository');
  }

  // ============ Campaign CRUD ============

  async create(campaign: Campaign): Promise<Campaign> {
    const startTime = this.logger.logOperationStart('create campaign', {
      tenantId: campaign.tenantId,
      name: campaign.name,
    });

    try {
      const saved = await this.campaignRepo.save(campaign);
      this.logger.logDbQuery('INSERT campaigns', 1, { campaignId: saved.id });
      this.logger.logOperationEnd('create campaign', startTime, { campaignId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create campaign', error as Error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Campaign | null> {
    const startTime = this.logger.logOperationStart('find campaign by id', { tenantId, id });

    try {
      const campaign = await this.campaignRepo.findOne({
        where: { id, tenantId, isDeleted: false },
      });
      this.logger.logDbQuery('SELECT campaigns', campaign ? 1 : 0);
      this.logger.logOperationEnd('find campaign by id', startTime);
      return campaign;
    } catch (error) {
      this.logger.logOperationError('find campaign by id', error as Error);
      throw error;
    }
  }

  async findByName(tenantId: string, name: string): Promise<Campaign | null> {
    const startTime = this.logger.logOperationStart('find campaign by name', { tenantId, name });

    try {
      const campaign = await this.campaignRepo.findOne({
        where: { tenantId, name, isDeleted: false },
      });
      this.logger.logDbQuery('SELECT campaigns', campaign ? 1 : 0);
      return campaign;
    } catch (error) {
      this.logger.logOperationError('find campaign by name', error as Error);
      throw error;
    }
  }

  async findAll(tenantId: string, search: CampaignSearchDto): Promise<PaginatedResult<Campaign>> {
    const startTime = this.logger.logOperationStart('find all campaigns', { tenantId, ...search });

    try {
      const page = search.page || 1;
      const limit = search.limit || 20;
      const skip = (page - 1) * limit;

      const where: FindOptionsWhere<Campaign> = {
        tenantId,
        isDeleted: false,
      };

      if (search.channel) {
        where.channel = search.channel;
      }

      if (search.status) {
        where.status = search.status;
      }

      if (search.search) {
        where.name = ILike(`%${search.search}%`);
      }

      const [data, total] = await this.campaignRepo.findAndCount({
        where,
        order: { [search.sortBy || 'createdAt']: search.sortOrder || 'DESC' },
        skip,
        take: limit,
      });

      this.logger.logDbQuery('SELECT campaigns', data.length, { total });
      this.logger.logOperationEnd('find all campaigns', startTime, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('find all campaigns', error as Error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    const startTime = this.logger.logOperationStart('update campaign', { tenantId, id });

    try {
      await this.campaignRepo.update({ id, tenantId }, updates);
      const updated = await this.findById(tenantId, id);
      this.logger.logDbQuery('UPDATE campaigns', 1);
      this.logger.logOperationEnd('update campaign', startTime);
      return updated;
    } catch (error) {
      this.logger.logOperationError('update campaign', error as Error);
      throw error;
    }
  }

  async softDelete(tenantId: string, id: string, userId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('soft delete campaign', { tenantId, id, userId });

    try {
      await this.campaignRepo.update(
        { id, tenantId },
        { isDeleted: true, deletedAt: new Date(), updatedBy: userId },
      );
      this.logger.logDbQuery('UPDATE campaigns (soft delete)', 1);
      this.logger.logOperationEnd('soft delete campaign', startTime);
    } catch (error) {
      this.logger.logOperationError('soft delete campaign', error as Error);
      throw error;
    }
  }

  async updateStatus(tenantId: string, id: string, status: CampaignStatus, userId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('update campaign status', { tenantId, id, status });

    try {
      await this.campaignRepo.update({ id, tenantId }, { status, updatedBy: userId });
      this.logger.logDbQuery('UPDATE campaigns status', 1, { status });
      this.logger.logOperationEnd('update campaign status', startTime);
    } catch (error) {
      this.logger.logOperationError('update campaign status', error as Error);
      throw error;
    }
  }

  async findScheduledCampaigns(tenantId: string, beforeDate: Date): Promise<Campaign[]> {
    const startTime = this.logger.logOperationStart('find scheduled campaigns', { tenantId, beforeDate });

    try {
      const qb = this.campaignRepo.createQueryBuilder('c');
      const campaigns = await qb
        .where('c.tenant_id = :tenantId', { tenantId })
        .andWhere('c.status = :status', { status: CampaignStatus.SCHEDULED })
        .andWhere('c.schedule_at <= :beforeDate', { beforeDate })
        .andWhere('c.is_deleted = false')
        .getMany();

      this.logger.logDbQuery('SELECT scheduled campaigns', campaigns.length);
      return campaigns;
    } catch (error) {
      this.logger.logOperationError('find scheduled campaigns', error as Error);
      throw error;
    }
  }

  /**
   * Find all scheduled campaigns globally (across all tenants) that are due
   */
  async findScheduledCampaignsGlobal(beforeDate: Date, limit: number = 10): Promise<Campaign[]> {
    const startTime = this.logger.logOperationStart('find scheduled campaigns global', { beforeDate, limit });

    try {
      const qb = this.campaignRepo.createQueryBuilder('c');
      const campaigns = await qb
        .where('c.status = :status', { status: CampaignStatus.SCHEDULED })
        .andWhere('c.schedule_at <= :beforeDate', { beforeDate })
        .andWhere('c.is_deleted = false')
        .orderBy('c.schedule_at', 'ASC')
        .take(limit)
        .getMany();

      this.logger.logDbQuery('SELECT scheduled campaigns global', campaigns.length, { limit });
      this.logger.logOperationEnd('find scheduled campaigns global', startTime, { found: campaigns.length });
      return campaigns;
    } catch (error) {
      this.logger.logOperationError('find scheduled campaigns global', error as Error);
      throw error;
    }
  }

  // ============ Campaign Run CRUD ============

  async createRun(run: CampaignRun): Promise<CampaignRun> {
    const startTime = this.logger.logOperationStart('create campaign run', {
      campaignId: run.campaignId,
    });

    try {
      const saved = await this.runRepo.save(run);
      this.logger.logDbQuery('INSERT campaign_runs', 1, { runId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create campaign run', error as Error);
      throw error;
    }
  }

  async findRunById(runId: string): Promise<CampaignRun | null> {
    return this.runRepo.findOne({ where: { id: runId } });
  }

  async findRunsByCampaign(tenantId: string, campaignId: string): Promise<CampaignRun[]> {
    return this.runRepo.find({
      where: { campaignId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateRun(runId: string, updates: Partial<CampaignRun>): Promise<CampaignRun | null> {
    const startTime = this.logger.logOperationStart('update campaign run', { runId });

    try {
      await this.runRepo.update({ id: runId }, updates);
      const updated = await this.runRepo.findOne({ where: { id: runId } });
      this.logger.logDbQuery('UPDATE campaign_runs', 1);
      return updated;
    } catch (error) {
      this.logger.logOperationError('update campaign run', error as Error);
      throw error;
    }
  }

  async updateRunStatus(
    runId: string,
    status: CampaignRunStatus,
    stats?: { processedCount?: number; sentCount?: number; failedCount?: number },
  ): Promise<void> {
    const updates: Partial<CampaignRun> = { status, ...stats };

    if (status === CampaignRunStatus.RUNNING) {
      updates.startedAt = new Date();
    } else if (status === CampaignRunStatus.COMPLETED || status === CampaignRunStatus.FAILED) {
      updates.completedAt = new Date();
    }

    await this.runRepo.update({ id: runId }, updates);
  }

  // ============ Campaign Message CRUD ============

  async createMessage(message: CampaignMessage): Promise<CampaignMessage> {
    const startTime = this.logger.logOperationStart('create campaign message', {
      campaignId: message.campaignId,
      contactId: message.contactId,
    });

    try {
      const saved = await this.messageRepo.save(message);
      this.logger.logDbQuery('INSERT campaign_messages', 1, { messageId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create campaign message', error as Error);
      throw error;
    }
  }

  async createMessagesBatch(messages: CampaignMessage[]): Promise<CampaignMessage[]> {
    if (messages.length === 0) return [];

    const startTime = this.logger.logOperationStart('create campaign messages batch', {
      count: messages.length,
    });

    try {
      const saved = await this.messageRepo.save(messages);
      this.logger.logDbQuery('INSERT BATCH campaign_messages', saved.length);
      return saved;
    } catch (error) {
      this.logger.logOperationError('create campaign messages batch', error as Error);
      throw error;
    }
  }

  async findMessagesByCampaign(
    tenantId: string,
    campaignId: string,
    search: CampaignMessageSearchDto,
  ): Promise<PaginatedResult<CampaignMessage>> {
    const startTime = this.logger.logOperationStart('find messages by campaign', { tenantId, campaignId });

    try {
      const page = search.page || 1;
      const limit = search.limit || 50;
      const skip = (page - 1) * limit;

      const where: FindOptionsWhere<CampaignMessage> = {
        tenantId,
        campaignId,
      };

      if (search.dispatchStatus) {
        where.dispatchStatus = search.dispatchStatus;
      }

      const [data, total] = await this.messageRepo.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

      this.logger.logDbQuery('SELECT campaign_messages', data.length, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('find messages by campaign', error as Error);
      throw error;
    }
  }

  async findMessagesByRun(runId: string): Promise<CampaignMessage[]> {
    return this.messageRepo.find({
      where: { runId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateMessageStatus(
    messageId: string,
    status: DispatchStatus,
    updates?: Partial<CampaignMessage>,
  ): Promise<void> {
    const data: Partial<CampaignMessage> = {
      dispatchStatus: status,
      ...updates,
    };

    // Set timestamp based on status
    if (status === DispatchStatus.SENT) {
      data.sentAt = new Date();
    } else if (status === DispatchStatus.DELIVERED) {
      data.deliveredAt = new Date();
    } else if (status === DispatchStatus.OPENED) {
      data.openedAt = new Date();
    } else if (status === DispatchStatus.CLICKED) {
      data.clickedAt = new Date();
    }

    await this.messageRepo.update({ id: messageId }, data);
  }

  async updateMessagesBatch(
    messageIds: string[],
    updates: Partial<CampaignMessage>,
  ): Promise<void> {
    if (messageIds.length === 0) return;

    await this.messageRepo.update({ id: In(messageIds) }, updates);
  }

  // ============ Statistics Helpers ============

  async getMessageStats(campaignId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
  }> {
    const result = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.dispatch_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('m.campaign_id = :campaignId', { campaignId })
      .groupBy('m.dispatch_status')
      .getRawMany();

    const stats = {
      total: 0,
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      clicked: 0,
    };

    for (const row of result) {
      const count = parseInt(row.count, 10);
      stats.total += count;
      
      switch (row.status) {
        case DispatchStatus.PENDING:
          stats.pending = count;
          break;
        case DispatchStatus.SENT:
          stats.sent = count;
          break;
        case DispatchStatus.DELIVERED:
          stats.delivered = count;
          break;
        case DispatchStatus.FAILED:
          stats.failed = count;
          break;
        case DispatchStatus.OPENED:
          stats.opened = count;
          break;
        case DispatchStatus.CLICKED:
          stats.clicked = count;
          break;
      }
    }

    return stats;
  }

  async updateCampaignStats(campaignId: string): Promise<void> {
    const stats = await this.getMessageStats(campaignId);

    await this.campaignRepo.update(
      { id: campaignId },
      {
        audienceCount: stats.total,
        sentCount: stats.sent,
        deliveredCount: stats.delivered,
        failedCount: stats.failed,
        openedCount: stats.opened,
        clickedCount: stats.clicked,
      },
    );
  }
}
