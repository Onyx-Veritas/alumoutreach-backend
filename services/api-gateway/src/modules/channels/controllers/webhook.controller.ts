import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { SendGridWebhookEvent } from '../dto/sendgrid-webhook.dto';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly webhookProcessor: WebhookProcessorService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('WebhookController');
  }

  /**
   * Receive SendGrid Event Webhook
   *
   * SendGrid posts an array of event objects when email events occur
   * (delivered, bounced, opened, clicked, etc.)
   *
   * This endpoint is unauthenticated (called by SendGrid) but verifies
   * the webhook signature if SENDGRID_WEBHOOK_VERIFICATION_KEY is set.
   */
  @Post('sendgrid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive SendGrid delivery event webhooks' })
  async handleSendGridWebhook(
    @Body() events: SendGridWebhookEvent[],
    @Headers('x-twilio-email-event-webhook-signature') signature?: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp?: string,
    @Req() req?: Request,
  ): Promise<{ ok: boolean }> {
    if (!Array.isArray(events) || events.length === 0) {
      throw new BadRequestException('Expected non-empty array of events');
    }

    this.logger.info('SendGrid webhook received', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map(e => e.event))],
    });

    // Verify signature if configured
    if (signature && timestamp) {
      const rawBody = typeof req?.body === 'string' ? req.body : JSON.stringify(events);
      const isValid = this.webhookProcessor.verifySignature(rawBody, signature, timestamp);
      if (!isValid) {
        this.logger.warn('SendGrid webhook signature verification failed');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const result = await this.webhookProcessor.processEvents(events);

    return { ok: true };
  }
}
