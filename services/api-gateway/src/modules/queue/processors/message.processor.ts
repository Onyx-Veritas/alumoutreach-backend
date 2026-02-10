import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { PipelineRepository } from '../../pipeline/repositories/pipeline.repository';
import { PipelineJobStatus, PipelineSkipReason } from '../../pipeline/entities';
import { CampaignStatsService } from '../../pipeline/services/campaign-stats.listener';
import {
  PipelineEventType,
  PipelineSubjects,
  BasePipelineEvent,
  PipelineJobStartedEvent,
  PipelineJobSentEvent,
  PipelineJobFailedEvent,
} from '../../pipeline/events';
import { ContactRepository } from '../../contacts/repositories/contact.repository';
import { PipelineTemplateService, PipelineRenderContext } from '../../templates/services/pipeline-template.service';
import { ChannelSenderRegistry, ChannelRecipient } from '../../channels';
import { QUEUE_NAMES } from '../queue.constants';
import { PipelineJobData, JobExecutionResult, IJobExecutor } from '../interfaces';
import {
  InvalidRecipientError,
  TemplateNotFoundError,
  ContactNotFoundError,
  PipelineJobNotFoundError,
  SendFailedError,
} from '../errors';

/**
 * Custom error for skipped jobs
 */
class JobSkippedError extends Error {
  constructor(
    public readonly skipReason: PipelineSkipReason,
    message: string,
  ) {
    super(message);
    this.name = 'JobSkippedError';
  }
}

/**
 * BullMQ Message Processor
 * 
 * Processes pipeline jobs from the queue:
 * 1. Fetch job and contact from DB
 * 2. Render template with contact context
 * 3. Validate recipient for channel
 * 4. Send via channel adapter
 * 5. Update job status
 * 6. Publish NATS events
 */
@Processor(QUEUE_NAMES.PIPELINE_JOBS)
export class MessageProcessor extends WorkerHost implements IJobExecutor {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly contactRepository: ContactRepository,
    private readonly pipelineTemplateService: PipelineTemplateService,
    private readonly channelRegistry: ChannelSenderRegistry,
    private readonly eventBus: EventBusService,
    private readonly campaignStatsService: CampaignStatsService,
  ) {
    super();
    this.logger = new AppLoggerService();
    this.logger.setContext('MessageProcessor');
  }

  /**
   * Main job processing method
   */
  async process(bullJob: Job<PipelineJobData>): Promise<JobExecutionResult> {
    const { jobId, tenantId, correlationId, channel } = bullJob.data;
    const attemptNumber = bullJob.attemptsMade + 1;

    return this.execute(bullJob.data, attemptNumber);
  }

  /**
   * Execute a job (implements IJobExecutor interface)
   */
  async execute(
    jobData: PipelineJobData,
    attemptNumber: number,
  ): Promise<JobExecutionResult> {
    const { jobId, tenantId, correlationId, channel, contactId, templateVersionId } = jobData;
    const startTime = Date.now();

    this.logger.log('[PROCESS] Starting job execution', {
      jobId,
      tenantId,
      correlationId,
      channel,
      contactId,
      attempt: attemptNumber,
    });

    try {
      // 1. Fetch pipeline job from DB
      const pipelineJob = await this.pipelineRepository.findJobById(tenantId, jobId);
      if (!pipelineJob) {
        throw new PipelineJobNotFoundError(jobId);
      }

      // 2. Mark as processing (state machine enforced: QUEUED → PROCESSING)
      await this.pipelineRepository.transitionJobState(jobId, PipelineJobStatus.PROCESSING);

      // 3. Fetch contact
      const contact = await this.contactRepository.findById(tenantId, contactId);
      if (!contact) {
        // Skip: Contact not found - no point retrying
        throw new JobSkippedError(
          PipelineSkipReason.CONTACT_NOT_FOUND,
          `Contact not found: ${contactId}`,
        );
      }

      // 4. Pre-send validation based on channel
      const preSendValidation = this.validateContactForChannel(channel, contact);
      if (!preSendValidation.valid) {
        throw new JobSkippedError(
          preSendValidation.skipReason!,
          preSendValidation.error!,
        );
      }

      // 5. Publish job started event
      await this.publishJobStartedEvent(jobData);

      // 6. Build render context - convert ContactAttribute[] to Record<string, unknown>
      const attributesMap: Record<string, unknown> = {};
      if (Array.isArray(contact.attributes)) {
        for (const attr of contact.attributes) {
          attributesMap[attr.key] = attr.value;
        }
      }

      const renderContext: PipelineRenderContext = {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          attributes: attributesMap,
        },
        campaign: {
          id: pipelineJob.campaignId,
          name: (pipelineJob.payload?.campaignName as string) || 'Campaign',
        },
        tenant: {
          id: tenantId,
        },
        custom: pipelineJob.payload?.customVariables as Record<string, unknown>,
      };

      // 6. Render template
      const renderResult = await this.pipelineTemplateService.renderForPipeline(
        tenantId,
        templateVersionId,
        renderContext,
        correlationId,
      );

      // 7. Build recipient
      const recipient: ChannelRecipient = {
        email: contact.email,
        phone: contact.phone || contact.whatsapp,
        deviceToken: (contact as { deviceToken?: string }).deviceToken,
        name: contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      };

      // 8. Get channel sender and validate
      const sender = this.channelRegistry.getSender(channel);
      const validation = sender.validateRecipient(recipient);
      if (!validation.valid) {
        throw new InvalidRecipientError(validation.error || 'Invalid recipient');
      }

      // 9. Send message
      const sendResult = await sender.send(recipient, renderResult.content, {
        tenantId,
        correlationId,
        contactId,
        campaignId: pipelineJob.campaignId,
        jobId,
      });

      // 10. Handle result
      const duration = Date.now() - startTime;

      if (sendResult.success) {
        await this.handleSuccess(
          jobId,
          pipelineJob.campaignId,
          pipelineJob.campaignRunId,
          contactId,
          channel,
          sendResult.providerMessageId,
          correlationId,
          tenantId,
        );
        
        this.logger.log('[PROCESS] Job completed successfully', {
          jobId,
          correlationId,
          providerMessageId: sendResult.providerMessageId,
          duration,
        });

        return {
          success: true,
          providerMessageId: sendResult.providerMessageId,
          sentAt: new Date(),
        };
      } else {
        // Send failed - throw to trigger retry
        throw new SendFailedError(sendResult.error || 'Send failed', true);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      return this.handleError(jobData, error as Error, attemptNumber, duration);
    }
  }

  /**
   * Handle successful send
   */
  private async handleSuccess(
    jobId: string,
    campaignId: string,
    campaignRunId: string,
    contactId: string,
    channel: string,
    providerMessageId: string | undefined,
    correlationId: string,
    tenantId: string,
  ): Promise<void> {
    // Update job status
    await this.pipelineRepository.markJobSent(jobId, providerMessageId);

    // Update campaign stats
    await this.campaignStatsService.incrementSent(campaignRunId, tenantId, correlationId);

    // Publish sent event
    const event: PipelineJobSentEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_SENT,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'message-processor',
      payload: {
        jobId,
        campaignId,
        contactId,
        channel: channel as any,
        providerMessageId,
        sentAt: new Date().toISOString(),
      },
    };

    await this.publishEvent(PipelineSubjects.JOB_SENT, event, correlationId);
  }

  /**
   * Handle error during processing
   */
  private async handleError(
    jobData: PipelineJobData,
    error: Error,
    attemptNumber: number,
    duration: number,
  ): Promise<JobExecutionResult> {
    const { jobId, correlationId, campaignId, campaignRunId, contactId, channel, tenantId } = jobData;

    // Handle skip errors specially - don't retry, mark as skipped
    if (error instanceof JobSkippedError) {
      this.logger.warn('[PROCESS] Job skipped', {
        jobId,
        correlationId,
        skipReason: error.skipReason,
        message: error.message,
        duration,
      });

      // Mark as skipped
      await this.pipelineRepository.markJobSkipped(jobId, error.skipReason, error.message);

      // Update campaign stats (skipped counts as completed)
      await this.campaignStatsService.incrementSkipped(campaignRunId, tenantId, correlationId);

      // Publish skipped event
      const event = {
        eventId: uuidv4(),
        eventType: PipelineEventType.JOB_SKIPPED,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'message-processor',
        payload: {
          jobId,
          campaignId,
          contactId,
          channel,
          skipReason: error.skipReason,
          message: error.message,
        },
      };

      await this.publishEvent(PipelineSubjects.JOB_SKIPPED, event, correlationId);

      // Return success=false but don't throw - job is complete (skipped)
      return {
        success: false,
        error: error.message,
        skipped: true,
        skipReason: error.skipReason,
      };
    }

    this.logger.error('[PROCESS] Job failed', undefined, {
      jobId,
      correlationId,
      error: error.message,
      attempt: attemptNumber,
      duration,
    });

    // Determine if error is retryable
    const isNonRetryable =
      error instanceof InvalidRecipientError ||
      error instanceof TemplateNotFoundError ||
      error instanceof ContactNotFoundError ||
      error instanceof PipelineJobNotFoundError;

    if (isNonRetryable) {
      // Mark as FAILED in DB first (PROCESSING → FAILED is valid).
      // Skip for PipelineJobNotFoundError since the job doesn't exist in DB.
      if (!(error instanceof PipelineJobNotFoundError)) {
        await this.pipelineRepository.markJobFailed(jobId, error.message);
      }

      // Wrap in UnrecoverableError so BullMQ skips retries and goes directly
      // to onFailed. Stats are updated in onFailed only (single code path)
      // to prevent double-counting.
      throw new UnrecoverableError(error.message);
    }

    // Retryable errors: re-throw to let BullMQ handle retry logic
    throw error;
  }

  /**
   * Pre-send validation: Check if contact has required data for the channel
   */
  private validateContactForChannel(
    channel: string,
    contact: { email?: string; phone?: string; whatsapp?: string },
  ): { valid: boolean; skipReason?: PipelineSkipReason; error?: string } {
    switch (channel.toLowerCase()) {
      case 'email':
        if (!contact.email) {
          return {
            valid: false,
            skipReason: PipelineSkipReason.MISSING_EMAIL,
            error: 'Contact has no email address',
          };
        }
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.email)) {
          return {
            valid: false,
            skipReason: PipelineSkipReason.INVALID_EMAIL,
            error: `Invalid email format: ${contact.email}`,
          };
        }
        break;

      case 'sms':
        if (!contact.phone) {
          return {
            valid: false,
            skipReason: PipelineSkipReason.MISSING_PHONE,
            error: 'Contact has no phone number',
          };
        }
        break;

      case 'whatsapp':
        if (!contact.whatsapp && !contact.phone) {
          return {
            valid: false,
            skipReason: PipelineSkipReason.MISSING_PHONE,
            error: 'Contact has no WhatsApp number or phone',
          };
        }
        break;

      // push, etc. - add validation as needed
    }

    return { valid: true };
  }

  /**
   * Worker event: Job failed (after all retries exhausted or non-retryable)
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<PipelineJobData>, error: Error): Promise<void> {
    const { jobId, tenantId, correlationId, campaignId, campaignRunId, contactId, channel } = job.data;
    const maxAttempts = job.opts.attempts || 3;
    // UnrecoverableError means BullMQ skipped retries — treat as final failure
    const isUnrecoverable = error instanceof UnrecoverableError || error.name === 'UnrecoverableError';
    const isLastAttempt = isUnrecoverable || job.attemptsMade >= maxAttempts;

    this.logger.error('[WORKER] Job failed', undefined, {
      jobId,
      correlationId,
      error: error.message,
      attempt: job.attemptsMade,
      maxAttempts,
      isLastAttempt,
    });

    if (isLastAttempt) {
      // Mark as dead (state machine enforced: FAILED/PROCESSING → DEAD via markJobDead)
      await this.pipelineRepository.markJobDead(jobId, error.message);

      // Update campaign stats for dead job (single code path for all terminal failures)
      await this.campaignStatsService.incrementFailed(campaignRunId, tenantId, correlationId);

      // Publish dead event
      const event = {
        eventId: uuidv4(),
        eventType: PipelineEventType.JOB_DEAD,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'message-processor',
        payload: {
          jobId,
          campaignId,
          contactId,
          channel,
          error: error.message,
          attempts: job.attemptsMade,
        },
      };

      await this.publishEvent(PipelineSubjects.JOB_DEAD, event, correlationId);
    } else {
      // Mark as retrying (state machine enforced: PROCESSING/FAILED → RETRYING)
      await this.pipelineRepository.transitionJobState(jobId, PipelineJobStatus.RETRYING, {
        retryCount: job.attemptsMade,
      });

      // Publish retrying event
      const event = {
        eventId: uuidv4(),
        eventType: PipelineEventType.JOB_RETRYING,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'message-processor',
        payload: {
          jobId,
          campaignId,
          contactId,
          channel,
          attempt: job.attemptsMade + 1,
          maxAttempts,
        },
      };

      await this.publishEvent(PipelineSubjects.JOB_RETRYING, event, correlationId);
    }
  }

  /**
   * Worker event: Job completed successfully
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<PipelineJobData>, result: JobExecutionResult): void {
    this.logger.log('[WORKER] Job completed', {
      jobId: job.data.jobId,
      correlationId: job.data.correlationId,
      success: result.success,
      providerMessageId: result.providerMessageId,
    });
  }

  /**
   * Publish job started event
   */
  private async publishJobStartedEvent(jobData: PipelineJobData): Promise<void> {
    const event: PipelineJobStartedEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_STARTED,
      tenantId: jobData.tenantId,
      correlationId: jobData.correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'message-processor',
      payload: {
        jobId: jobData.jobId,
        campaignId: jobData.campaignId,
        contactId: jobData.contactId,
        channel: jobData.channel,
      },
    };

    await this.publishEvent(PipelineSubjects.JOB_STARTED, event, jobData.correlationId);
  }

  /**
   * Publish event to NATS (with error handling)
   */
  private async publishEvent<T extends BasePipelineEvent>(
    subject: string,
    event: T,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.eventBus.publish(subject, event, { correlationId });
    } catch (error) {
      this.logger.warn('[EVENT] Failed to publish event', {
        subject,
        correlationId,
        error: (error as Error).message,
      });
      // Don't throw - event publishing failure shouldn't fail the job
    }
  }
}
