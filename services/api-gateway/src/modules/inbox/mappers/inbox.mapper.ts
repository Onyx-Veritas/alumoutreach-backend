import { Injectable } from '@nestjs/common';
import { InboxThread, ThreadMetadata } from '../entities/inbox-thread.entity';
import { InboxMessage, MessageMetadata } from '../entities/inbox-message.entity';
import { InboxActivity } from '../entities/inbox-activity.entity';
import {
  ThreadSummaryResponseDto,
  ThreadResponseDto,
  MessageResponseDto,
  ActivityResponseDto,
} from '../dto/inbox.dto';

/**
 * Inbox Mapper
 * Maps entities to response DTOs
 */
@Injectable()
export class InboxMapper {
  /**
   * Map thread to summary response DTO
   */
  toThreadSummaryDto(thread: InboxThread): ThreadSummaryResponseDto {
    return {
      id: thread.id,
      contactId: thread.contactId,
      channel: thread.channel,
      unreadCount: thread.unreadCount,
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt,
      status: thread.status,
      priority: thread.priority,
      assignedTo: thread.assignedTo,
      isStarred: thread.isStarred,
      metadata: this.mapThreadMetadata(thread.metadata),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  /**
   * Map thread to full response DTO
   */
  toThreadResponseDto(thread: InboxThread): ThreadResponseDto {
    return {
      ...this.toThreadSummaryDto(thread),
      assignedAt: thread.assignedAt,
      isArchived: thread.isArchived,
      closedAt: thread.closedAt,
      closedBy: thread.closedBy,
    };
  }

  /**
   * Map threads to summary DTOs
   */
  toThreadSummaryDtos(threads: InboxThread[]): ThreadSummaryResponseDto[] {
    return threads.map((thread) => this.toThreadSummaryDto(thread));
  }

  /**
   * Map message to response DTO
   */
  toMessageResponseDto(message: InboxMessage): MessageResponseDto {
    return {
      id: message.id,
      threadId: message.threadId,
      contactId: message.contactId,
      direction: message.direction,
      channel: message.channel,
      content: message.content,
      mediaUrl: message.mediaUrl,
      templateId: message.templateId,
      deliveryStatus: message.deliveryStatus,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      sentBy: message.sentBy,
      metadata: this.mapMessageMetadata(message.metadata),
      createdAt: message.createdAt,
    };
  }

  /**
   * Map messages to response DTOs
   */
  toMessageResponseDtos(messages: InboxMessage[]): MessageResponseDto[] {
    return messages.map((message) => this.toMessageResponseDto(message));
  }

  /**
   * Map activity to response DTO
   */
  toActivityResponseDto(activity: InboxActivity): ActivityResponseDto {
    return {
      id: activity.id,
      threadId: activity.threadId,
      type: activity.type,
      oldValue: activity.oldValue,
      newValue: activity.newValue,
      description: activity.description,
      createdBy: activity.createdBy,
      createdAt: activity.createdAt,
    };
  }

  /**
   * Map activities to response DTOs
   */
  toActivityResponseDtos(activities: InboxActivity[]): ActivityResponseDto[] {
    return activities.map((activity) => this.toActivityResponseDto(activity));
  }

  /**
   * Map thread metadata
   */
  private mapThreadMetadata(metadata: ThreadMetadata): Record<string, unknown> {
    return {
      subject: metadata.subject,
      contactName: metadata.contactName,
      contactAvatar: metadata.contactAvatar,
      lastMessagePreview: metadata.lastMessagePreview,
      tags: metadata.tags || [],
      customFields: metadata.customFields || {},
      source: metadata.source,
      sourceId: metadata.sourceId,
    };
  }

  /**
   * Map message metadata
   */
  private mapMessageMetadata(metadata: MessageMetadata): Record<string, unknown> {
    return {
      cc: metadata.cc,
      bcc: metadata.bcc,
      subject: metadata.subject,
      externalMessageId: metadata.externalMessageId,
      reaction: metadata.reaction,
      replyToMessageId: metadata.replyToMessageId,
      messageType: metadata.messageType,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      errorDetails: metadata.errorDetails,
    };
  }
}
