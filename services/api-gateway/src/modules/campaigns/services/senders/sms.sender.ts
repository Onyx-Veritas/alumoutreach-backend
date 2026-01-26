import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../../common/logger/app-logger.service';
import { CampaignChannel } from '../../entities/campaign.enums';
import { SendResult } from './email.sender';

export interface SmsSendRequest {
  contactId: string;
  to: string; // phone number
  body: string;
  from?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SmsSenderService {
  private readonly logger: AppLoggerService;
  readonly channel = CampaignChannel.SMS;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('SmsSenderService');
  }

  async send(request: SmsSendRequest, correlationId: string): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send sms', {
      contactId: request.contactId,
      to: request.to,
      correlationId,
    });

    try {
      // TODO: Integrate with actual SMS provider (Twilio, AWS SNS, etc.)
      // For now, simulate sending with a mock response

      // Simulate network delay
      await this.simulateDelay(30, 150);

      // Simulate success rate (92% success for mock)
      const success = Math.random() > 0.08;

      if (success) {
        const providerMessageId = `sms_${uuidv4()}`;

        this.logger.info('SMS sent successfully (MOCK)', {
          to: request.to,
          providerMessageId,
          correlationId,
        });

        this.logger.logOperationEnd('send sms', startTime, {
          success: true,
          providerMessageId,
        });

        return {
          success: true,
          providerMessageId,
          metadata: {
            provider: 'mock',
            sentAt: new Date().toISOString(),
            segments: Math.ceil(request.body.length / 160),
          },
        };
      } else {
        const error = 'Simulated SMS delivery failure';

        this.logger.warn('SMS send failed (MOCK)', {
          to: request.to,
          error,
          correlationId,
        });

        this.logger.logOperationEnd('send sms', startTime, {
          success: false,
          error,
        });

        return {
          success: false,
          error,
        };
      }
    } catch (error) {
      this.logger.logOperationError('send sms', error as Error, { correlationId });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBatch(requests: SmsSendRequest[], correlationId: string): Promise<Map<string, SendResult>> {
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
