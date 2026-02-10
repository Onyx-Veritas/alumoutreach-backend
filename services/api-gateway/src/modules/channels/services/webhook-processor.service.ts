import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PipelineRepository } from '../../pipeline/repositories/pipeline.repository';
import { PipelineJobStatus } from '../../pipeline/entities/pipeline.enums';
import { ContactRepository } from '../../contacts/repositories/contact.repository';
import { TimelineEventType } from '../../contacts/entities/contact-timeline-event.entity';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { SendGridWebhookEvent } from '../dto/sendgrid-webhook.dto';

@Injectable()
export class WebhookProcessorService {
  private readonly logger: AppLoggerService;
  private readonly verificationKey: string | null;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly contactRepository: ContactRepository,
    private readonly configService: ConfigService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('WebhookProcessorService');
    this.verificationKey = this.configService.get<string>('SENDGRID_WEBHOOK_VERIFICATION_KEY', '') || null;
  }

  /**
   * Verify SendGrid webhook signature (Event Webhook Verification)
   * Reference: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
   */
  verifySignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.verificationKey) {
      this.logger.warn('SENDGRID_WEBHOOK_VERIFICATION_KEY not configured, skipping signature verification');
      return true;
    }

    try {
      const timestampPayload = timestamp + payload;
      const decodedKey = Buffer.from(this.verificationKey, 'base64');

      const expectedSignature = crypto
        .createHmac('sha256', decodedKey)
        .update(timestampPayload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Process a batch of SendGrid webhook events
   */
  async processEvents(events: SendGridWebhookEvent[]): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        await this.processEvent(event);
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(`Failed to process webhook event: ${(error as Error).message}`, undefined, {
          event: event.event,
          sg_message_id: event.sg_message_id,
        });
      }
    }

    this.logger.info('Webhook batch processed', { total: events.length, processed, errors });
    return { processed, errors };
  }

  /**
   * Process a single SendGrid webhook event
   */
  private async processEvent(event: SendGridWebhookEvent): Promise<void> {
    // SendGrid sg_message_id may have a filter suffix after the first dot
    // e.g. "abc123.filterId" — the providerMessageId we stored is just "abc123"
    const messageId = event.sg_message_id?.split('.')[0];

    if (!messageId) {
      this.logger.warn('Webhook event missing sg_message_id, skipping', { event: event.event });
      return;
    }

    switch (event.event) {
      case 'delivered':
        await this.handleDelivered(messageId, event);
        break;
      case 'bounce':
        await this.handleBounce(messageId, event);
        break;
      case 'dropped':
        await this.handleDropped(messageId, event);
        break;
      case 'open':
        await this.handleOpen(messageId, event);
        break;
      case 'click':
        await this.handleClick(messageId, event);
        break;
      case 'spamreport':
        await this.handleSpamReport(messageId, event);
        break;
      case 'unsubscribe':
      case 'group_unsubscribe':
        await this.handleUnsubscribe(messageId, event);
        break;
      case 'deferred':
        this.logger.debug('Deferred event received', { messageId, attempt: event.attempt });
        break;
      case 'processed':
        this.logger.debug('Processed event received', { messageId });
        break;
      default:
        this.logger.debug('Unhandled webhook event type', { event: event.event, messageId });
    }
  }

  /**
   * Handle delivered event: SENT -> DELIVERED
   */
  private async handleDelivered(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.warn('No pipeline job found for delivered event', { messageId });
      return;
    }

    // Only transition if currently in SENT state
    if (job.status === PipelineJobStatus.SENT) {
      await this.pipelineRepository.markJobDelivered(job.id);
      this.logger.info('Job marked as delivered', { jobId: job.id, messageId });
    } else {
      this.logger.debug('Ignoring delivered event for job not in SENT state', {
        jobId: job.id,
        currentStatus: job.status,
        messageId,
      });
    }
  }

  /**
   * Handle bounce event: SENT -> FAILED + record failure
   */
  private async handleBounce(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.warn('No pipeline job found for bounce event', { messageId });
      return;
    }

    const errorMessage = `Bounce (${event.type || 'unknown'}): ${event.reason || 'no reason provided'}`;

    if (job.status === PipelineJobStatus.SENT) {
      await this.pipelineRepository.markJobFailed(job.id, errorMessage);
      await this.pipelineRepository.recordFailure({
        tenantId: job.tenantId,
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        errorMessage,
        lastStatus: PipelineJobStatus.FAILED,
        retryCount: job.retryCount,
      });
      this.logger.info('Job marked as failed due to bounce', { jobId: job.id, messageId, type: event.type });
    }

    // Record bounce on contact timeline
    await this.recordTimelineEvent(job.tenantId, job.contactId, TimelineEventType.EMAIL_BOUNCED, {
      title: 'Email bounced',
      description: errorMessage,
      referenceId: job.id,
      campaignId: job.campaignId,
      providerMessageId: messageId,
      bounceType: event.type,
      status: event.status,
    });
  }

  /**
   * Handle dropped event: SENT -> FAILED
   */
  private async handleDropped(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.warn('No pipeline job found for dropped event', { messageId });
      return;
    }

    const errorMessage = `Dropped: ${event.reason || 'no reason provided'}`;

    if (job.status === PipelineJobStatus.SENT) {
      await this.pipelineRepository.markJobFailed(job.id, errorMessage);
      await this.pipelineRepository.recordFailure({
        tenantId: job.tenantId,
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        errorMessage,
        lastStatus: PipelineJobStatus.FAILED,
        retryCount: job.retryCount,
      });
      this.logger.info('Job marked as failed due to drop', { jobId: job.id, messageId, reason: event.reason });
    }
  }

  /**
   * Handle open event: record on contact timeline
   */
  private async handleOpen(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.debug('No pipeline job found for open event', { messageId });
      return;
    }

    await this.recordTimelineEvent(job.tenantId, job.contactId, TimelineEventType.EMAIL_OPENED, {
      title: 'Email opened',
      description: `Email opened from ${event.ip || 'unknown IP'}`,
      referenceId: job.id,
      campaignId: job.campaignId,
      providerMessageId: messageId,
      ip: event.ip,
      userAgent: event.useragent,
    });

    this.logger.debug('Open event recorded', { jobId: job.id, messageId });
  }

  /**
   * Handle click event: record on contact timeline
   */
  private async handleClick(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.debug('No pipeline job found for click event', { messageId });
      return;
    }

    await this.recordTimelineEvent(job.tenantId, job.contactId, TimelineEventType.EMAIL_CLICKED, {
      title: 'Email link clicked',
      description: `Clicked: ${event.url || 'unknown URL'}`,
      referenceId: job.id,
      campaignId: job.campaignId,
      providerMessageId: messageId,
      url: event.url,
      ip: event.ip,
      userAgent: event.useragent,
    });

    this.logger.debug('Click event recorded', { jobId: job.id, messageId, url: event.url });
  }

  /**
   * Handle spam report: record + update contact consent
   */
  private async handleSpamReport(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.warn('No pipeline job found for spam report event', { messageId });
      return;
    }

    await this.recordTimelineEvent(job.tenantId, job.contactId, TimelineEventType.CONSENT_UPDATED, {
      title: 'Spam report received',
      description: 'Contact marked email as spam. Consent revoked.',
      referenceId: job.id,
      campaignId: job.campaignId,
      providerMessageId: messageId,
    });

    this.logger.info('Spam report processed', { jobId: job.id, contactId: job.contactId, messageId });
  }

  /**
   * Handle unsubscribe event: record on contact timeline
   */
  private async handleUnsubscribe(messageId: string, event: SendGridWebhookEvent): Promise<void> {
    const job = await this.pipelineRepository.findByProviderMessageId(messageId);
    if (!job) {
      this.logger.warn('No pipeline job found for unsubscribe event', { messageId });
      return;
    }

    await this.recordTimelineEvent(job.tenantId, job.contactId, TimelineEventType.CONSENT_UPDATED, {
      title: 'Unsubscribed',
      description: 'Contact unsubscribed via email link.',
      referenceId: job.id,
      campaignId: job.campaignId,
      providerMessageId: messageId,
    });

    this.logger.info('Unsubscribe processed', { jobId: job.id, contactId: job.contactId, messageId });
  }

  /**
   * Record a timeline event on a contact
   */
  private async recordTimelineEvent(
    tenantId: string,
    contactId: string,
    eventType: TimelineEventType,
    data: {
      title: string;
      description: string;
      referenceId: string;
      campaignId?: string;
      providerMessageId?: string;
      [key: string]: unknown;
    },
  ): Promise<void> {
    try {
      const { title, description, referenceId, ...extra } = data;
      await this.contactRepository.createTimelineEvent({
        tenantId,
        contactId,
        eventType,
        title,
        description,
        referenceType: 'pipeline_job',
        referenceId,
        source: 'sendgrid_webhook',
        data: extra,
        occurredAt: new Date(),
      });
    } catch (error) {
      // Don't fail the webhook processing if timeline recording fails
      this.logger.error(`Failed to record timeline event: ${(error as Error).message}`, undefined, {
        tenantId,
        contactId,
        eventType,
      });
    }
  }
}
