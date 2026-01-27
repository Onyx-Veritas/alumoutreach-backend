import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { AnalyticsValidators } from '../validators/analytics.validators';
import {
  AnalyticsQueryDto,
  OverviewStatsResponse,
  QueryTimeRange,
} from '../dto/analytics.dto';
import {
  AnalyticsEventType,
  AnalyticsEntityType,
} from '../entities/analytics.schema';

/**
 * Analytics Service
 * Main service for analytics operations
 */
@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly eventBus: EventBusService,
    private readonly repository: AnalyticsRepository,
    private readonly mapper: AnalyticsMapper,
    private readonly validators: AnalyticsValidators,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.repository.initialize();
    this.logger.log('AnalyticsService initialized', 'AnalyticsService');
  }

  /**
   * Get overview statistics
   */
  async getOverviewStats(
    tenantId: string,
    query: AnalyticsQueryDto,
    correlationId?: string,
  ): Promise<OverviewStatsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getOverviewStats', {
      module: 'AnalyticsService',
      tenantId,
      correlationId,
    });

    const timeRange = this.validators.parseTimeRange(query);

    // Run queries in parallel
    const [eventsByType, recentActivity] = await Promise.all([
      this.repository.countByEventType(tenantId, timeRange),
      this.repository.countByTimeBucket(tenantId, timeRange),
    ]);

    // Calculate totals from event types
    const totals = this.calculateTotals(eventsByType);

    const result: OverviewStatsResponse = {
      totalContacts: totals.contacts,
      totalMessages: totals.messages,
      totalCampaigns: totals.campaigns,
      totalWorkflows: totals.workflows,
      totalSequences: totals.sequences,
      eventsByType,
      recentActivity,
    };

    this.logger.log('[END] getOverviewStats', {
      module: 'AnalyticsService',
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Calculate totals from event type counts
   */
  private calculateTotals(eventsByType: { key: string; count: number }[]): {
    contacts: number;
    messages: number;
    campaigns: number;
    workflows: number;
    sequences: number;
  } {
    const totals = {
      contacts: 0,
      messages: 0,
      campaigns: 0,
      workflows: 0,
      sequences: 0,
    };

    for (const item of eventsByType) {
      if (item.key === AnalyticsEventType.CONTACT_CREATED) {
        totals.contacts += item.count;
      }
      if (
        item.key === AnalyticsEventType.MESSAGE_SENT ||
        item.key === AnalyticsEventType.MESSAGE_RECEIVED
      ) {
        totals.messages += item.count;
      }
      if (item.key === AnalyticsEventType.CAMPAIGN_SENT) {
        totals.campaigns += item.count;
      }
      if (item.key === AnalyticsEventType.WORKFLOW_STARTED) {
        totals.workflows += item.count;
      }
      if (item.key === AnalyticsEventType.SEQUENCE_COMPLETED) {
        totals.sequences += item.count;
      }
    }

    return totals;
  }

  /**
   * Check if analytics is healthy
   */
  isHealthy(): boolean {
    return this.repository.isReady();
  }

  /**
   * Parse time range with defaults
   */
  parseTimeRange(query: AnalyticsQueryDto): QueryTimeRange {
    return this.validators.parseTimeRange(query);
  }
}
