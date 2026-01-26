import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsDateString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateChannel } from './template.dto';

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum CampaignType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
  TRIGGERED = 'triggered',
}

export class CampaignChannelConfigDto {
  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsObject()
  fallback?: {
    channel: TemplateChannel;
    templateId: string;
    delayMinutes: number;
  };
}

export class CampaignScheduleDto {
  @IsOptional()
  @IsDateString()
  sendAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    endDate?: string;
  };

  @IsOptional()
  @IsBoolean()
  respectQuietHours?: boolean;

  @IsOptional()
  @IsBoolean()
  smartSend?: boolean;
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CampaignType)
  type: CampaignType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignChannelConfigDto)
  channels: CampaignChannelConfigDto[];

  @IsString()
  segmentId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignScheduleDto)
  schedule?: CampaignScheduleDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsObject()
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

export class UpdateCampaignDto extends CreateCampaignDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

export class CampaignResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  channels: CampaignChannelConfigDto[];
  segmentId: string;
  audienceCount: number;
  schedule?: CampaignScheduleDto;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    unsubscribed: number;
  };
  tags: string[];
  department?: string;
  createdBy: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CampaignAnalyticsDto {
  campaignId: string;
  period: string;
  metrics: {
    sent: number;
    delivered: number;
    deliveryRate: number;
    opened: number;
    openRate: number;
    clicked: number;
    clickRate: number;
    failed: number;
    failureRate: number;
    unsubscribed: number;
  };
  channelBreakdown: Record<string, {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
  }>;
  timeline: Array<{
    timestamp: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}
