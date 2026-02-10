import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { CampaignRun, CampaignRunStatus } from '../../campaigns/entities/campaign-run.entity';
import { Campaign, CampaignStatus } from '../../campaigns/entities/campaign.entity';
import { PipelineJob } from '../entities/pipeline-job.entity';
import { PipelineJobStatus } from '../entities/pipeline.enums';
import {
  PipelineSubjects,
  PipelineEventType,
  CampaignRunCompletedEvent,
} from '../events/pipeline.events';

/**
 * Campaign Stats Service
 * 
 * Provides methods to update campaign run statistics atomically.
 * Called directly from message processor after job completion.
 * Also handles campaign auto-completion when all jobs are processed.
 */
@Injectable()
export class CampaignStatsService {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(CampaignRun)
    private readonly runRepository: Repository<CampaignRun>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(PipelineJob)
    private readonly jobRepository: Repository<PipelineJob>,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignStatsService');
  }

  /**
   * Increment sent count for a campaign run
   */
  async incrementSent(
    campaignRunId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.incrementStat(campaignRunId, 'sent', tenantId, correlationId);
  }

  /**
   * Increment failed count (dead jobs - no more retries)
   */
  async incrementFailed(
    campaignRunId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.incrementStat(campaignRunId, 'dead', tenantId, correlationId);
  }

  /**
   * Increment skipped count
   */
  async incrementSkipped(
    campaignRunId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.incrementStat(campaignRunId, 'skipped', tenantId, correlationId);
  }

  /**
   * Update campaign run statistics atomically
   */
  private async incrementStat(
    campaignRunId: string,
    type: 'sent' | 'dead' | 'skipped',
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      // Atomic increment using query builder to prevent race conditions
      const updateQuery = this.runRepository
        .createQueryBuilder()
        .update(CampaignRun)
        .where('id = :id', { id: campaignRunId });

      if (type === 'sent') {
        updateQuery.set({
          sentCount: () => 'sent_count + 1',
          processedCount: () => 'processed_count + 1',
        });
      } else if (type === 'dead') {
        updateQuery.set({
          failedCount: () => 'failed_count + 1',
          processedCount: () => 'processed_count + 1',
        });
      } else if (type === 'skipped') {
        updateQuery.set({
          skippedCount: () => 'skipped_count + 1',
          processedCount: () => 'processed_count + 1',
        });
      }

      await updateQuery.execute();

      this.logger.debug(`Updated campaign run stats`, {
        campaignRunId,
        type,
      });

      // Check if campaign run is complete
      await this.checkAndCompleteCampaignRun(campaignRunId, tenantId, correlationId);

    } catch (error) {
      this.logger.error('Failed to update campaign stats', (error as Error).message, {
        campaignRunId,
        type,
      });
    }
  }

  /**
   * Check if all jobs are processed and mark campaign run as completed
   */
  private async checkAndCompleteCampaignRun(
    campaignRunId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      // Get current run stats
      const run = await this.runRepository.findOne({
        where: { id: campaignRunId },
      });

      if (!run) {
        return;
      }

      // Already completed?
      if (run.status === CampaignRunStatus.COMPLETED || run.status === CampaignRunStatus.FAILED) {
        return;
      }

      // Check if all jobs are processed (terminal states)
      const totalProcessed = run.processedCount;
      const totalRecipients = run.totalRecipients;

      if (totalProcessed >= totalRecipients && totalRecipients > 0) {
        // All jobs processed - mark as complete
        const completedAt = new Date();
        const durationMs = run.startedAt
          ? completedAt.getTime() - run.startedAt.getTime()
          : 0;

        // Determine final status - if any sent, it's completed; if all failed, it's failed
        const finalStatus = run.sentCount > 0
          ? CampaignRunStatus.COMPLETED
          : CampaignRunStatus.FAILED;

        await this.runRepository.update(campaignRunId, {
          status: finalStatus,
          completedAt,
        });

        // Auto-update parent Campaign entity status
        const campaignStatus = finalStatus === CampaignRunStatus.COMPLETED
          ? CampaignStatus.COMPLETED
          : CampaignStatus.FAILED;

        await this.campaignRepository.update(
          { id: run.campaignId, tenantId: run.tenantId },
          { status: campaignStatus },
        );

        // Get skipped count from dedicated column
        const skippedCount = run.skippedCount || 0;

        this.logger.info('Campaign run auto-completed', {
          campaignRunId,
          campaignId: run.campaignId,
          status: finalStatus,
          totalRecipients,
          sentCount: run.sentCount,
          failedCount: run.failedCount,
          skippedCount,
          durationMs,
        });

        // Publish completion event
        const event: CampaignRunCompletedEvent = {
          eventId: uuidv4(),
          eventType: PipelineEventType.CAMPAIGN_RUN_COMPLETED,
          tenantId,
          correlationId,
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'campaign-stats-service',
          payload: {
            campaignId: run.campaignId,
            campaignRunId,
            tenantId,
            totalRecipients,
            sentCount: run.sentCount,
            failedCount: run.failedCount,
            skippedCount,
            deadCount: run.failedCount,
            durationMs,
            completedAt: completedAt.toISOString(),
          },
        };

        await this.eventBus.publish(PipelineSubjects.CAMPAIGN_RUN_COMPLETED, event, { correlationId });
      }
    } catch (error) {
      this.logger.error('Failed to check/complete campaign run', (error as Error).message, { campaignRunId });
    }
  }

  /**
   * Manually recalculate stats for a campaign run (for recovery/debugging)
   */
  async recalculateStats(campaignRunId: string): Promise<{
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    pendingCount: number;
  }> {
    // Count jobs by status
    const result = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('job.campaign_run_id = :campaignRunId', { campaignRunId })
      .groupBy('job.status')
      .getRawMany();

    const stats = {
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      pendingCount: 0,
    };

    for (const row of result) {
      const count = parseInt(row.count, 10);
      stats.totalRecipients += count;

      switch (row.status) {
        case PipelineJobStatus.SENT:
        case PipelineJobStatus.DELIVERED:
          stats.sentCount += count;
          break;
        case PipelineJobStatus.FAILED:
        case PipelineJobStatus.DEAD:
          stats.failedCount += count;
          break;
        case PipelineJobStatus.SKIPPED:
          stats.skippedCount += count;
          break;
        case PipelineJobStatus.PENDING:
        case PipelineJobStatus.QUEUED:
        case PipelineJobStatus.PROCESSING:
        case PipelineJobStatus.RETRYING:
          stats.pendingCount += count;
          break;
      }
    }

    // Update the campaign run with accurate counts
    await this.runRepository.update(campaignRunId, {
      totalRecipients: stats.totalRecipients,
      sentCount: stats.sentCount,
      failedCount: stats.failedCount,
      skippedCount: stats.skippedCount,
      processedCount: stats.sentCount + stats.failedCount + stats.skippedCount,
    });

    return stats;
  }
}
