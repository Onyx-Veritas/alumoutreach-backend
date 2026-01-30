import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { CampaignRepository } from '../repositories/campaign.repository';
import { Campaign, CampaignChannel, CampaignStatus } from '../entities/campaign.entity';
import { CampaignRun, CampaignRunStatus } from '../entities/campaign-run.entity';
import { SegmentRepository } from '../../segments/repositories/segment.repository';
import { ContactRepository } from '../../contacts/repositories/contact.repository';
import { PipelineProducerService, CampaignRunInfo, ContactInfo } from '../../pipeline/services/pipeline-producer.service';
import {
  CampaignEventType,
  CampaignSubjects,
  CampaignRunStartedEvent,
  CampaignRunCompletedEvent,
} from '../events/campaign.events';

// ============ Execution Request/Response DTOs ============

export interface ExecuteCampaignRequest {
  campaignId: string;
  tenantId: string;
  userId: string;
  correlationId: string;
  /** If true, execute immediately; if false, just validate */
  dryRun?: boolean;
}

export interface ExecuteCampaignResult {
  success: boolean;
  campaignId: string;
  campaignRunId?: string;
  totalRecipients: number;
  enqueuedJobs: number;
  dryRun: boolean;
  message: string;
  errors?: string[];
}

export interface CampaignExecutionStats {
  campaignId: string;
  campaignRunId: string;
  totalRecipients: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  status: CampaignRunStatus;
  startedAt?: Date;
  completedAt?: Date;
}

// ============ Campaign Executor Service ============

/**
 * CampaignExecutorService orchestrates campaign execution:
 * 1. Validates campaign is ready for execution
 * 2. Resolves segment to get target contacts
 * 3. Creates a CampaignRun record
 * 4. Enqueues jobs via PipelineProducerService (which uses BullMQ)
 * 5. Publishes campaign.started event
 */
@Injectable()
export class CampaignExecutorService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly segmentRepository: SegmentRepository,
    private readonly contactRepository: ContactRepository,
    private readonly pipelineProducer: PipelineProducerService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignExecutorService');
  }

  /**
   * Execute a campaign
   * 
   * @param request - Execution request with campaignId, tenantId, userId
   * @returns Execution result with stats
   */
  async execute(request: ExecuteCampaignRequest): Promise<ExecuteCampaignResult> {
    const { campaignId, tenantId, userId, correlationId, dryRun = false } = request;

    const startTime = this.logger.logOperationStart('execute campaign', {
      campaignId,
      tenantId,
      userId,
      dryRun,
      correlationId,
    });

    try {
      // 1. Load and validate campaign
      const campaign = await this.loadAndValidateCampaign(tenantId, campaignId);

      // 2. Resolve segment to get contacts
      const contacts = await this.resolveSegmentContacts(tenantId, campaign.segmentId!);

      if (contacts.length === 0) {
        this.logger.warn('No contacts in segment', {
          campaignId,
          segmentId: campaign.segmentId,
        });

        return {
          success: false,
          campaignId,
          totalRecipients: 0,
          enqueuedJobs: 0,
          dryRun,
          message: 'No contacts found in segment. Campaign not executed.',
        };
      }

      // If dry run, just return validation result
      if (dryRun) {
        this.logger.logOperationEnd('execute campaign (dry run)', startTime, {
          totalRecipients: contacts.length,
        });

        return {
          success: true,
          campaignId,
          totalRecipients: contacts.length,
          enqueuedJobs: 0,
          dryRun: true,
          message: `Dry run successful. ${contacts.length} contacts would receive the campaign.`,
        };
      }

      // 3. Create campaign run record
      const campaignRun = await this.createCampaignRun(campaign, contacts.length);

      // 4. Update campaign status to RUNNING
      await this.campaignRepository.updateStatus(tenantId, campaignId, CampaignStatus.RUNNING, userId);

      // 5. Enqueue jobs via PipelineProducerService
      const campaignRunInfo: CampaignRunInfo = {
        id: campaignRun.id,
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        channel: campaign.channel,
        templateVersionId: campaign.templateVersionId,
        campaignName: campaign.name,
      };

      const contactInfos: ContactInfo[] = contacts.map(c => ({
        id: c.id,
        email: c.email,
        phone: c.phone,
        fullName: c.fullName,
        attributes: this.convertAttributesToRecord(c.attributes),
      }));

      const jobs = await this.pipelineProducer.enqueueCampaignRun(
        campaignRunInfo,
        contactInfos,
        correlationId,
      );

      // 6. Update campaign run with actual job count
      await this.campaignRepository.updateRun(campaignRun.id, {
        totalRecipients: jobs.length,
      });

      // 7. Publish campaign started event
      await this.publishCampaignStartedEvent(campaign, campaignRun, contacts.length, userId, correlationId);

      this.logger.logOperationEnd('execute campaign', startTime, {
        campaignRunId: campaignRun.id,
        totalRecipients: contacts.length,
        enqueuedJobs: jobs.length,
      });

      return {
        success: true,
        campaignId,
        campaignRunId: campaignRun.id,
        totalRecipients: contacts.length,
        enqueuedJobs: jobs.length,
        dryRun: false,
        message: `Campaign execution started. ${jobs.length} jobs enqueued.`,
      };
    } catch (error) {
      this.logger.logOperationError('execute campaign', error as Error, { correlationId });
      throw error;
    }
  }

  /**
   * Get execution stats for a campaign run
   */
  async getExecutionStats(tenantId: string, campaignRunId: string): Promise<CampaignExecutionStats | null> {
    const run = await this.campaignRepository.findRunById(campaignRunId);
    if (!run || run.tenantId !== tenantId) {
      return null;
    }

    return {
      campaignId: run.campaignId,
      campaignRunId: run.id,
      totalRecipients: run.totalRecipients,
      processedCount: run.processedCount,
      sentCount: run.sentCount,
      failedCount: run.failedCount,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }

  /**
   * Mark a campaign run as completed
   * Called when all jobs are processed (either by BullMQ events or a separate completion checker)
   */
  async markRunCompleted(
    tenantId: string,
    campaignRunId: string,
    stats: { sentCount: number; failedCount: number },
    correlationId: string,
  ): Promise<void> {
    const run = await this.campaignRepository.findRunById(campaignRunId);
    if (!run || run.tenantId !== tenantId) {
      throw new NotFoundException(`Campaign run ${campaignRunId} not found`);
    }

    // Update run status
    await this.campaignRepository.updateRunStatus(
      campaignRunId,
      CampaignRunStatus.COMPLETED,
      {
        processedCount: stats.sentCount + stats.failedCount,
        sentCount: stats.sentCount,
        failedCount: stats.failedCount,
      },
    );

    // Update campaign status
    const campaign = await this.campaignRepository.findById(tenantId, run.campaignId);
    if (campaign) {
      await this.campaignRepository.updateStatus(
        tenantId,
        run.campaignId,
        CampaignStatus.COMPLETED,
        'system',
      );

      // Update campaign stats
      await this.campaignRepository.update(tenantId, run.campaignId, {
        sentCount: (campaign.sentCount || 0) + stats.sentCount,
        failedCount: (campaign.failedCount || 0) + stats.failedCount,
      });

      // Publish completion event
      await this.publishCampaignCompletedEvent(campaign, run, stats, correlationId);
    }
  }

  // ============ Private Helper Methods ============

  /**
   * Load and validate campaign is ready for execution
   */
  private async loadAndValidateCampaign(tenantId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    // Check status allows execution
    if (![CampaignStatus.DRAFT, CampaignStatus.SCHEDULED].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot execute campaign in ${campaign.status} status. Only DRAFT or SCHEDULED campaigns can be executed.`,
      );
    }

    // Validate required fields
    if (!campaign.segmentId) {
      throw new BadRequestException('Campaign must have a segment assigned');
    }

    if (!campaign.templateVersionId) {
      throw new BadRequestException('Campaign must have a template assigned');
    }

    return campaign;
  }

  /**
   * Resolve segment to get all target contacts
   */
  private async resolveSegmentContacts(
    tenantId: string,
    segmentId: string,
  ): Promise<Array<{ id: string; email?: string; phone?: string; fullName?: string; attributes?: unknown[] }>> {
    // First verify segment exists
    const segment = await this.segmentRepository.findById(tenantId, segmentId);
    if (!segment) {
      throw new NotFoundException(`Segment ${segmentId} not found`);
    }

    // Get all segment members (no pagination - we need all of them)
    const members = await this.segmentRepository.getMembers(tenantId, segmentId, {
      page: 1,
      limit: 100000, // Large limit to get all
    });

    if (members.data.length === 0) {
      return [];
    }

    // Load full contact details for each member
    const contactIds = members.data.map(m => m.contactId);
    const contacts = await this.contactRepository.findByIds(tenantId, contactIds);

    return contacts;
  }

  /**
   * Convert contact attributes array to record
   */
  private convertAttributesToRecord(attributes: unknown[]): Record<string, unknown> {
    if (!Array.isArray(attributes)) return {};

    const record: Record<string, unknown> = {};
    for (const attr of attributes as Array<{ key: string; value: unknown }>) {
      if (attr.key) {
        record[attr.key] = attr.value;
      }
    }
    return record;
  }

  /**
   * Create a new campaign run record
   */
  private async createCampaignRun(campaign: Campaign, totalRecipients: number): Promise<CampaignRun> {
    const run = new CampaignRun();
    run.id = uuidv4();
    run.campaignId = campaign.id;
    run.tenantId = campaign.tenantId;
    run.status = CampaignRunStatus.RUNNING;
    run.startedAt = new Date();
    run.totalRecipients = totalRecipients;
    run.processedCount = 0;
    run.sentCount = 0;
    run.failedCount = 0;

    return this.campaignRepository.createRun(run);
  }

  /**
   * Publish campaign.run.started event
   */
  private async publishCampaignStartedEvent(
    campaign: Campaign,
    run: CampaignRun,
    totalRecipients: number,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    const event: CampaignRunStartedEvent = {
      eventId: uuidv4(),
      eventType: CampaignEventType.CAMPAIGN_RUN_STARTED,
      tenantId: campaign.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        campaignId: campaign.id,
        runId: run.id,
        totalRecipients,
        channel: campaign.channel,
      },
    };

    try {
      await this.eventBus.publish(CampaignSubjects.RUN_STARTED, event, {
        correlationId,
        tenantId: campaign.tenantId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish campaign started event', {
        campaignId: campaign.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Publish campaign.run.completed event
   */
  private async publishCampaignCompletedEvent(
    campaign: Campaign,
    run: CampaignRun,
    stats: { sentCount: number; failedCount: number },
    correlationId: string,
  ): Promise<void> {
    const event: CampaignRunCompletedEvent = {
      eventId: uuidv4(),
      eventType: CampaignEventType.CAMPAIGN_RUN_COMPLETED,
      tenantId: campaign.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        campaignId: campaign.id,
        runId: run.id,
        totalRecipients: run.totalRecipients,
        sentCount: stats.sentCount,
        failedCount: stats.failedCount,
        durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : 0,
      },
    };

    try {
      await this.eventBus.publish(CampaignSubjects.RUN_COMPLETED, event, {
        correlationId,
        tenantId: campaign.tenantId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish campaign completed event', {
        campaignId: campaign.id,
        error: (error as Error).message,
      });
    }
  }
}
