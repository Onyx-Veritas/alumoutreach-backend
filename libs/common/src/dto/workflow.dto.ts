import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum WorkflowTriggerType {
  INCOMING_WHATSAPP = 'incoming_whatsapp',
  INCOMING_EMAIL = 'incoming_email',
  INCOMING_SMS = 'incoming_sms',
  FORM_SUBMISSION = 'form_submission',
  EVENT_RSVP = 'event_rsvp',
  EVENT_CHECKIN = 'event_checkin',
  NEW_DONATION = 'new_donation',
  PROFILE_UPDATE = 'profile_update',
  CAMPAIGN_INTERACTION = 'campaign_interaction',
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
}

export enum WorkflowNodeType {
  TRIGGER = 'trigger',
  SEND_EMAIL = 'send_email',
  SEND_WHATSAPP = 'send_whatsapp',
  SEND_SMS = 'send_sms',
  SEND_PUSH = 'send_push',
  DELAY = 'delay',
  CONDITION = 'condition',
  SPLIT = 'split',
  UPDATE_ATTRIBUTE = 'update_attribute',
  ADD_TAG = 'add_tag',
  REMOVE_TAG = 'remove_tag',
  ADD_TO_SEGMENT = 'add_to_segment',
  REMOVE_FROM_SEGMENT = 'remove_from_segment',
  ASSIGN_AGENT = 'assign_agent',
  ASSIGN_DEPARTMENT = 'assign_department',
  WEBHOOK = 'webhook',
  AI_INTENT = 'ai_intent',
  AI_SENTIMENT = 'ai_sentiment',
  END = 'end',
}

export class WorkflowNodePositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class WorkflowNodeDto {
  @IsString()
  id: string;

  @IsEnum(WorkflowNodeType)
  type: WorkflowNodeType;

  @IsString()
  label: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowNodePositionDto)
  position?: WorkflowNodePositionDto;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nextNodes?: string[];
}

export class WorkflowEdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class WorkflowTriggerDto {
  @IsEnum(WorkflowTriggerType)
  type: WorkflowTriggerType;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger: WorkflowTriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges: WorkflowEdgeDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  folder?: string;
}

export class UpdateWorkflowDto extends CreateWorkflowDto {
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;
}

export class WorkflowResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  trigger: WorkflowTriggerDto;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
  status: WorkflowStatus;
  version: number;
  stats: {
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  };
  tags: string[];
  folder?: string;
  createdBy: string;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowExecutionDto {
  id: string;
  workflowId: string;
  contactId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  logs: Array<{
    nodeId: string;
    status: string;
    timestamp: Date;
    data?: any;
  }>;
}
