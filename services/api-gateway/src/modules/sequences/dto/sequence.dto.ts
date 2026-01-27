import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsObject,
  IsNotEmpty,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  SequenceType,
  SequenceStepType,
  SequenceRunStatus,
  DelayUnit,
  ConditionOperator,
  MessageChannel,
  SequenceExitReason,
} from '../entities/sequence.enums';

// ============================================================================
// Trigger Config DTOs
// ============================================================================

export class TriggerConditionDto {
  @ApiProperty({ description: 'Field to evaluate' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ description: 'Comparison operator' })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ description: 'Value to compare against' })
  value: unknown;
}

export class TriggerConfigDto {
  @ApiPropertyOptional({ description: 'Event types that trigger enrollment', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ description: 'Additional conditions', type: [TriggerConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TriggerConditionDto)
  conditions?: TriggerConditionDto[];

  @ApiPropertyOptional({ description: 'Segment IDs to filter contacts', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  segmentIds?: string[];

  @ApiPropertyOptional({ description: 'Required tags for triggering', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredTags?: string[];

  @ApiPropertyOptional({ description: 'Prevent re-enrollment if already completed' })
  @IsOptional()
  @IsBoolean()
  preventReEnrollment?: boolean;

  @ApiPropertyOptional({ description: 'Maximum enrollments per contact' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxEnrollmentsPerContact?: number;
}

// ============================================================================
// Step Config DTOs
// ============================================================================

export class SendMessageStepConfigDto {
  @ApiProperty({ description: 'Template ID to use for message' })
  @IsUUID('4')
  templateId: string;

  @ApiProperty({ enum: MessageChannel, description: 'Channel to send message on' })
  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @ApiPropertyOptional({ description: 'Delay in seconds before sending' })
  @IsOptional()
  @IsInt()
  @Min(0)
  delaySeconds?: number;

  @ApiPropertyOptional({ description: 'Custom variables to merge' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class DelayStepConfigDto {
  @ApiProperty({ description: 'Duration of delay' })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ enum: DelayUnit, description: 'Unit of delay' })
  @IsEnum(DelayUnit)
  unit: DelayUnit;
}

export class ConditionRuleDto {
  @ApiProperty({ description: 'Field to evaluate' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: ConditionOperator, description: 'Comparison operator' })
  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @ApiProperty({ description: 'Value to compare against' })
  value: unknown;

  @ApiPropertyOptional({ description: 'Segment ID for segment-based conditions' })
  @IsOptional()
  @IsUUID('4')
  segmentId?: string;
}

export class ConditionStepConfigDto {
  @ApiProperty({ description: 'Condition rules to evaluate', type: [ConditionRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionRuleDto)
  rules: ConditionRuleDto[];

  @ApiProperty({ enum: ['AND', 'OR'], description: 'Logical operator to combine rules' })
  @IsString()
  logicalOperator: 'AND' | 'OR';

  @ApiPropertyOptional({ description: 'Step ID to go to if condition is true' })
  @IsOptional()
  @IsUUID('4')
  trueStepId?: string | null;

  @ApiPropertyOptional({ description: 'Step ID to go to if condition is false' })
  @IsOptional()
  @IsUUID('4')
  falseStepId?: string | null;

  @ApiPropertyOptional({ description: 'Exit sequence if condition is true' })
  @IsOptional()
  @IsBoolean()
  exitOnTrue?: boolean;

  @ApiPropertyOptional({ description: 'Exit sequence if condition is false' })
  @IsOptional()
  @IsBoolean()
  exitOnFalse?: boolean;
}

// ============================================================================
// Step DTOs
// ============================================================================

export class CreateSequenceStepDto {
  @ApiProperty({ description: 'Step number in sequence' })
  @IsInt()
  @Min(1)
  stepNumber: number;

  @ApiPropertyOptional({ description: 'Step name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Step description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SequenceStepType, description: 'Type of step' })
  @IsEnum(SequenceStepType)
  stepType: SequenceStepType;

  @ApiProperty({ description: 'Step configuration based on type' })
  @IsObject()
  config: SendMessageStepConfigDto | DelayStepConfigDto | ConditionStepConfigDto | Record<string, never>;

  @ApiPropertyOptional({ description: 'Next step ID' })
  @IsOptional()
  @IsUUID('4')
  nextStepId?: string | null;
}

export class UpdateSequenceStepDto extends PartialType(CreateSequenceStepDto) {
  @ApiProperty({ description: 'Step ID' })
  @IsUUID('4')
  id: string;
}

export class SequenceStepResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sequenceId: string;

  @ApiProperty()
  stepNumber: number;

  @ApiPropertyOptional()
  name: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: SequenceStepType })
  stepType: SequenceStepType;

  @ApiProperty()
  config: SendMessageStepConfigDto | DelayStepConfigDto | ConditionStepConfigDto | Record<string, never>;

  @ApiPropertyOptional()
  nextStepId: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================================================
// Sequence DTOs
// ============================================================================

export class CreateSequenceDto {
  @ApiProperty({ description: 'Sequence name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Sequence description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SequenceType, description: 'Type of sequence' })
  @IsEnum(SequenceType)
  type: SequenceType;

  @ApiPropertyOptional({ description: 'Trigger configuration', type: TriggerConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  triggerConfig?: TriggerConfigDto;

  @ApiPropertyOptional({ description: 'Steps to create with sequence', type: [CreateSequenceStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSequenceStepDto)
  steps?: CreateSequenceStepDto[];
}

// Use OmitType to exclude both 'type' and 'steps' from CreateSequenceDto, then re-declare steps
export class UpdateSequenceDto extends PartialType(OmitType(CreateSequenceDto, ['type', 'steps'] as const)) {
  @ApiPropertyOptional({ description: 'Steps to update', type: [UpdateSequenceStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSequenceStepDto)
  steps?: UpdateSequenceStepDto[];
}

export class SequenceSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: SequenceType })
  type: SequenceType;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  totalEnrollments: number;

  @ApiProperty()
  completedRuns: number;

  @ApiProperty()
  stepCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SequenceResponseDto extends SequenceSummaryResponseDto {
  @ApiPropertyOptional()
  triggerConfig: TriggerConfigDto | null;

  @ApiPropertyOptional()
  publishedBy: string | null;

  @ApiPropertyOptional()
  createdBy: string | null;

  @ApiPropertyOptional()
  updatedBy: string | null;

  @ApiProperty()
  exitedRuns: number;

  @ApiProperty()
  failedRuns: number;

  @ApiProperty({ type: [SequenceStepResponseDto] })
  steps: SequenceStepResponseDto[];
}

// ============================================================================
// Run DTOs
// ============================================================================

export class StepExecutionRecordDto {
  @ApiProperty()
  stepId: string;

  @ApiProperty()
  stepNumber: number;

  @ApiProperty()
  stepType: string;

  @ApiProperty()
  executedAt: string;

  @ApiProperty()
  durationMs: number;

  @ApiProperty({ enum: ['success', 'failed', 'skipped'] })
  result: 'success' | 'failed' | 'skipped';

  @ApiPropertyOptional()
  output?: Record<string, unknown>;

  @ApiPropertyOptional()
  error?: string;
}

export class SequenceRunContextDto {
  @ApiProperty()
  variables: Record<string, unknown>;

  @ApiProperty({ type: [StepExecutionRecordDto] })
  stepHistory: StepExecutionRecordDto[];

  @ApiPropertyOptional()
  triggerData?: Record<string, unknown>;

  @ApiPropertyOptional()
  error?: {
    stepId: string;
    message: string;
    stack?: string;
    timestamp: string;
  };

  @ApiPropertyOptional()
  exitDetails?: {
    reason: SequenceExitReason;
    stepId?: string;
    message?: string;
    timestamp: string;
  };
}

export class SequenceRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sequenceId: string;

  @ApiProperty()
  contactId: string;

  @ApiPropertyOptional()
  currentStepId: string | null;

  @ApiProperty()
  currentStepNumber: number;

  @ApiProperty({ enum: SequenceRunStatus })
  status: SequenceRunStatus;

  @ApiPropertyOptional()
  nextExecutionAt: Date | null;

  @ApiPropertyOptional({ enum: SequenceExitReason })
  exitReason: SequenceExitReason | null;

  @ApiPropertyOptional()
  startedAt: Date | null;

  @ApiPropertyOptional()
  completedAt: Date | null;

  @ApiPropertyOptional()
  errorMessage: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SequenceRunDetailResponseDto extends SequenceRunResponseDto {
  @ApiProperty({ type: SequenceRunContextDto })
  context: SequenceRunContextDto;

  @ApiPropertyOptional()
  correlationId: string | null;

  @ApiPropertyOptional()
  enrolledBy: string | null;

  @ApiPropertyOptional()
  enrollmentSource: string | null;
}

// ============================================================================
// Query DTOs
// ============================================================================

export class ListSequencesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SequenceType })
  @IsOptional()
  @IsEnum(SequenceType)
  type?: SequenceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'name'], default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ListSequenceRunsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SequenceRunStatus })
  @IsOptional()
  @IsEnum(SequenceRunStatus)
  status?: SequenceRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  contactId?: string;
}

// ============================================================================
// Paginated Response DTOs
// ============================================================================

export class PaginatedSequencesResponseDto {
  @ApiProperty({ type: [SequenceSummaryResponseDto] })
  data: SequenceSummaryResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedSequenceRunsResponseDto {
  @ApiProperty({ type: [SequenceRunResponseDto] })
  data: SequenceRunResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

// ============================================================================
// Action DTOs
// ============================================================================

export class EnrollContactDto {
  @ApiPropertyOptional({ description: 'Custom variables for this enrollment' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Source of enrollment (api, trigger, manual)' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class ExitContactDto {
  @ApiPropertyOptional({ description: 'Reason for exiting' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PreviewSequenceDto {
  @ApiProperty({ description: 'Contact ID to preview for' })
  @IsUUID('4')
  contactId: string;
}

export class PreviewStepResultDto {
  @ApiProperty()
  stepId: string;

  @ApiProperty()
  stepNumber: number;

  @ApiProperty({ enum: SequenceStepType })
  stepType: SequenceStepType;

  @ApiPropertyOptional()
  name: string | null;

  @ApiProperty()
  wouldExecute: boolean;

  @ApiPropertyOptional()
  preview: Record<string, unknown>;
}

export class PreviewSequenceResponseDto {
  @ApiProperty()
  sequenceId: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty({ type: [PreviewStepResultDto] })
  steps: PreviewStepResultDto[];

  @ApiProperty()
  estimatedDuration: string;

  @ApiProperty()
  totalSteps: number;
}
