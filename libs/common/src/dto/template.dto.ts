import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';

export enum TemplateChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  RCS = 'rcs',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export enum TemplateCategory {
  UTILITY = 'utility',
  MARKETING = 'marketing',
  LIFECYCLE = 'lifecycle',
  DONOR = 'donor',
  EVENT = 'event',
  PLACEMENT = 'placement',
  SCHOLAR = 'scholar',
  INTERNAL = 'internal',
}

export enum TemplateStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export class TemplateVariableDto {
  name: string;
  type: 'text' | 'number' | 'date' | 'url' | 'dynamic';
  defaultValue?: string;
  required: boolean;
}

export class EmailTemplateContentDto {
  @IsString()
  subject: string;

  @IsString()
  htmlBody: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsString()
  preheader?: string;
}

export class WhatsAppTemplateContentDto {
  @IsOptional()
  @IsObject()
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    content: string;
  };

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  @IsArray()
  buttons?: Array<{
    type: 'url' | 'phone' | 'quick_reply';
    text: string;
    value?: string;
  }>;
}

export class SmsTemplateContentDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  dltTemplateId?: string;

  @IsOptional()
  @IsString()
  senderId?: string;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @IsObject()
  content: EmailTemplateContentDto | WhatsAppTemplateContentDto | SmsTemplateContentDto;

  @IsOptional()
  @IsArray()
  variables?: TemplateVariableDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  folder?: string;
}

export class UpdateTemplateDto extends CreateTemplateDto {
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;
}

export class TemplateResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  content: any;
  variables: TemplateVariableDto[];
  status: TemplateStatus;
  version: number;
  tags: string[];
  folder?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class RenderTemplateDto {
  @IsString()
  templateId: string;

  @IsObject()
  variables: Record<string, any>;
}
