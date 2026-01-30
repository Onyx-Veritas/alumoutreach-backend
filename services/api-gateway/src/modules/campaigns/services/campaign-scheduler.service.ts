import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { CampaignRepository } from '../repositories/campaign.repository';
import { Campaign, CampaignStatus } from '../entities/campaign.entity';
import { CampaignExecutorService, ExecuteCampaignRequest } from './campaign-executor.service';

// ============ Scheduler Configuration ============

interface SchedulerConfig {
  /** How often to check for scheduled campaigns (cron expression) */
  cronExpression: string;
  /** Maximum number of campaigns to process per cron run */
  batchSize: number;
  /** Whether the scheduler is enabled */
  enabled: boolean;
}

// ============ Campaign Scheduler Service ============

/**
 * CampaignSchedulerService polls for scheduled campaigns and triggers execution
 * when their scheduleAt time has passed.
 * 
 * Uses @nestjs/schedule for cron-based polling.
 */
@Injectable()
export class CampaignSchedulerService implements OnModuleInit {
  private readonly logger: AppLoggerService;
  private readonly config: SchedulerConfig;
  private isProcessing = false;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignExecutor: CampaignExecutorService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignSchedulerService');

    // Configuration (could be made dynamic via ConfigService)
    this.config = {
      cronExpression: CronExpression.EVERY_MINUTE,
      batchSize: 10,
      enabled: process.env.CAMPAIGN_SCHEDULER_ENABLED !== 'false',
    };
  }

  onModuleInit(): void {
    if (this.config.enabled) {
      this.logger.info('Campaign scheduler initialized', {
        cronExpression: this.config.cronExpression,
        batchSize: this.config.batchSize,
      });
    } else {
      this.logger.warn('Campaign scheduler is DISABLED');
    }
  }

  /**
   * Cron job that runs every minute to check for due campaigns
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledCampaigns(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Prevent concurrent runs
    if (this.isProcessing) {
      this.logger.debug('Scheduler already processing, skipping this run');
      return;
    }

    this.isProcessing = true;
    const correlationId = `scheduler-${uuidv4().slice(0, 8)}`;

    const startTime = this.logger.logOperationStart('check scheduled campaigns', {
      correlationId,
    });

    try {
      // Get all tenants with scheduled campaigns
      // For now, we'll check all campaigns globally (could be optimized per-tenant)
      const dueCampaigns = await this.findDueCampaigns();

      if (dueCampaigns.length === 0) {
        this.logger.debug('No scheduled campaigns due', { correlationId });
        return;
      }

      this.logger.log(`Found ${dueCampaigns.length} due campaign(s)`, { correlationId });

      // Process each due campaign
      for (const campaign of dueCampaigns) {
        await this.executeCampaign(campaign, correlationId);
      }

      this.logger.logOperationEnd('check scheduled campaigns', startTime, {
        processedCount: dueCampaigns.length,
      });
    } catch (error) {
      this.logger.logOperationError('check scheduled campaigns', error as Error, { correlationId });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find all campaigns that are due for execution
   */
  private async findDueCampaigns(): Promise<Campaign[]> {
    const now = new Date();

    // Get all campaigns across all tenants that are SCHEDULED and past due
    // Note: In production, you might want to use a more efficient global query
    const campaigns = await this.campaignRepository.findScheduledCampaignsGlobal(now, this.config.batchSize);

    return campaigns;
  }

  /**
   * Execute a single scheduled campaign
   */
  private async executeCampaign(campaign: Campaign, parentCorrelationId: string): Promise<void> {
    const correlationId = `${parentCorrelationId}-${campaign.id.slice(0, 8)}`;

    this.logger.log('Executing scheduled campaign', {
      campaignId: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      scheduledAt: campaign.scheduleAt,
      correlationId,
    });

    try {
      const request: ExecuteCampaignRequest = {
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        userId: 'system-scheduler',
        correlationId,
        dryRun: false,
      };

      const result = await this.campaignExecutor.execute(request);

      if (result.success) {
        this.logger.log('Scheduled campaign execution started', {
          campaignId: campaign.id,
          campaignRunId: result.campaignRunId,
          totalRecipients: result.totalRecipients,
          correlationId,
        });
      } else {
        this.logger.warn('Scheduled campaign execution skipped', {
          campaignId: campaign.id,
          message: result.message,
          correlationId,
        });

        // Mark campaign as failed if no recipients
        if (result.totalRecipients === 0) {
          await this.campaignRepository.updateStatus(
            campaign.tenantId,
            campaign.id,
            CampaignStatus.FAILED,
            'system-scheduler',
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to execute scheduled campaign', (error as Error).stack, {
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        error: (error as Error).message,
        correlationId,
      });

      // Mark campaign as failed
      await this.campaignRepository.updateStatus(
        campaign.tenantId,
        campaign.id,
        CampaignStatus.FAILED,
        'system-scheduler',
      );
    }
  }

  /**
   * Manually trigger a check (for testing/admin purposes)
   */
  async triggerCheck(): Promise<{ processedCount: number }> {
    const wasEnabled = this.config.enabled;
    this.config.enabled = true;

    try {
      await this.checkScheduledCampaigns();
      return { processedCount: 0 }; // Would need to track actual count
    } finally {
      this.config.enabled = wasEnabled;
    }
  }

  /**
   * Enable/disable the scheduler dynamically
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.log(`Campaign scheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if scheduler is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
