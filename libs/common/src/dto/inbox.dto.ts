import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ConversationStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  SNOOZED = 'snoozed',
  CLOSED = 'closed',
}

export enum ConversationChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
  WEB_CHAT = 'web_chat',
  IN_APP = 'in_app',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  TEMPLATE = 'template',
  INTERACTIVE = 'interactive',
  SYSTEM = 'system',
}

export class MessageContentDto {
  @IsEnum(MessageType)
  type: MessageType;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsObject()
  media?: {
    url: string;
    mimeType: string;
    filename?: string;
    size?: number;
  };

  @IsOptional()
  @IsObject()
  template?: {
    id: string;
    variables: Record<string, string>;
  };
}

export class CreateMessageDto {
  @IsString()
  conversationId: string;

  @ValidateNested()
  @Type(() => MessageContentDto)
  content: MessageContentDto;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}

export class MessageResponseDto {
  id: string;
  conversationId: string;
  contactId: string;
  direction: MessageDirection;
  content: MessageContentDto;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  sentBy?: string;
  replyToMessageId?: string;
}

export class ConversationResponseDto {
  id: string;
  tenantId: string;
  contactId: string;
  contact: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    profileImageUrl?: string;
  };
  channel: ConversationChannel;
  status: ConversationStatus;
  assignedTo?: string;
  assignedToName?: string;
  department?: string;
  lastMessageAt: Date;
  lastMessagePreview?: string;
  unreadCount: number;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  hasActiveWorkflow: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export class ConversationNoteDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class ConversationFilterDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsEnum(ConversationChannel)
  channel?: ConversationChannel;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

import { IsBoolean } from 'class-validator';
