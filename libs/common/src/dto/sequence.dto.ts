import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SequenceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum SequenceStepType {
  SEND_EMAIL = 'send_email',
  SEND_WHATSAPP = 'send_whatsapp',
  SEND_SMS = 'send_sms',
  SEND_PUSH = 'send_push',
  DELAY = 'delay',
  CONDITION = 'condition',
  UPDATE_ATTRIBUTE = 'update_attribute',
  ADD_TAG = 'add_tag',
  EXIT = 'exit',
}

export enum DelayUnit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
  WEEKS = 'weeks',
}

export class SequenceStepDto {
  @IsString()
  id: string;

  @IsEnum(SequenceStepType)
  type: SequenceStepType;

  @IsString()
  label: string;

  @IsNumber()
  order: number;

  @IsOptional()
  @IsObject()
  config?: {
    templateId?: string;
    delayValue?: number;
    delayUnit?: DelayUnit;
    condition?: {
      field: string;
      operator: string;
      value: any;
    };
    attribute?: {
      name: string;
      value: any;
    };
    tag?: string;
  };

  @IsOptional()
  @IsString()
  nextStepId?: string;

  @IsOptional()
  @IsString()
  falseStepId?: string;
}

export class SequenceEntryRulesDto {
  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @IsObject()
  trigger?: {
    type: string;
    config?: Record<string, any>;
  };

  @IsOptional()
  @IsString()
  reEntryBehavior?: 'allow' | 'skip' | 'restart';
}

export class SequenceExitRulesDto {
  @IsOptional()
  @IsArray()
  exitOnEvents?: string[];

  @IsOptional()
  @IsObject()
  exitCondition?: {
    field: string;
    operator: string;
    value: any;
  };
}

export class CreateSequenceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SequenceStepDto)
  steps: SequenceStepDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SequenceEntryRulesDto)
  entryRules?: SequenceEntryRulesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SequenceExitRulesDto)
  exitRules?: SequenceExitRulesDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  folder?: string;
}

export class UpdateSequenceDto extends CreateSequenceDto {
  @IsOptional()
  @IsEnum(SequenceStatus)
  status?: SequenceStatus;
}

export class SequenceResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  steps: SequenceStepDto[];
  entryRules?: SequenceEntryRulesDto;
  exitRules?: SequenceExitRulesDto;
  status: SequenceStatus;
  stats: {
    activeContacts: number;
    completedContacts: number;
    exitedContacts: number;
    conversionRate: number;
  };
  tags: string[];
  folder?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SequenceEnrollmentDto {
  id: string;
  sequenceId: string;
  contactId: string;
  status: 'active' | 'completed' | 'exited' | 'paused';
  currentStepId?: string;
  enrolledAt: Date;
  completedAt?: Date;
  exitedAt?: Date;
  exitReason?: string;
}
