import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PipelineJobStatus, PipelineChannel } from '../entities/pipeline.enums';

// ============ Search DTOs ============

export class PipelineJobSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by campaign ID' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Filter by campaign run ID' })
  @IsOptional()
  @IsUUID()
  campaignRunId?: string;

  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: PipelineJobStatus })
  @IsOptional()
  @IsEnum(PipelineJobStatus)
  status?: PipelineJobStatus;

  @ApiPropertyOptional({ description: 'Filter by channel', enum: PipelineChannel })
  @IsOptional()
  @IsEnum(PipelineChannel)
  channel?: PipelineChannel;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class PipelineFailureSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by campaign ID' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Filter by job ID' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// ============ Response DTOs ============

export class PipelineJobResponseDto {
  @ApiProperty({ description: 'Job ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Campaign ID' })
  campaignId: string;

  @ApiProperty({ description: 'Campaign Run ID' })
  campaignRunId: string;

  @ApiProperty({ description: 'Contact ID' })
  contactId: string;

  @ApiPropertyOptional({ description: 'Template Version ID' })
  templateVersionId?: string;

  @ApiProperty({ description: 'Channel', enum: PipelineChannel })
  channel: PipelineChannel;

  @ApiPropertyOptional({ description: 'Payload data' })
  payload?: Record<string, unknown>;

  @ApiProperty({ description: 'Job status', enum: PipelineJobStatus })
  status: PipelineJobStatus;

  @ApiProperty({ description: 'Retry count' })
  retryCount: number;

  @ApiPropertyOptional({ description: 'Next attempt timestamp' })
  nextAttemptAt?: Date;

  @ApiPropertyOptional({ description: 'Error message' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Provider message ID' })
  providerMessageId?: string;

  @ApiPropertyOptional({ description: 'Sent timestamp' })
  sentAt?: Date;

  @ApiPropertyOptional({ description: 'Delivered timestamp' })
  deliveredAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class PipelineFailureResponseDto {
  @ApiProperty({ description: 'Failure ID' })
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiPropertyOptional({ description: 'Campaign ID' })
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Contact ID' })
  contactId?: string;

  @ApiProperty({ description: 'Error message' })
  errorMessage: string;

  @ApiProperty({ description: 'Last status', enum: PipelineJobStatus })
  lastStatus: PipelineJobStatus;

  @ApiProperty({ description: 'Retry count' })
  retryCount: number;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;
}

// ============ Paginated Response DTOs ============

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

export class PaginatedPipelineJobsResponseDto {
  @ApiProperty({ type: [PipelineJobResponseDto] })
  data: PipelineJobResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}

export class PaginatedPipelineFailuresResponseDto {
  @ApiProperty({ type: [PipelineFailureResponseDto] })
  data: PipelineFailureResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}

// ============ Job Stats DTO ============

export class PipelineJobStatsDto {
  @ApiProperty({ description: 'Total jobs' })
  total: number;

  @ApiProperty({ description: 'Pending jobs' })
  pending: number;

  @ApiProperty({ description: 'Processing jobs' })
  processing: number;

  @ApiProperty({ description: 'Sent jobs' })
  sent: number;

  @ApiProperty({ description: 'Delivered jobs' })
  delivered: number;

  @ApiProperty({ description: 'Failed jobs' })
  failed: number;

  @ApiProperty({ description: 'Retrying jobs' })
  retrying: number;

  @ApiProperty({ description: 'Dead jobs' })
  dead: number;
}

// ============ Retry Response DTO ============

export class RetryJobResponseDto {
  @ApiProperty({ description: 'Whether retry was initiated' })
  success: boolean;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'New status' })
  newStatus: PipelineJobStatus;

  @ApiProperty({ description: 'Message' })
  message: string;
}
