import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { CampaignRepository } from '../repositories/campaign.repository';
import { Campaign, CampaignChannel, CampaignStatus } from '../entities/campaign.entity';
import { CampaignRun, CampaignRunStatus } from '../entities/campaign-run.entity';
import { CampaignMessage, DispatchStatus } from '../entities/campaign-message.entity';
import {
  CampaignEventType,
  CampaignSubjects,
  CampaignRunStartedEvent,
  CampaignRunCompletedEvent,
  CampaignRunFailedEvent,
  CampaignMessageSentEvent,
  CampaignMessageFailedEvent,
} from '../events/campaign.events';
import { EmailSenderService, SendRequest } from './senders/email.sender';
import { SmsSenderService, SmsSendRequest } from './senders/sms.sender';
import { WhatsAppSenderService, WhatsAppSendRequest } from './senders/whatsapp.sender';
import { PushSenderService, PushSendRequest } from './senders/push.sender';

export interface DispatchResult {
  runId: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  durationMs: number;
}

export interface RecipientData {
  contactId: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  attributes?: Record<string, unknown>;
}

@Injectable()
export class CampaignDispatchService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBusService,
    private readonly emailSender: EmailSenderService,
    private readonly smsSender: SmsSenderService,
    private readonly whatsAppSender: WhatsAppSenderService,
    private readonly pushSender: PushSenderService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignDispatchService');
  }

  /**
   * Dispatch a campaign to all recipients
   */
  async dispatch(
    campaign: Campaign,
    recipients: RecipientData[],
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<DispatchResult> {
    const startTime = this.logger.logOperationStart('dispatch campaign', {
      campaignId: campaign.id,
      tenantId: campaign.tenantId,
      channel: campaign.channel,
      recipientCount: recipients.length,
      correlationId,
    });

    const runStartTime = Date.now();

    // Create campaign run
    const run = new CampaignRun();
    run.id = uuidv4();
    run.campaignId = campaign.id;
    run.tenantId = campaign.tenantId;
    run.status = CampaignRunStatus.PENDING;
    run.totalRecipients = recipients.length;
    run.processedCount = 0;
    run.sentCount = 0;
    run.failedCount = 0;

    try {
      await this.campaignRepository.createRun(run);

      // Update campaign status to running
      await this.campaignRepository.updateStatus(
        campaign.tenantId,
        campaign.id,
        CampaignStatus.RUNNING,
        'system',
      );

      // Update run status to running
      await this.campaignRepository.updateRunStatus(run.id, CampaignRunStatus.RUNNING);

      // Publish run started event
      await this.publishEvent(CampaignSubjects.RUN_STARTED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_RUN_STARTED,
        tenantId: campaign.tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: campaign.id,
          runId: run.id,
          totalRecipients: recipients.length,
          channel: campaign.channel,
        },
      } as CampaignRunStartedEvent);

      // Create campaign messages
      const messages = await this.createMessages(
        campaign,
        run.id,
        recipients,
        correlationId,
      );

      // Process messages based on channel
      const result = await this.processMessages(
        campaign,
        run,
        messages,
        recipients,
        templateContent,
        correlationId,
      );

      // Update run status to completed
      const durationMs = Date.now() - runStartTime;
      await this.campaignRepository.updateRunStatus(run.id, CampaignRunStatus.COMPLETED, {
        processedCount: recipients.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });

      // Update campaign stats
      await this.campaignRepository.updateCampaignStats(campaign.id);

      // Update campaign status to completed
      await this.campaignRepository.updateStatus(
        campaign.tenantId,
        campaign.id,
        CampaignStatus.COMPLETED,
        'system',
      );

      // Publish run completed event
      await this.publishEvent(CampaignSubjects.RUN_COMPLETED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_RUN_COMPLETED,
        tenantId: campaign.tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: campaign.id,
          runId: run.id,
          totalRecipients: recipients.length,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          durationMs,
        },
      } as CampaignRunCompletedEvent);

      this.logger.logOperationEnd('dispatch campaign', startTime, {
        runId: run.id,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        durationMs,
      });

      return {
        runId: run.id,
        totalRecipients: recipients.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        durationMs,
      };
    } catch (error) {
      // Update run status to failed
      await this.campaignRepository.updateRunStatus(run.id, CampaignRunStatus.FAILED);
      await this.campaignRepository.updateRun(run.id, {
        errorMessage: (error as Error).message,
      });

      // Update campaign status to failed
      await this.campaignRepository.updateStatus(
        campaign.tenantId,
        campaign.id,
        CampaignStatus.FAILED,
        'system',
      );

      // Publish run failed event
      await this.publishEvent(CampaignSubjects.RUN_FAILED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_RUN_FAILED,
        tenantId: campaign.tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: campaign.id,
          runId: run.id,
          error: (error as Error).message,
          processedCount: run.processedCount,
          failedCount: run.failedCount,
        },
      } as CampaignRunFailedEvent);

      this.logger.logOperationError('dispatch campaign', error as Error, { correlationId });
      throw error;
    }
  }

  /**
   * Create CampaignMessage records for all recipients
   */
  private async createMessages(
    campaign: Campaign,
    runId: string,
    recipients: RecipientData[],
    correlationId: string,
  ): Promise<CampaignMessage[]> {
    const messages: CampaignMessage[] = recipients.map((recipient) => {
      const message = new CampaignMessage();
      message.id = uuidv4();
      message.campaignId = campaign.id;
      message.runId = runId;
      message.tenantId = campaign.tenantId;
      message.contactId = recipient.contactId;
      message.templateVersionId = campaign.templateVersionId;
      message.dispatchStatus = DispatchStatus.PENDING;
      return message;
    });

    return this.campaignRepository.createMessagesBatch(messages);
  }

  /**
   * Process all messages through the appropriate channel sender
   */
  private async processMessages(
    campaign: Campaign,
    run: CampaignRun,
    messages: CampaignMessage[],
    recipients: RecipientData[],
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ sentCount: number; failedCount: number }> {
    let sentCount = 0;
    let failedCount = 0;

    // Create a map of contact ID to recipient data
    const recipientMap = new Map<string, RecipientData>();
    for (const recipient of recipients) {
      recipientMap.set(recipient.contactId, recipient);
    }

    // Process messages in batches
    const batchSize = 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (message) => {
          const recipient = recipientMap.get(message.contactId);
          if (!recipient) {
            await this.markMessageFailed(message, 'Recipient data not found', correlationId, campaign);
            failedCount++;
            return;
          }

          try {
            const result = await this.sendMessage(
              campaign,
              message,
              recipient,
              templateContent,
              correlationId,
            );

            if (result.success) {
              sentCount++;
            } else {
              failedCount++;
            }
          } catch (error) {
            await this.markMessageFailed(message, (error as Error).message, correlationId, campaign);
            failedCount++;
          }
        }),
      );
    }

    return { sentCount, failedCount };
  }

  /**
   * Send a single message through the appropriate channel
   */
  private async sendMessage(
    campaign: Campaign,
    message: CampaignMessage,
    recipient: RecipientData,
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    switch (campaign.channel) {
      case CampaignChannel.EMAIL:
        return this.sendEmailMessage(campaign, message, recipient, templateContent, correlationId);
      case CampaignChannel.SMS:
        return this.sendSmsMessage(campaign, message, recipient, templateContent, correlationId);
      case CampaignChannel.WHATSAPP:
        return this.sendWhatsAppMessage(campaign, message, recipient, templateContent, correlationId);
      case CampaignChannel.PUSH:
        return this.sendPushMessage(campaign, message, recipient, templateContent, correlationId);
      default:
        await this.markMessageFailed(message, `Unsupported channel: ${campaign.channel}`, correlationId, campaign);
        return { success: false };
    }
  }

  private async sendEmailMessage(
    campaign: Campaign,
    message: CampaignMessage,
    recipient: RecipientData,
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    if (!recipient.email) {
      await this.markMessageFailed(message, 'Recipient has no email address', correlationId, campaign);
      return { success: false };
    }

    const request: SendRequest = {
      contactId: recipient.contactId,
      to: recipient.email,
      subject: (templateContent.subject as string) || 'No Subject',
      htmlBody: (templateContent.htmlBody as string) || '<p>No content</p>',
      textBody: templateContent.textBody as string,
    };

    const result = await this.emailSender.send(request, correlationId);

    if (result.success) {
      await this.markMessageSent(message, result.providerMessageId!, correlationId, campaign);
    } else {
      await this.markMessageFailed(message, result.error!, correlationId, campaign);
    }

    return { success: result.success };
  }

  private async sendSmsMessage(
    campaign: Campaign,
    message: CampaignMessage,
    recipient: RecipientData,
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    if (!recipient.phone) {
      await this.markMessageFailed(message, 'Recipient has no phone number', correlationId, campaign);
      return { success: false };
    }

    const request: SmsSendRequest = {
      contactId: recipient.contactId,
      to: recipient.phone,
      body: (templateContent.body as string) || 'No content',
    };

    const result = await this.smsSender.send(request, correlationId);

    if (result.success) {
      await this.markMessageSent(message, result.providerMessageId!, correlationId, campaign);
    } else {
      await this.markMessageFailed(message, result.error!, correlationId, campaign);
    }

    return { success: result.success };
  }

  private async sendWhatsAppMessage(
    campaign: Campaign,
    message: CampaignMessage,
    recipient: RecipientData,
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    if (!recipient.phone) {
      await this.markMessageFailed(message, 'Recipient has no phone number', correlationId, campaign);
      return { success: false };
    }

    const request: WhatsAppSendRequest = {
      contactId: recipient.contactId,
      to: recipient.phone,
      templateName: (templateContent.templateName as string) || 'default_template',
      languageCode: (templateContent.languageCode as string) || 'en',
    };

    const result = await this.whatsAppSender.send(request, correlationId);

    if (result.success) {
      await this.markMessageSent(message, result.providerMessageId!, correlationId, campaign);
    } else {
      await this.markMessageFailed(message, result.error!, correlationId, campaign);
    }

    return { success: result.success };
  }

  private async sendPushMessage(
    campaign: Campaign,
    message: CampaignMessage,
    recipient: RecipientData,
    templateContent: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    if (!recipient.deviceToken) {
      await this.markMessageFailed(message, 'Recipient has no device token', correlationId, campaign);
      return { success: false };
    }

    const request: PushSendRequest = {
      contactId: recipient.contactId,
      deviceToken: recipient.deviceToken,
      title: (templateContent.title as string) || 'Notification',
      body: (templateContent.body as string) || 'No content',
      deepLink: templateContent.deepLink as string,
    };

    const result = await this.pushSender.send(request, correlationId);

    if (result.success) {
      await this.markMessageSent(message, result.providerMessageId!, correlationId, campaign);
    } else {
      await this.markMessageFailed(message, result.error!, correlationId, campaign);
    }

    return { success: result.success };
  }

  private async markMessageSent(
    message: CampaignMessage,
    providerMessageId: string,
    correlationId: string,
    campaign: Campaign,
  ): Promise<void> {
    await this.campaignRepository.updateMessageStatus(message.id, DispatchStatus.SENT, {
      providerMessageId,
    });

    await this.publishEvent(CampaignSubjects.MESSAGE_SENT, {
      eventId: uuidv4(),
      eventType: CampaignEventType.CAMPAIGN_MESSAGE_SENT,
      tenantId: campaign.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        campaignId: campaign.id,
        runId: message.runId,
        messageId: message.id,
        contactId: message.contactId,
        channel: campaign.channel,
        providerMessageId,
      },
    } as CampaignMessageSentEvent);
  }

  private async markMessageFailed(
    message: CampaignMessage,
    error: string,
    correlationId: string,
    campaign: Campaign,
  ): Promise<void> {
    await this.campaignRepository.updateMessageStatus(message.id, DispatchStatus.FAILED, {
      dispatchError: error,
    });

    await this.publishEvent(CampaignSubjects.MESSAGE_FAILED, {
      eventId: uuidv4(),
      eventType: CampaignEventType.CAMPAIGN_MESSAGE_FAILED,
      tenantId: campaign.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        campaignId: campaign.id,
        runId: message.runId,
        messageId: message.id,
        contactId: message.contactId,
        channel: campaign.channel,
        error,
      },
    } as CampaignMessageFailedEvent);
  }

  private async publishEvent(subject: string, event: Record<string, unknown>): Promise<void> {
    try {
      await this.eventBus.publish(subject, event as any, {
        correlationId: event.correlationId as string,
        tenantId: event.tenantId as string,
      });
    } catch (error) {
      this.logger.warn('Failed to publish campaign dispatch event', {
        subject,
        eventType: event.eventType,
        error: (error as Error).message,
      });
    }
  }
}
