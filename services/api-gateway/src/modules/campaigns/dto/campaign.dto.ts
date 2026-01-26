import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsObject,
  IsArray,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  CampaignChannel,
  CampaignStatus,
  CampaignRunStatus,
  DispatchStatus,
} from '../entities/campaign.enums';

// ============ Create Campaign DTO ============

export class CreateCampaignDto {
  @ApiProperty({ description: 'Campaign name', example: 'Welcome Email Campaign' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Campaign description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Campaign channel', enum: CampaignChannel })
  @IsEnum(CampaignChannel)
  channel: CampaignChannel;

  @ApiPropertyOptional({ description: 'Template version ID to use' })
  @IsOptional()
  @IsUUID()
  templateVersionId?: string;

  @ApiPropertyOptional({ description: 'Segment ID for audience targeting' })
  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @ApiPropertyOptional({ description: 'Scheduled send time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============ Update Campaign DTO ============

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

// ============ Schedule Campaign DTO ============

export class ScheduleCampaignDto {
  @ApiProperty({ description: 'Scheduled send time (ISO 8601)', example: '2026-02-01T10:00:00Z' })
  @IsDateString()
  scheduleAt: string;
}

// ============ Campaign Preview DTO ============

export class CampaignPreviewDto {
  @ApiPropertyOptional({ description: 'Number of sample contacts to preview', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  sampleSize?: number;
}

// ============ Campaign Search DTO ============

export class CampaignSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by channel', enum: CampaignChannel })
  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @ApiPropertyOptional({ description: 'Filter by status', enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// ============ Message Search DTO ============

export class CampaignMessageSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by dispatch status', enum: DispatchStatus })
  @IsOptional()
  @IsEnum(DispatchStatus)
  dispatchStatus?: DispatchStatus;
}

// ============ Response DTOs ============

export class CampaignResponseDto {
  @ApiProperty({ description: 'Campaign ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Campaign name' })
  name: string;

  @ApiPropertyOptional({ description: 'Campaign description' })
  description?: string;

  @ApiProperty({ description: 'Campaign channel', enum: CampaignChannel })
  channel: CampaignChannel;

  @ApiPropertyOptional({ description: 'Template version ID' })
  templateVersionId?: string;

  @ApiPropertyOptional({ description: 'Segment ID' })
  segmentId?: string;

  @ApiPropertyOptional({ description: 'Scheduled send time' })
  scheduleAt?: Date;

  @ApiProperty({ description: 'Campaign status', enum: CampaignStatus })
  status: CampaignStatus;

  @ApiProperty({ description: 'Total audience count' })
  audienceCount: number;

  @ApiProperty({ description: 'Messages sent' })
  sentCount: number;

  @ApiProperty({ description: 'Messages delivered' })
  deliveredCount: number;

  @ApiProperty({ description: 'Messages failed' })
  failedCount: number;

  @ApiProperty({ description: 'Messages opened' })
  openedCount: number;

  @ApiProperty({ description: 'Messages clicked' })
  clickedCount: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class CampaignRunResponseDto {
  @ApiProperty({ description: 'Run ID' })
  id: string;

  @ApiProperty({ description: 'Campaign ID' })
  campaignId: string;

  @ApiProperty({ description: 'Run status', enum: CampaignRunStatus })
  status: CampaignRunStatus;

  @ApiPropertyOptional({ description: 'Start time' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Completion time' })
  completedAt?: Date;

  @ApiProperty({ description: 'Total recipients' })
  totalRecipients: number;

  @ApiProperty({ description: 'Processed count' })
  processedCount: number;

  @ApiProperty({ description: 'Sent count' })
  sentCount: number;

  @ApiProperty({ description: 'Failed count' })
  failedCount: number;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export class CampaignMessageResponseDto {
  @ApiProperty({ description: 'Message ID' })
  id: string;

  @ApiProperty({ description: 'Campaign ID' })
  campaignId: string;

  @ApiPropertyOptional({ description: 'Run ID' })
  runId?: string;

  @ApiProperty({ description: 'Contact ID' })
  contactId: string;

  @ApiProperty({ description: 'Dispatch status', enum: DispatchStatus })
  dispatchStatus: DispatchStatus;

  @ApiPropertyOptional({ description: 'Provider message ID' })
  providerMessageId?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  dispatchError?: string;

  @ApiPropertyOptional({ description: 'Sent timestamp' })
  sentAt?: Date;

  @ApiPropertyOptional({ description: 'Delivered timestamp' })
  deliveredAt?: Date;

  @ApiPropertyOptional({ description: 'Opened timestamp' })
  openedAt?: Date;

  @ApiPropertyOptional({ description: 'Clicked timestamp' })
  clickedAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

export class CampaignPreviewResponseDto {
  @ApiProperty({ description: 'Campaign ID' })
  campaignId: string;

  @ApiProperty({ description: 'Total audience count' })
  totalAudienceCount: number;

  @ApiProperty({ description: 'Sample contacts' })
  sampleContacts: Array<{
    id: string;
    email?: string;
    phone?: string;
    fullName: string;
  }>;

  @ApiPropertyOptional({ description: 'Rendered template preview' })
  templatePreview?: Record<string, unknown>;
}

// ============ Pagination Meta ============

export class PaginationMeta {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

export class PaginatedCampaignsResponseDto {
  @ApiProperty({ type: [CampaignResponseDto] })
  data: CampaignResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [CampaignMessageResponseDto] })
  data: CampaignMessageResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}
