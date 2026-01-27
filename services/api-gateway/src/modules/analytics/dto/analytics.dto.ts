import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsChannel } from '../entities/analytics.schema';

/**
 * Time Granularity for bucketing
 */
export enum TimeGranularity {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * Base Analytics Query DTO
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity;
}

/**
 * Messages Analytics Query DTO
 */
export class MessagesAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsChannel)
  channel?: AnalyticsChannel;

  @IsOptional()
  @IsString()
  direction?: string;
}

/**
 * Campaign Analytics Query DTO
 */
export class CampaignAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsEnum(AnalyticsChannel)
  channel?: AnalyticsChannel;
}

/**
 * Workflow Analytics Query DTO
 */
export class WorkflowAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  workflowId?: string;
}

/**
 * Sequence Analytics Query DTO
 */
export class SequenceAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  sequenceId?: string;

  @IsOptional()
  @IsEnum(AnalyticsChannel)
  channel?: AnalyticsChannel;
}

/**
 * Template Analytics Query DTO
 */
export class TemplateAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsEnum(AnalyticsChannel)
  channel?: AnalyticsChannel;
}

/**
 * Traffic Analytics Query DTO
 */
export class TrafficAnalyticsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsChannel)
  channel?: AnalyticsChannel;
}

// ===== Response DTOs =====

/**
 * Count by key response
 */
export interface CountByKeyResponse {
  key: string;
  count: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  bucket: string;
  count: number;
}

/**
 * Time series with dimension
 */
export interface TimeSeriesDimensionDataPoint {
  bucket: string;
  dimension: string;
  count: number;
}

/**
 * Overview Stats Response
 */
export interface OverviewStatsResponse {
  totalContacts: number;
  totalMessages: number;
  totalCampaigns: number;
  totalWorkflows: number;
  totalSequences: number;
  eventsByType: CountByKeyResponse[];
  recentActivity: TimeSeriesDataPoint[];
}

/**
 * Messages Analytics Response
 */
export interface MessagesAnalyticsResponse {
  totalSent: number;
  totalReceived: number;
  byChannel: CountByKeyResponse[];
  byDirection: CountByKeyResponse[];
  timeSeries: TimeSeriesDimensionDataPoint[];
}

/**
 * Campaign Analytics Response
 */
export interface CampaignAnalyticsResponse {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byStatus: CountByKeyResponse[];
  timeSeries: TimeSeriesDataPoint[];
}

/**
 * Workflow Analytics Response
 */
export interface WorkflowAnalyticsResponse {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number;
  byStatus: CountByKeyResponse[];
  timeSeries: TimeSeriesDataPoint[];
}

/**
 * Sequence Analytics Response
 */
export interface SequenceAnalyticsResponse {
  totalEnrolled: number;
  totalCompleted: number;
  totalStepsCompleted: number;
  completionRate: number;
  byStatus: CountByKeyResponse[];
  timeSeries: TimeSeriesDataPoint[];
}

/**
 * Template Analytics Response
 */
export interface TemplateAnalyticsResponse {
  totalUsed: number;
  byTemplate: CountByKeyResponse[];
  byChannel: CountByKeyResponse[];
  timeSeries: TimeSeriesDataPoint[];
}

/**
 * Traffic Analytics Response
 */
export interface TrafficAnalyticsResponse {
  totalEvents: number;
  byChannel: CountByKeyResponse[];
  byEventType: CountByKeyResponse[];
  timeSeries: TimeSeriesDataPoint[];
}

/**
 * API Response Wrapper
 */
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    from: string;
    to: string;
    timezone: string;
    granularity: string;
    generatedAt: string;
  };
}

/**
 * Query time range with defaults
 */
export interface QueryTimeRange {
  from: Date;
  to: Date;
  timezone: string;
  granularity: TimeGranularity;
}
