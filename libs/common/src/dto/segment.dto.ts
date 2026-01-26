import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SegmentType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  EVENT_BASED = 'event_based',
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  BETWEEN = 'between',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  BEFORE = 'before',
  AFTER = 'after',
  WITHIN_LAST = 'within_last',
}

export enum FilterLogic {
  AND = 'and',
  OR = 'or',
}

export class SegmentFilterDto {
  @IsString()
  field: string;

  @IsEnum(FilterOperator)
  operator: FilterOperator;

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsString()
  category?: string; // identity, academic, professional, engagement, etc.
}

export class SegmentFilterGroupDto {
  @IsEnum(FilterLogic)
  logic: FilterLogic;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentFilterDto)
  filters: SegmentFilterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentFilterGroupDto)
  groups?: SegmentFilterGroupDto[];
}

export class CreateSegmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SegmentType)
  type: SegmentType;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentFilterGroupDto)
  rules?: SegmentFilterGroupDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  staticContactIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  folder?: string;
}

export class UpdateSegmentDto extends CreateSegmentDto {}

export class SegmentResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: SegmentType;
  rules?: SegmentFilterGroupDto;
  contactCount: number;
  lastComputedAt?: Date;
  tags: string[];
  folder?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SegmentPreviewDto {
  @ValidateNested()
  @Type(() => SegmentFilterGroupDto)
  rules: SegmentFilterGroupDto;

  @IsOptional()
  limit?: number;
}

export class SegmentPreviewResponseDto {
  totalCount: number;
  sampleContacts: Array<{
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
  }>;
  channelBreakdown: {
    email: number;
    whatsapp: number;
    sms: number;
  };
}
