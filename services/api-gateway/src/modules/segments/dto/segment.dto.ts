import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
  IsObject,
  Length,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  SegmentType,
  SegmentStatus,
  SegmentRules,
  SegmentRule,
  SegmentRuleGroup,
  RuleOperator,
} from '../entities/segment.entity';
import { MemberSource } from '../entities/segment-member.entity';

// ============ Rule DTOs ============

export class SegmentRuleDto implements SegmentRule {
  @ApiProperty({ description: 'Field to evaluate (e.g., email, tags, attributes.customField)' })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: [
      'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
      'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between',
      'is_null', 'is_not_null', 'has_tag', 'has_any_tag', 'has_all_tags',
      'has_attribute', 'has_event', 'event_count_gte', 'event_count_lte',
    ],
  })
  @IsString()
  operator: RuleOperator;

  @ApiProperty({ description: 'Value to compare against' })
  value: unknown;
}

export class SegmentRuleGroupDto implements SegmentRuleGroup {
  @ApiProperty({ enum: ['AND', 'OR'], description: 'Logic operator for combining rules' })
  @IsEnum(['AND', 'OR'])
  logic: 'AND' | 'OR';

  @ApiProperty({ type: [SegmentRuleDto], description: 'Rules or nested groups' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  rules: Array<SegmentRule | SegmentRuleGroup>;
}

export class SegmentRulesDto implements SegmentRules {
  @ApiProperty({ enum: ['AND', 'OR'], description: 'Top-level logic operator' })
  @IsEnum(['AND', 'OR'])
  logic: 'AND' | 'OR';

  @ApiProperty({ type: [SegmentRuleGroupDto], description: 'Rule groups' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleGroupDto)
  groups: Array<SegmentRule | SegmentRuleGroup>;
}

// ============ Event Config DTO ============

export class EventConfigDto {
  @ApiProperty({ description: 'Event type to trigger on' })
  @IsString()
  eventType: string;

  @ApiPropertyOptional({ type: [SegmentRuleDto], description: 'Additional conditions' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  conditions?: SegmentRuleDto[];
}

// ============ Create Segment DTO ============

export class CreateSegmentDto {
  @ApiProperty({ description: 'Segment name' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Segment description' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiProperty({ enum: SegmentType, description: 'Segment type' })
  @IsEnum(SegmentType)
  type: SegmentType;

  @ApiPropertyOptional({ type: SegmentRulesDto, description: 'Rules for dynamic segments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentRulesDto)
  rules?: SegmentRulesDto;

  @ApiPropertyOptional({ type: EventConfigDto, description: 'Event config for event-driven segments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventConfigDto)
  eventConfig?: EventConfigDto;

  @ApiPropertyOptional({ description: 'Folder for organization' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  folder?: string;

  @ApiPropertyOptional({ type: [String], description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Color for UI (hex)' })
  @IsOptional()
  @IsString()
  @Length(7, 7)
  color?: string;

  @ApiPropertyOptional({ description: 'Refresh interval in minutes for dynamic segments' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10080) // Max 1 week
  refreshIntervalMinutes?: number;

  @ApiPropertyOptional({ description: 'Custom metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============ Update Segment DTO ============

export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {
  @ApiPropertyOptional({ enum: SegmentStatus, description: 'Segment status' })
  @IsOptional()
  @IsEnum(SegmentStatus)
  status?: SegmentStatus;
}

// ============ Add Members DTO ============

export class AddMembersDto {
  @ApiProperty({ type: [String], description: 'Contact IDs to add' })
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];

  @ApiPropertyOptional({ enum: MemberSource, description: 'Source of addition' })
  @IsOptional()
  @IsEnum(MemberSource)
  source?: MemberSource;
}

// ============ Remove Members DTO ============

export class RemoveMembersDto {
  @ApiProperty({ type: [String], description: 'Contact IDs to remove' })
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];
}

// ============ Preview DTO ============

export class PreviewSegmentDto {
  @ApiPropertyOptional({ type: SegmentRulesDto, description: 'Rules to preview (overrides segment rules)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentRulesDto)
  rules?: SegmentRulesDto;

  @ApiPropertyOptional({ description: 'Limit preview results', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============ Search DTO ============

export class SegmentSearchDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: SegmentType, description: 'Filter by type' })
  @IsOptional()
  @IsEnum(SegmentType)
  type?: SegmentType;

  @ApiPropertyOptional({ enum: SegmentStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(SegmentStatus)
  status?: SegmentStatus;

  @ApiPropertyOptional({ description: 'Filter by folder' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ type: [String], description: 'Filter by tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by minimum member count' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minMembers?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum member count' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxMembers?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

// ============ Member Search DTO ============

export class MemberSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'addedAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

// ============ Response DTOs ============

export class SegmentMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty({ enum: MemberSource })
  source: MemberSource;

  @ApiProperty()
  addedAt: Date;

  @ApiPropertyOptional()
  addedBy?: string;

  @ApiPropertyOptional()
  computedAt?: Date;
}

export class SegmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: SegmentType })
  type: SegmentType;

  @ApiProperty({ enum: SegmentStatus })
  status: SegmentStatus;

  @ApiPropertyOptional({ type: SegmentRulesDto })
  rules?: SegmentRulesDto;

  @ApiPropertyOptional({ type: EventConfigDto })
  eventConfig?: EventConfigDto;

  @ApiPropertyOptional()
  folder?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiPropertyOptional()
  color?: string;

  @ApiProperty()
  memberCount: number;

  @ApiPropertyOptional()
  lastComputedAt?: Date;

  @ApiPropertyOptional()
  computationDurationMs?: number;

  @ApiPropertyOptional()
  refreshIntervalMinutes?: number;

  @ApiPropertyOptional()
  nextRefreshAt?: Date;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SegmentPreviewResponseDto {
  @ApiProperty()
  segmentId: string;

  @ApiProperty()
  totalMatches: number;

  @ApiProperty({ type: [Object], description: 'Preview of matching contacts' })
  contacts: Array<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;

  @ApiProperty()
  queryDurationMs: number;

  @ApiProperty()
  rulesApplied: SegmentRulesDto;
}

export class SegmentStatsResponseDto {
  @ApiProperty()
  segmentId: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  addedToday: number;

  @ApiProperty()
  addedThisWeek: number;

  @ApiProperty()
  addedThisMonth: number;

  @ApiProperty()
  removedToday: number;

  @ApiProperty()
  removedThisWeek: number;

  @ApiProperty()
  removedThisMonth: number;

  @ApiPropertyOptional()
  lastRefreshAt?: Date;

  @ApiPropertyOptional()
  lastRefreshDurationMs?: number;
}

export class RecomputeResponseDto {
  @ApiProperty()
  segmentId: string;

  @ApiProperty()
  previousCount: number;

  @ApiProperty()
  newCount: number;

  @ApiProperty()
  added: number;

  @ApiProperty()
  removed: number;

  @ApiProperty()
  durationMs: number;

  @ApiProperty()
  batchId: string;
}

// ============ Pagination ============

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

export class PaginatedSegmentsResponseDto {
  @ApiProperty({ type: [SegmentResponseDto] })
  data: SegmentResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}

export class PaginatedMembersResponseDto {
  @ApiProperty({ type: [SegmentMemberResponseDto] })
  data: SegmentMemberResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}
