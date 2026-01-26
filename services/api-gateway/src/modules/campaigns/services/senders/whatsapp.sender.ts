import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../../common/logger/app-logger.service';
import { CampaignChannel } from '../../entities/campaign.enums';
import { SendResult } from './email.sender';

export interface WhatsAppSendRequest {
  contactId: string;
  to: string; // phone number with country code
  templateName: string;
  templateNamespace?: string;
  languageCode?: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      value: unknown;
    }>;
  }>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WhatsAppSenderService {
  private readonly logger: AppLoggerService;
  readonly channel = CampaignChannel.WHATSAPP;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('WhatsAppSenderService');
  }

  async send(request: WhatsAppSendRequest, correlationId: string): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send whatsapp', {
      contactId: request.contactId,
      to: request.to,
      templateName: request.templateName,
      correlationId,
    });

    try {
      // TODO: Integrate with WhatsApp Business API (via Meta/Cloud API or BSP)
      // For now, simulate sending with a mock response

      // Simulate network delay
      await this.simulateDelay(100, 300);

      // Simulate success rate (90% success for mock - WhatsApp has stricter delivery)
      const success = Math.random() > 0.10;

      if (success) {
        const providerMessageId = `wamid.${uuidv4().replace(/-/g, '')}`;

        this.logger.info('WhatsApp message sent successfully (MOCK)', {
          to: request.to,
          templateName: request.templateName,
          providerMessageId,
          correlationId,
        });

        this.logger.logOperationEnd('send whatsapp', startTime, {
          success: true,
          providerMessageId,
        });

        return {
          success: true,
          providerMessageId,
          metadata: {
            provider: 'mock',
            sentAt: new Date().toISOString(),
            templateName: request.templateName,
          },
        };
      } else {
        const error = 'Simulated WhatsApp delivery failure - template not approved or number not opted in';

        this.logger.warn('WhatsApp send failed (MOCK)', {
          to: request.to,
          templateName: request.templateName,
          error,
          correlationId,
        });

        this.logger.logOperationEnd('send whatsapp', startTime, {
          success: false,
          error,
        });

        return {
          success: false,
          error,
        };
      }
    } catch (error) {
      this.logger.logOperationError('send whatsapp', error as Error, { correlationId });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBatch(requests: WhatsAppSendRequest[], correlationId: string): Promise<Map<string, SendResult>> {
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
