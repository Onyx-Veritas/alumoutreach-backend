import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { AnalyticsValidators } from '../validators/analytics.validators';
import {
  MessagesAnalyticsQueryDto,
  CampaignAnalyticsQueryDto,
  WorkflowAnalyticsQueryDto,
  SequenceAnalyticsQueryDto,
  TemplateAnalyticsQueryDto,
  TrafficAnalyticsQueryDto,
  MessagesAnalyticsResponse,
  CampaignAnalyticsResponse,
  WorkflowAnalyticsResponse,
  SequenceAnalyticsResponse,
  TemplateAnalyticsResponse,
  TrafficAnalyticsResponse,
  TimeGranularity,
} from '../dto/analytics.dto';
import {
  AnalyticsEventType,
  AnalyticsEntityType,
} from '../entities/analytics.schema';

/**
 * Analytics Query Service
 * Handles dashboard-specific analytics queries
 */
@Injectable()
export class AnalyticsQueryService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly repository: AnalyticsRepository,
    private readonly validators: AnalyticsValidators,
  ) {
    this.logger.setContext('AnalyticsQueryService');
  }

  /**
   * Get messages analytics
   */
  async getMessagesAnalytics(
    tenantId: string,
    query: MessagesAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<MessagesAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getMessagesAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    const messageEventTypes = [
      AnalyticsEventType.MESSAGE_SENT,
      AnalyticsEventType.MESSAGE_RECEIVED,
    ];

    // Run queries in parallel
    const [eventsByType, byChannel, timeSeries] = await Promise.all([
      this.repository.countByEventType(tenantId, timeRange, messageEventTypes),
      this.repository.countByChannel(tenantId, timeRange, AnalyticsEntityType.INBOX_MESSAGE),
      this.repository.countByTimeBucketAndDimension(
        tenantId,
        timeRange,
        'channel',
        messageEventTypes,
        AnalyticsEntityType.INBOX_MESSAGE,
      ),
    ]);

    // Extract totals
    const totalSent = eventsByType.find((e) => e.key === AnalyticsEventType.MESSAGE_SENT)?.count || 0;
    const totalReceived = eventsByType.find((e) => e.key === AnalyticsEventType.MESSAGE_RECEIVED)?.count || 0;

    // Map event types to direction
    const byDirection = eventsByType.map((e) => ({
      key: e.key === AnalyticsEventType.MESSAGE_SENT ? 'outbound' : 'inbound',
      count: e.count,
    }));

    const result: MessagesAnalyticsResponse = {
      totalSent,
      totalReceived,
      byChannel,
      byDirection,
      timeSeries,
    };

    this.logger.log('[END] getMessagesAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(
    tenantId: string,
    query: CampaignAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<CampaignAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getCampaignAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    const campaignEventTypes = [
      AnalyticsEventType.CAMPAIGN_SENT,
      AnalyticsEventType.CAMPAIGN_DELIVERED,
      AnalyticsEventType.CAMPAIGN_OPENED,
      AnalyticsEventType.CAMPAIGN_CLICKED,
    ];

    // Run queries in parallel
    const [eventsByType, timeSeries] = await Promise.all([
      this.repository.countByEventType(tenantId, timeRange, campaignEventTypes),
      this.repository.countByTimeBucket(tenantId, timeRange, campaignEventTypes),
    ]);

    // Extract totals
    const totalSent = eventsByType.find((e) => e.key === AnalyticsEventType.CAMPAIGN_SENT)?.count || 0;
    const totalDelivered = eventsByType.find((e) => e.key === AnalyticsEventType.CAMPAIGN_DELIVERED)?.count || 0;
    const totalOpened = eventsByType.find((e) => e.key === AnalyticsEventType.CAMPAIGN_OPENED)?.count || 0;
    const totalClicked = eventsByType.find((e) => e.key === AnalyticsEventType.CAMPAIGN_CLICKED)?.count || 0;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    const result: CampaignAnalyticsResponse = {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      byStatus: eventsByType,
      timeSeries,
    };

    this.logger.log('[END] getCampaignAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(
    tenantId: string,
    query: WorkflowAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<WorkflowAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getWorkflowAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    const workflowEventTypes = [
      AnalyticsEventType.WORKFLOW_STARTED,
      AnalyticsEventType.WORKFLOW_COMPLETED,
    ];

    // Run queries in parallel
    const [eventsByType, timeSeries] = await Promise.all([
      this.repository.countByEventType(tenantId, timeRange, workflowEventTypes),
      this.repository.countByTimeBucket(tenantId, timeRange, workflowEventTypes),
    ]);

    // Extract totals
    const totalStarted = eventsByType.find((e) => e.key === AnalyticsEventType.WORKFLOW_STARTED)?.count || 0;
    const totalCompleted = eventsByType.find((e) => e.key === AnalyticsEventType.WORKFLOW_COMPLETED)?.count || 0;

    // Calculate completion rate
    const completionRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

    const result: WorkflowAnalyticsResponse = {
      totalStarted,
      totalCompleted,
      completionRate: Math.round(completionRate * 100) / 100,
      byStatus: eventsByType,
      timeSeries,
    };

    this.logger.log('[END] getWorkflowAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get sequence analytics
   */
  async getSequenceAnalytics(
    tenantId: string,
    query: SequenceAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<SequenceAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getSequenceAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    const sequenceEventTypes = [
      AnalyticsEventType.SEQUENCE_STEP_COMPLETED,
      AnalyticsEventType.SEQUENCE_COMPLETED,
    ];

    // Run queries in parallel
    const [eventsByType, timeSeries, totalEnrolledCount] = await Promise.all([
      this.repository.countByEventType(tenantId, timeRange, sequenceEventTypes),
      this.repository.countByTimeBucket(tenantId, timeRange, sequenceEventTypes),
      this.repository.getTotalCount(tenantId, timeRange, undefined, AnalyticsEntityType.SEQUENCE_RUN),
    ]);

    // Extract totals
    const totalStepsCompleted = eventsByType.find((e) => e.key === AnalyticsEventType.SEQUENCE_STEP_COMPLETED)?.count || 0;
    const totalCompleted = eventsByType.find((e) => e.key === AnalyticsEventType.SEQUENCE_COMPLETED)?.count || 0;

    // Estimate enrolled from unique sequence runs
    const totalEnrolled = totalEnrolledCount;

    // Calculate completion rate
    const completionRate = totalEnrolled > 0 ? (totalCompleted / totalEnrolled) * 100 : 0;

    const result: SequenceAnalyticsResponse = {
      totalEnrolled,
      totalCompleted,
      totalStepsCompleted,
      completionRate: Math.round(completionRate * 100) / 100,
      byStatus: eventsByType,
      timeSeries,
    };

    this.logger.log('[END] getSequenceAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get template analytics
   */
  async getTemplateAnalytics(
    tenantId: string,
    query: TemplateAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<TemplateAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getTemplateAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    const templateEventTypes = [AnalyticsEventType.TEMPLATE_USED];

    // Run queries in parallel
    const [totalUsed, byTemplate, byChannel, timeSeries] = await Promise.all([
      this.repository.getTotalCount(tenantId, timeRange, templateEventTypes),
      this.repository.countByMetadataField(tenantId, timeRange, 'templateId', templateEventTypes),
      this.repository.countByChannel(tenantId, timeRange, AnalyticsEntityType.TEMPLATE),
      this.repository.countByTimeBucket(tenantId, timeRange, templateEventTypes),
    ]);

    const result: TemplateAnalyticsResponse = {
      totalUsed,
      byTemplate,
      byChannel,
      timeSeries,
    };

    this.logger.log('[END] getTemplateAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Get traffic analytics
   */
  async getTrafficAnalytics(
    tenantId: string,
    query: TrafficAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<TrafficAnalyticsResponse> {
    const startTime = Date.now();
    this.logger.log('[START] getTrafficAnalytics', { tenantId, correlationId });

    const timeRange = this.validators.parseTimeRange(query);
    // Force hourly granularity for traffic
    timeRange.granularity = TimeGranularity.HOUR;

    // Run queries in parallel
    const [totalEvents, byChannel, byEventType, timeSeries] = await Promise.all([
      this.repository.getTotalCount(tenantId, timeRange),
      this.repository.countByChannel(tenantId, timeRange),
      this.repository.countByEventType(tenantId, timeRange),
      this.repository.countByTimeBucket(tenantId, timeRange),
    ]);

    const result: TrafficAnalyticsResponse = {
      totalEvents,
      byChannel,
      byEventType,
      timeSeries,
    };

    this.logger.log('[END] getTrafficAnalytics', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return result;
  }
}
