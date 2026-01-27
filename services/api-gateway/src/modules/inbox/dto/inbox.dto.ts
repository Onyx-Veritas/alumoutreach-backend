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
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InboxChannel,
  MessageDirection,
  ThreadStatus,
  ThreadPriority,
  ActivityType,
  MessageDeliveryStatus,
  DistributionStrategy,
} from '../entities/inbox.enums';

// ============================================================================
// Thread DTOs
// ============================================================================

export class ThreadMetadataDto {
  @ApiPropertyOptional({ description: 'Email subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Contact name' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Contact avatar URL' })
  @IsOptional()
  @IsString()
  contactAvatar?: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Custom fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class ListThreadsQueryDto {
  @ApiPropertyOptional({ enum: ThreadStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(ThreadStatus)
  status?: ThreadStatus;

  @ApiPropertyOptional({ enum: InboxChannel, description: 'Filter by channel' })
  @IsOptional()
  @IsEnum(InboxChannel)
  channel?: InboxChannel;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsOptional()
  @IsUUID('4')
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filter unassigned threads' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unassigned?: boolean;

  @ApiPropertyOptional({ description: 'Filter starred threads' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  starred?: boolean;

  @ApiPropertyOptional({ description: 'Include archived threads' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: 'Filter by contact ID' })
  @IsOptional()
  @IsUUID('4')
  contactId?: string;

  @ApiPropertyOptional({ description: 'Search in messages' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'lastMessageAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'lastMessageAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AssignThreadDto {
  @ApiProperty({ description: 'User ID to assign the thread to' })
  @IsUUID('4')
  assignedTo: string;

  @ApiPropertyOptional({ description: 'Note for assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateThreadStatusDto {
  @ApiProperty({ enum: ThreadStatus, description: 'New thread status' })
  @IsEnum(ThreadStatus)
  status: ThreadStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateThreadPriorityDto {
  @ApiProperty({ enum: ThreadPriority, description: 'New thread priority' })
  @IsEnum(ThreadPriority)
  priority: ThreadPriority;
}

export class ThreadTagsDto {
  @ApiProperty({ description: 'Tags to add or set', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}

// ============================================================================
// Message DTOs
// ============================================================================

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Template ID to use' })
  @IsOptional()
  @IsUUID('4')
  templateId?: string;

  @ApiPropertyOptional({ description: 'Template variables' })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Media URL to attach' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'Email subject (for email channel)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({ description: 'CC recipients (for email)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc?: string[];

  @ApiPropertyOptional({ description: 'BCC recipients (for email)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bcc?: string[];
}

export class AddNoteDto {
  @ApiProperty({ description: 'Note content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Messages before this date' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ description: 'Messages after this date' })
  @IsOptional()
  @IsDateString()
  after?: string;
}

// ============================================================================
// Activity DTOs
// ============================================================================

export class ListActivitiesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by activity type' })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}

// ============================================================================
// Distribution DTOs
// ============================================================================

export class DistributeThreadsDto {
  @ApiProperty({ description: 'Thread IDs to distribute', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  threadIds: string[];

  @ApiProperty({ description: 'Agent IDs to distribute to', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  agentIds: string[];

  @ApiPropertyOptional({ enum: DistributionStrategy, description: 'Distribution strategy', default: DistributionStrategy.ROUND_ROBIN })
  @IsOptional()
  @IsEnum(DistributionStrategy)
  strategy?: DistributionStrategy = DistributionStrategy.ROUND_ROBIN;
}

// ============================================================================
// Ingestion DTOs
// ============================================================================

export class InboundMessageDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ enum: InboxChannel, description: 'Message channel' })
  @IsEnum(InboxChannel)
  channel: InboxChannel;

  @ApiProperty({ description: 'Sender identifier (phone, email)' })
  @IsString()
  @IsNotEmpty()
  senderIdentifier: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Media URL' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'External message ID from provider' })
  @IsOptional()
  @IsString()
  externalMessageId?: string;

  @ApiPropertyOptional({ description: 'Message type' })
  @IsOptional()
  @IsString()
  messageType?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Timestamp of message' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class ThreadSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty({ enum: InboxChannel })
  channel: InboxChannel;

  @ApiProperty()
  unreadCount: number;

  @ApiProperty()
  messageCount: number;

  @ApiPropertyOptional()
  lastMessageAt: Date | null;

  @ApiProperty({ enum: ThreadStatus })
  status: ThreadStatus;

  @ApiProperty({ enum: ThreadPriority })
  priority: ThreadPriority;

  @ApiPropertyOptional()
  assignedTo: string | null;

  @ApiProperty()
  isStarred: boolean;

  @ApiProperty()
  metadata: ThreadMetadataDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ThreadResponseDto extends ThreadSummaryResponseDto {
  @ApiPropertyOptional()
  assignedAt: Date | null;

  @ApiProperty()
  isArchived: boolean;

  @ApiPropertyOptional()
  closedAt: Date | null;

  @ApiPropertyOptional()
  closedBy: string | null;
}

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  threadId: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty({ enum: MessageDirection })
  direction: MessageDirection;

  @ApiProperty({ enum: InboxChannel })
  channel: InboxChannel;

  @ApiPropertyOptional()
  content: string | null;

  @ApiPropertyOptional()
  mediaUrl: string | null;

  @ApiPropertyOptional()
  templateId: string | null;

  @ApiProperty({ enum: MessageDeliveryStatus })
  deliveryStatus: MessageDeliveryStatus;

  @ApiPropertyOptional()
  sentAt: Date | null;

  @ApiPropertyOptional()
  deliveredAt: Date | null;

  @ApiPropertyOptional()
  readAt: Date | null;

  @ApiPropertyOptional()
  sentBy: string | null;

  @ApiProperty()
  metadata: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;
}

export class ActivityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  threadId: string;

  @ApiProperty({ enum: ActivityType })
  type: ActivityType;

  @ApiPropertyOptional()
  oldValue: Record<string, unknown> | null;

  @ApiPropertyOptional()
  newValue: Record<string, unknown> | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  createdBy: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedThreadsResponseDto {
  @ApiProperty({ type: [ThreadSummaryResponseDto] })
  items: ThreadSummaryResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  items: MessageResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedActivitiesResponseDto {
  @ApiProperty({ type: [ActivityResponseDto] })
  items: ActivityResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class DistributionResultDto {
  @ApiProperty({ description: 'Number of threads distributed' })
  distributed: number;

  @ApiProperty({ description: 'Distribution assignments', type: 'object' })
  assignments: Record<string, string[]>;
}

export class InboxStatsDto {
  @ApiProperty()
  totalThreads: number;

  @ApiProperty()
  openThreads: number;

  @ApiProperty()
  pendingThreads: number;

  @ApiProperty()
  escalatedThreads: number;

  @ApiProperty()
  closedThreads: number;

  @ApiProperty()
  unassignedThreads: number;

  @ApiProperty()
  totalMessages: number;

  @ApiProperty()
  unreadMessages: number;

  @ApiProperty({ description: 'Threads per channel', type: 'object' })
  byChannel: Record<string, number>;
}
