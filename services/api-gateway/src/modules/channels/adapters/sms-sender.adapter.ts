import { Injectable } from '@nestjs/common';
import { PipelineChannel } from '../../pipeline/entities';
import { SmsSenderService, SendResult } from '../../campaigns/services/senders';
import { SmsSendRequest } from '../../campaigns/services/senders/sms.sender';
import {
  IChannelSenderAdapter,
  ChannelRecipient,
  RenderedContent,
  SendMetadata,
  ValidationResult,
} from '../interfaces';

/**
 * Adapter wrapping SmsSenderService to conform to IChannelSenderAdapter
 */
@Injectable()
export class SmsSenderAdapter implements IChannelSenderAdapter {
  readonly channel = PipelineChannel.SMS;

  constructor(private readonly smsSender: SmsSenderService) {}

  async send(
    recipient: ChannelRecipient,
    content: RenderedContent,
    metadata: SendMetadata,
  ): Promise<SendResult> {
    // Transform to SmsSenderService request format
    const request: SmsSendRequest = {
      contactId: metadata.contactId,
      to: recipient.phone!,
      body: content.textBody || '',
      metadata: {
        campaignId: metadata.campaignId,
        jobId: metadata.jobId,
        tenantId: metadata.tenantId,
      },
    };

    return this.smsSender.send(request, metadata.correlationId);
  }

  validateRecipient(recipient: ChannelRecipient): ValidationResult {
    if (!recipient.phone) {
      return { valid: false, error: 'Missing phone number' };
    }

    // Basic phone number validation (at least 10 digits)
    const digitsOnly = recipient.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return { valid: false, error: 'Phone number too short (min 10 digits)' };
    }

    return { valid: true };
  }
}
