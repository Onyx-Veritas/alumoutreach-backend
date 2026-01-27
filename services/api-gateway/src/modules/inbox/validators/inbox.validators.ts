import { Injectable } from '@nestjs/common';
import { InboxThread } from '../entities/inbox-thread.entity';
import { InboxMessage } from '../entities/inbox-message.entity';
import { SendMessageDto, InboundMessageDto } from '../dto/inbox.dto';
import { ThreadStatus, MessageDirection, InboxChannel } from '../entities/inbox.enums';

/**
 * Inbox Validators
 * Business rule validation for inbox operations
 */
@Injectable()
export class InboxValidators {
  /**
   * Validate if thread can be assigned
   */
  canAssignThread(thread: InboxThread): { valid: boolean; error?: string } {
    if (thread.isArchived) {
      return { valid: false, error: 'Cannot assign archived thread' };
    }
    if (thread.status === ThreadStatus.CLOSED) {
      return { valid: false, error: 'Cannot assign closed thread' };
    }
    return { valid: true };
  }

  /**
   * Validate if thread status can be changed
   */
  canChangeStatus(
    thread: InboxThread,
    newStatus: ThreadStatus,
  ): { valid: boolean; error?: string } {
    if (thread.isArchived && newStatus !== ThreadStatus.OPEN) {
      return { valid: false, error: 'Cannot change status of archived thread' };
    }

    // Prevent invalid transitions
    if (thread.status === ThreadStatus.CLOSED && newStatus === ThreadStatus.ESCALATED) {
      return { valid: false, error: 'Cannot escalate closed thread, reopen first' };
    }

    return { valid: true };
  }

  /**
   * Validate if message can be sent on thread
   */
  canSendMessage(thread: InboxThread): { valid: boolean; error?: string } {
    if (thread.isArchived) {
      return { valid: false, error: 'Cannot send message on archived thread' };
    }
    if (thread.status === ThreadStatus.CLOSED) {
      return { valid: false, error: 'Cannot send message on closed thread, reopen first' };
    }
    return { valid: true };
  }

  /**
   * Validate send message DTO
   */
  validateSendMessageDto(
    dto: SendMessageDto,
    channel: InboxChannel,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dto.content && !dto.templateId && !dto.mediaUrl) {
      errors.push('Message must have content, template, or media');
    }

    if (dto.content && dto.content.length > 5000) {
      errors.push('Message content exceeds maximum length of 5000 characters');
    }

    // Email-specific validation
    if (channel === InboxChannel.EMAIL) {
      if (dto.cc && dto.cc.some((email) => !this.isValidEmail(email))) {
        errors.push('Invalid CC email address');
      }
      if (dto.bcc && dto.bcc.some((email) => !this.isValidEmail(email))) {
        errors.push('Invalid BCC email address');
      }
    }

    // WhatsApp-specific validation
    if (channel === InboxChannel.WHATSAPP) {
      if (dto.content && dto.content.length > 4096) {
        errors.push('WhatsApp message exceeds maximum length of 4096 characters');
      }
    }

    // SMS-specific validation
    if (channel === InboxChannel.SMS) {
      if (dto.content && dto.content.length > 1600) {
        errors.push('SMS message exceeds maximum length of 1600 characters');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate inbound message
   */
  validateInboundMessage(dto: InboundMessageDto): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dto.tenantId) {
      errors.push('Tenant ID is required');
    }

    if (!dto.senderIdentifier) {
      errors.push('Sender identifier is required');
    }

    if (!dto.channel) {
      errors.push('Channel is required');
    }

    // Validate sender identifier format based on channel
    if (dto.channel === InboxChannel.EMAIL && !this.isValidEmail(dto.senderIdentifier)) {
      errors.push('Invalid email address');
    }

    if (
      (dto.channel === InboxChannel.WHATSAPP || dto.channel === InboxChannel.SMS) &&
      !this.isValidPhone(dto.senderIdentifier)
    ) {
      errors.push('Invalid phone number');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  private isValidPhone(phone: string): boolean {
    // Allow international format with + and digits
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  }

  /**
   * Check if message is a duplicate (by external ID)
   */
  isDuplicateMessage(
    existingMessages: InboxMessage[],
    externalMessageId: string,
  ): boolean {
    return existingMessages.some(
      (msg) => msg.metadata?.externalMessageId === externalMessageId,
    );
  }
}
