import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import {
  WorkflowTriggerType,
  WorkflowRunStatus,
  WorkflowNodeType,
  WorkflowNodeRunStatus,
  ConditionOperator,
  DelayUnit,
  MessageChannel,
} from '../entities/workflow.enums';

// ============ Node Config DTOs ============

export class SendMessageNodeConfigDto {
  @ApiProperty({ enum: MessageChannel })
  @IsEnum(MessageChannel)
  channel: MessageChannel;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class ConditionBranchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: ConditionOperator })
  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @ApiPropertyOptional()
  @IsOptional()
  value?: unknown;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nextNodeId: string;
}

export class ConditionNodeConfigDto {
  @ApiProperty({ type: [ConditionBranchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionBranchDto)
  @ArrayMinSize(1)
  conditions: ConditionBranchDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultNextNodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['any', 'all'])
  matchType?: 'any' | 'all';
}

export class DelayNodeConfigDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(365)
  duration: number;

  @ApiProperty({ enum: DelayUnit })
  @IsEnum(DelayUnit)
  unit: DelayUnit;
}

export class UpdateAttributeNodeConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  attributeName: string;

  @ApiProperty()
  @IsNotEmpty()
  attributeValue: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['set', 'append', 'remove', 'increment'])
  operation?: 'set' | 'append' | 'remove' | 'increment';
}

export class AssignAgentNodeConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['round_robin', 'least_busy', 'random'])
  assignmentStrategy?: 'round_robin' | 'least_busy' | 'random';
}

// ============ Graph DTOs ============

export class NodePositionDto {
  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;
}

export class WorkflowNodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ enum: WorkflowNodeType })
  @IsEnum(WorkflowNodeType)
  type: WorkflowNodeType;

  @ApiProperty({ type: NodePositionDto })
  @ValidateNested()
  @Type(() => NodePositionDto)
  position: NodePositionDto;

  @ApiProperty()
  @IsObject()
  data: Record<string, unknown>;
}

export class WorkflowEdgeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetHandle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ViewportDto {
  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.1)
  @Max(2)
  zoom: number;
}

export class WorkflowGraphDto {
  @ApiProperty({ type: [WorkflowNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes: WorkflowNodeDto[];

  @ApiProperty({ type: [WorkflowEdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges: WorkflowEdgeDto[];

  @ApiPropertyOptional({ type: ViewportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ViewportDto)
  viewport?: ViewportDto;
}

// ============ Trigger Config DTOs ============

export class TriggerConditionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ enum: ConditionOperator })
  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @ApiPropertyOptional()
  @IsOptional()
  value?: unknown;
}

export class TriggerConfigDto {
  // For INCOMING_MESSAGE
  @ApiPropertyOptional({ type: [String], enum: MessageChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MessageChannel, { each: true })
  channels?: MessageChannel[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ enum: ['any', 'all', 'exact'] })
  @IsOptional()
  @IsIn(['any', 'all', 'exact'])
  matchType?: 'any' | 'all' | 'exact';

  // For EVENT_BASED
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ type: [TriggerConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TriggerConditionDto)
  conditions?: TriggerConditionDto[];

  // For TIME_BASED
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  segmentId?: string;
}

// ============ Create/Update Workflow DTOs ============

export class CreateWorkflowDto {
  @ApiProperty({ example: 'Welcome Workflow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Sends welcome messages to new contacts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: WorkflowTriggerType })
  @IsEnum(WorkflowTriggerType)
  triggerType: WorkflowTriggerType;

  @ApiPropertyOptional({ type: TriggerConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  triggerConfig?: TriggerConfigDto;

  @ApiProperty({ type: WorkflowGraphDto })
  @ValidateNested()
  @Type(() => WorkflowGraphDto)
  graph: WorkflowGraphDto;
}

export class UpdateWorkflowDto extends PartialType(
  OmitType(CreateWorkflowDto, ['triggerType'] as const),
) {
  @ApiPropertyOptional({ enum: WorkflowTriggerType })
  @IsOptional()
  @IsEnum(WorkflowTriggerType)
  triggerType?: WorkflowTriggerType;
}

// ============ Workflow Response DTOs ============

export class WorkflowSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: WorkflowTriggerType })
  triggerType: WorkflowTriggerType;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiProperty()
  totalRuns: number;

  @ApiProperty()
  successfulRuns: number;

  @ApiProperty()
  failedRuns: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkflowResponseDto extends WorkflowSummaryResponseDto {
  @ApiPropertyOptional()
  triggerConfig?: TriggerConfigDto;

  @ApiProperty()
  graph: WorkflowGraphDto;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  publishedBy?: string;
}

// ============ Workflow Run DTOs ============

export class TriggerWorkflowDto {
  @ApiProperty()
  @IsUUID()
  contactId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class PreviewWorkflowDto {
  @ApiProperty()
  @IsUUID()
  contactId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  mockEventPayload?: Record<string, unknown>;
}

export class WorkflowRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workflowId: string;

  @ApiPropertyOptional()
  contactId?: string;

  @ApiProperty({ enum: WorkflowRunStatus })
  status: WorkflowRunStatus;

  @ApiPropertyOptional()
  currentNodeId?: string;

  @ApiPropertyOptional()
  context?: Record<string, unknown>;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkflowNodeRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nodeId: string;

  @ApiProperty({ enum: WorkflowNodeType })
  nodeType: WorkflowNodeType;

  @ApiProperty({ enum: WorkflowNodeRunStatus })
  status: WorkflowNodeRunStatus;

  @ApiPropertyOptional()
  input?: Record<string, unknown>;

  @ApiPropertyOptional()
  result?: Record<string, unknown>;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiPropertyOptional()
  executedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class WorkflowRunDetailResponseDto extends WorkflowRunResponseDto {
  @ApiProperty({ type: [WorkflowNodeRunResponseDto] })
  nodeRuns: WorkflowNodeRunResponseDto[];
}

// ============ List Query DTOs ============

export class ListWorkflowsQueryDto {
  @ApiPropertyOptional({ enum: WorkflowTriggerType })
  @IsOptional()
  @IsEnum(WorkflowTriggerType)
  triggerType?: WorkflowTriggerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'name'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ListWorkflowRunsQueryDto {
  @ApiPropertyOptional({ enum: WorkflowRunStatus })
  @IsOptional()
  @IsEnum(WorkflowRunStatus)
  status?: WorkflowRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

// ============ Paginated Response DTO ============

export class PaginatedWorkflowsResponseDto {
  @ApiProperty({ type: [WorkflowSummaryResponseDto] })
  data: WorkflowSummaryResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedWorkflowRunsResponseDto {
  @ApiProperty({ type: [WorkflowRunResponseDto] })
  data: WorkflowRunResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
