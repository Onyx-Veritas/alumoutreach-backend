import { Injectable } from '@nestjs/common';
import { PipelineChannel } from '../../pipeline/entities';
import { PushSenderService, SendResult } from '../../campaigns/services/senders';
import { PushSendRequest } from '../../campaigns/services/senders/push.sender';
import {
  IChannelSenderAdapter,
  ChannelRecipient,
  RenderedContent,
  SendMetadata,
  ValidationResult,
} from '../interfaces';

/**
 * Adapter wrapping PushSenderService to conform to IChannelSenderAdapter
 */
@Injectable()
export class PushSenderAdapter implements IChannelSenderAdapter {
  readonly channel = PipelineChannel.PUSH;

  constructor(private readonly pushSender: PushSenderService) {}

  async send(
    recipient: ChannelRecipient,
    content: RenderedContent,
    metadata: SendMetadata,
  ): Promise<SendResult> {
    // Transform to PushSenderService request format
    const request: PushSendRequest = {
      contactId: metadata.contactId,
      deviceToken: recipient.deviceToken!,
      title: content.title || content.subject || 'Notification',
      body: content.textBody || '',
      imageUrl: content.imageUrl,
      deepLink: content.deepLink,
      data: {
        ...content.data,
        campaignId: metadata.campaignId,
        jobId: metadata.jobId,
      },
      metadata: {
        tenantId: metadata.tenantId,
      },
    };

    return this.pushSender.send(request, metadata.correlationId);
  }

  validateRecipient(recipient: ChannelRecipient): ValidationResult {
    if (!recipient.deviceToken) {
      return { valid: false, error: 'Missing device token' };
    }

    // Basic token validation (non-empty string)
    if (recipient.deviceToken.trim().length === 0) {
      return { valid: false, error: 'Device token is empty' };
    }

    return { valid: true };
  }
}
