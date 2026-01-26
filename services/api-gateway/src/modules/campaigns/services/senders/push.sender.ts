import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../../common/logger/app-logger.service';
import { CampaignChannel } from '../../entities/campaign.enums';
import { SendResult } from './email.sender';

export interface PushSendRequest {
  contactId: string;
  deviceToken: string;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PushSenderService {
  private readonly logger: AppLoggerService;
  readonly channel = CampaignChannel.PUSH;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('PushSenderService');
  }

  async send(request: PushSendRequest, correlationId: string): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send push', {
      contactId: request.contactId,
      title: request.title,
      correlationId,
    });

    try {
      // TODO: Integrate with push notification service (FCM, APNs, OneSignal, etc.)
      // For now, simulate sending with a mock response

      // Simulate network delay
      await this.simulateDelay(20, 100);

      // Simulate success rate (88% success for mock - push has unregistered tokens)
      const success = Math.random() > 0.12;

      if (success) {
        const providerMessageId = `push_${uuidv4()}`;

        this.logger.info('Push notification sent successfully (MOCK)', {
          contactId: request.contactId,
          title: request.title,
          providerMessageId,
          correlationId,
        });

        this.logger.logOperationEnd('send push', startTime, {
          success: true,
          providerMessageId,
        });

        return {
          success: true,
          providerMessageId,
          metadata: {
            provider: 'mock',
            sentAt: new Date().toISOString(),
            platform: 'fcm', // or 'apns'
          },
        };
      } else {
        const error = 'Simulated push delivery failure - invalid or expired device token';

        this.logger.warn('Push send failed (MOCK)', {
          contactId: request.contactId,
          error,
          correlationId,
        });

        this.logger.logOperationEnd('send push', startTime, {
          success: false,
          error,
        });

        return {
          success: false,
          error,
        };
      }
    } catch (error) {
      this.logger.logOperationError('send push', error as Error, { correlationId });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBatch(requests: PushSendRequest[], correlationId: string): Promise<Map<string, SendResult>> {
    const results = new Map<string, SendResult>();

    for (const request of requests) {
      const result = await this.send(request, correlationId);
      results.set(request.contactId, result);
    }

    return results;
  }

  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
