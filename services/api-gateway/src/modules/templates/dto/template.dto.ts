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
  TemplateChannel,
  TemplateCategory,
  ApprovalStatus,
  TemplateStatus,
} from '../entities/template.entity';
import {
  EmailContent,
  SmsContent,
  WhatsAppContent,
  PushContent,
  RcsContent,
} from '../entities/template-version.entity';

// ============ Content DTOs ============

export class EmailContentDto implements EmailContent {
  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  @Length(1, 998)
  subject: string;

  @ApiProperty({ description: 'HTML body content' })
  @IsString()
  htmlBody: string;

  @ApiPropertyOptional({ description: 'Plain text body' })
  @IsOptional()
  @IsString()
  textBody?: string;

  @ApiPropertyOptional({ description: 'Email preheader text' })
  @IsOptional()
  @IsString()
  @Length(0, 250)
  preheader?: string;

  @ApiPropertyOptional({ description: 'Reply-to email address' })
  @IsOptional()
  @IsString()
  replyTo?: string;

  @ApiPropertyOptional({ description: 'From name' })
  @IsOptional()
  @IsString()
  fromName?: string;
}

export class SmsContentDto implements SmsContent {
  @ApiProperty({ description: 'SMS body text' })
  @IsString()
  @Length(1, 1600)
  body: string;

  @ApiPropertyOptional({ description: 'Sender ID' })
  @IsOptional()
  @IsString()
  @Length(1, 11)
  senderId?: string;
}

export class WhatsAppHeaderDto {
  @ApiProperty({ enum: ['text', 'image', 'document', 'video'] })
  @IsEnum(['text', 'image', 'document', 'video'])
  type: 'text' | 'image' | 'document' | 'video';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;
}

export class WhatsAppButtonDto {
  @ApiProperty({ enum: ['quick_reply', 'url', 'phone_number', 'copy_code'] })
  @IsEnum(['quick_reply', 'url', 'phone_number', 'copy_code'])
  type: 'quick_reply' | 'url' | 'phone_number' | 'copy_code';

  @ApiProperty()
  @IsString()
  @Length(1, 25)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  example?: string[];
}

export class WhatsAppContentDto implements WhatsAppContent {
  @ApiProperty({ description: 'WhatsApp template name (as registered)' })
  @IsString()
  @Length(1, 512)
  templateName: string;

  @ApiProperty({ description: 'Language code (e.g., en, en_US)' })
  @IsString()
  @Length(2, 10)
  language: string;

  @ApiPropertyOptional({ type: WhatsAppHeaderDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppHeaderDto)
  header?: WhatsAppHeaderDto;

  @ApiProperty({ description: 'Message body (max 1024 chars)' })
  @IsString()
  @Length(1, 1024)
  body: string;

  @ApiPropertyOptional({ description: 'Footer text (max 60 chars)' })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  footer?: string;

  @ApiPropertyOptional({ type: [WhatsAppButtonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppButtonDto)
  buttons?: WhatsAppButtonDto[];
}

export class PushContentDto implements PushContent {
  @ApiProperty({ description: 'Push notification title' })
  @IsString()
  @Length(1, 65)
  title: string;

  @ApiProperty({ description: 'Push notification body' })
  @IsString()
  @Length(1, 240)
  body: string;

  @ApiPropertyOptional({ description: 'Icon URL' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Badge URL' })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({ description: 'Click action URL' })
  @IsOptional()
  @IsString()
  clickAction?: string;

  @ApiPropertyOptional({ description: 'Custom data payload' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}

export class RcsSuggestionDto {
  @ApiProperty({ enum: ['reply', 'action'] })
  @IsEnum(['reply', 'action'])
  type: 'reply' | 'action';

  @ApiProperty()
  @IsString()
  @Length(1, 25)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postbackData?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class RcsCardDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: ['short', 'medium', 'tall'] })
  @IsOptional()
  @IsEnum(['short', 'medium', 'tall'])
  mediaHeight?: 'short' | 'medium' | 'tall';

  @ApiPropertyOptional({ type: [RcsSuggestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RcsSuggestionDto)
  suggestions?: RcsSuggestionDto[];
}

export class RcsContentDto implements RcsContent {
  @ApiProperty({ enum: ['text', 'card', 'carousel'] })
  @IsEnum(['text', 'card', 'carousel'])
  type: 'text' | 'card' | 'carousel';

  @ApiPropertyOptional({ description: 'Text message (for type=text)' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ type: [RcsCardDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RcsCardDto)
  cards?: RcsCardDto[];

  @ApiPropertyOptional({ type: [RcsSuggestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RcsSuggestionDto)
  suggestions?: RcsSuggestionDto[];
}

// ============ Create Template DTO ============

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TemplateChannel })
  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @ApiPropertyOptional({ enum: TemplateCategory, default: TemplateCategory.MARKETING })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiProperty({ description: 'Template content (structure depends on channel)' })
  @IsObject()
  content: EmailContentDto | SmsContentDto | WhatsAppContentDto | PushContentDto | RcsContentDto;

  @ApiPropertyOptional({ description: 'Folder path for organization' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Template tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============ Update Template DTO ============

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;
}

// ============ Create Version DTO ============

export class CreateVersionDto {
  @ApiProperty({ description: 'Template content for new version' })
  @IsObject()
  content: EmailContentDto | SmsContentDto | WhatsAppContentDto | PushContentDto | RcsContentDto;

  @ApiPropertyOptional({ description: 'Changelog describing changes' })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  changelog?: string;
}

// ============ Preview DTO ============

export class PreviewTemplateDto {
  @ApiPropertyOptional({ description: 'Version ID to preview (defaults to current)' })
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiProperty({ description: 'Variable values for rendering' })
  @IsObject()
  variables: Record<string, string>;
}

// ============ Approval DTOs ============

export class ApproveTemplateDto {
  @ApiPropertyOptional({ description: 'Approval notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectTemplateDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @Length(1, 2000)
  reason: string;
}

// ============ Search DTO ============

export class TemplateSearchDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: TemplateChannel })
  @IsOptional()
  @IsEnum(TemplateChannel)
  channel?: TemplateChannel;

  @ApiPropertyOptional({ enum: TemplateCategory })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Filter by folder' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Filter by tags', type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @ApiPropertyOptional({ description: 'Include only approved templates' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  approvedOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 'updatedAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ============ Response DTOs ============

export class TemplateVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  templateId: string;

  @ApiProperty()
  versionNumber: number;

  @ApiProperty({ enum: TemplateChannel })
  channel: TemplateChannel;

  @ApiProperty()
  content: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  variables: string[];

  @ApiPropertyOptional()
  changelog?: string;

  @ApiProperty()
  isCurrent: boolean;

  @ApiProperty()
  isValid: boolean;

  @ApiPropertyOptional()
  validationErrors?: Array<{ field: string; message: string }>;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiProperty()
  createdAt: Date;
}

export class TemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: TemplateChannel })
  channel: TemplateChannel;

  @ApiProperty({ enum: TemplateCategory })
  category: TemplateCategory;

  @ApiProperty({ enum: TemplateStatus })
  status: TemplateStatus;

  @ApiProperty({ enum: ApprovalStatus })
  approvalStatus: ApprovalStatus;

  @ApiProperty()
  isApproved: boolean;

  @ApiPropertyOptional()
  approvalNotes?: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: Date;

  @ApiPropertyOptional()
  currentVersionId?: string;

  @ApiProperty()
  currentVersionNumber: number;

  @ApiPropertyOptional()
  folder?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  usageCount: number;

  @ApiPropertyOptional()
  lastUsedAt?: Date;

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

  // Nested current version
  @ApiPropertyOptional({ type: TemplateVersionResponseDto })
  currentVersion?: TemplateVersionResponseDto;
}

export class TemplatePreviewResponseDto {
  @ApiProperty()
  templateId: string;

  @ApiProperty()
  versionId: string;

  @ApiProperty()
  versionNumber: number;

  @ApiProperty({ enum: TemplateChannel })
  channel: TemplateChannel;

  @ApiProperty({ description: 'Rendered content' })
  renderedContent: Record<string, unknown>;

  @ApiProperty({ description: 'Variables used' })
  variablesUsed: string[];

  @ApiProperty({ description: 'Missing variables (not provided)' })
  missingVariables: string[];
}

export class TemplateStatsResponseDto {
  @ApiProperty()
  templateId: string;

  @ApiProperty()
  totalSent: number;

  @ApiProperty()
  totalDelivered: number;

  @ApiProperty()
  totalOpened: number;

  @ApiProperty()
  totalClicked: number;

  @ApiProperty()
  deliveryRate: number;

  @ApiProperty()
  openRate: number;

  @ApiProperty()
  clickRate: number;
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

export class PaginatedTemplatesResponseDto {
  @ApiProperty({ type: [TemplateResponseDto] })
  data: TemplateResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}
