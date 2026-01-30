import { Injectable } from '@nestjs/common';
import { PipelineChannel } from '../../pipeline/entities';
import { WhatsAppSenderService, SendResult } from '../../campaigns/services/senders';
import { WhatsAppSendRequest } from '../../campaigns/services/senders/whatsapp.sender';
import {
  IChannelSenderAdapter,
  ChannelRecipient,
  RenderedContent,
  SendMetadata,
  ValidationResult,
} from '../interfaces';

/**
 * Adapter wrapping WhatsAppSenderService to conform to IChannelSenderAdapter
 */
@Injectable()
export class WhatsAppSenderAdapter implements IChannelSenderAdapter {
  readonly channel = PipelineChannel.WHATSAPP;

  constructor(private readonly whatsAppSender: WhatsAppSenderService) {}

  async send(
    recipient: ChannelRecipient,
    content: RenderedContent,
    metadata: SendMetadata,
  ): Promise<SendResult> {
    // Transform to WhatsAppSenderService request format
    const request: WhatsAppSendRequest = {
      contactId: metadata.contactId,
      to: recipient.phone!,
      templateName: content.templateName || 'default_template',
      templateNamespace: content.templateNamespace,
      languageCode: content.languageCode || 'en',
      components: content.components,
      metadata: {
        campaignId: metadata.campaignId,
        jobId: metadata.jobId,
        tenantId: metadata.tenantId,
      },
    };

    return this.whatsAppSender.send(request, metadata.correlationId);
  }

  validateRecipient(recipient: ChannelRecipient): ValidationResult {
    if (!recipient.phone) {
      return { valid: false, error: 'Missing phone number' };
    }

    // WhatsApp requires E.164 format with country code
    const digitsOnly = recipient.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return { valid: false, error: 'Phone number too short for WhatsApp' };
    }

    return { valid: true };
  }
}
