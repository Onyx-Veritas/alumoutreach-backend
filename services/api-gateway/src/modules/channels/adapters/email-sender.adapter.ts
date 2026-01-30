import { Injectable } from '@nestjs/common';
import { PipelineChannel } from '../../pipeline/entities';
import { EmailSenderService, SendResult, SendRequest } from '../../campaigns/services/senders';
import {
  IChannelSenderAdapter,
  ChannelRecipient,
  RenderedContent,
  SendMetadata,
  ValidationResult,
} from '../interfaces';

/**
 * Adapter wrapping EmailSenderService to conform to IChannelSenderAdapter
 */
@Injectable()
export class EmailSenderAdapter implements IChannelSenderAdapter {
  readonly channel = PipelineChannel.EMAIL;

  constructor(private readonly emailSender: EmailSenderService) {}

  async send(
    recipient: ChannelRecipient,
    content: RenderedContent,
    metadata: SendMetadata,
  ): Promise<SendResult> {
    // Transform to EmailSenderService request format
    const request: SendRequest = {
      contactId: metadata.contactId,
      to: recipient.email!,
      subject: content.subject || '(No Subject)',
      htmlBody: content.htmlBody || content.textBody || '',
      textBody: content.textBody,
      fromName: content.fromName,
      replyTo: content.replyTo,
      metadata: {
        campaignId: metadata.campaignId,
        jobId: metadata.jobId,
        tenantId: metadata.tenantId,
      },
    };

    return this.emailSender.send(request, metadata.correlationId);
  }

  validateRecipient(recipient: ChannelRecipient): ValidationResult {
    if (!recipient.email) {
      return { valid: false, error: 'Missing email address' };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient.email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
  }
}
