import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../../common/logger/app-logger.service';
import { CampaignChannel } from '../../entities/campaign.enums';

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SendRequest {
  contactId: string;
  to: string; // email address
  subject: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailSenderService {
  private readonly logger: AppLoggerService;
  readonly channel = CampaignChannel.EMAIL;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('EmailSenderService');
  }

  async send(request: SendRequest, correlationId: string): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send email', {
      contactId: request.contactId,
      to: request.to,
      correlationId,
    });

    try {
      // TODO: Integrate with actual email provider (SendGrid, AWS SES, etc.)
      // For now, simulate sending with a mock response

      // Simulate network delay
      await this.simulateDelay(50, 200);

      // Simulate success rate (95% success for mock)
      const success = Math.random() > 0.05;

      if (success) {
        const providerMessageId = `email_${uuidv4()}`;

        this.logger.info('Email sent successfully (MOCK)', {
          to: request.to,
          providerMessageId,
          correlationId,
        });

        this.logger.logOperationEnd('send email', startTime, {
          success: true,
          providerMessageId,
        });

        return {
          success: true,
          providerMessageId,
          metadata: {
            provider: 'mock',
            sentAt: new Date().toISOString(),
          },
        };
      } else {
        const error = 'Simulated delivery failure';

        this.logger.warn('Email send failed (MOCK)', {
          to: request.to,
          error,
          correlationId,
        });

        this.logger.logOperationEnd('send email', startTime, {
          success: false,
          error,
        });

        return {
          success: false,
          error,
        };
      }
    } catch (error) {
      this.logger.logOperationError('send email', error as Error, { correlationId });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBatch(requests: SendRequest[], correlationId: string): Promise<Map<string, SendResult>> {
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
