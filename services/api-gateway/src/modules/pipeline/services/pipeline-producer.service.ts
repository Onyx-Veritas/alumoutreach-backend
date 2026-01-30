import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { PipelineRepository } from '../repositories/pipeline.repository';
import { PipelineJob, PipelineJobStatus, PipelineChannel } from '../entities';
import { PipelineEventType, PipelineSubjects, PipelineJobCreatedEvent, PipelineBatchCreatedEvent } from '../events';
import { QUEUE_NAMES, JOB_NAMES } from '../../queue/queue.constants';
import { PipelineJobData, TenantQueueConfig, EnqueueResult } from '../../queue/interfaces';
import { QueueConfigService } from '../../queue/services';

// ============ Types for Campaign Integration ============

export interface CampaignRunInfo {
  id: string;
  campaignId: string;
  tenantId: string;
  channel: string;
  templateVersionId?: string;
  campaignName?: string;
}

export interface ContactInfo {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  attributes?: Record<string, unknown>;
}

// ============ Pipeline Producer Service ============

@Injectable()
export class PipelineProducerService {
  private readonly logger: AppLoggerService;
  private readonly useBullMQ: boolean;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly eventBus: EventBusService,
    @Optional() @InjectQueue(QUEUE_NAMES.PIPELINE_JOBS)
    private readonly pipelineQueue?: Queue<PipelineJobData>,
    @Optional()
    private readonly queueConfigService?: QueueConfigService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineProducerService');
    this.useBullMQ = !!this.pipelineQueue;

    if (this.useBullMQ) {
      this.logger.info('BullMQ queue available - using queue-based processing');
    } else {
      this.logger.warn('BullMQ queue not available - using polling-based processing');
    }
  }

  /**
   * Enqueue jobs for a campaign run
   * Creates DB records and enqueues to BullMQ if available
   */
  async enqueueCampaignRun(
    campaignRun: CampaignRunInfo,
    contacts: ContactInfo[],
    correlationId: string,
  ): Promise<PipelineJob[]> {
    const startTime = this.logger.logOperationStart('enqueue campaign run', {
      tenantId: campaignRun.tenantId,
      campaignId: campaignRun.campaignId,
      campaignRunId: campaignRun.id,
      contactCount: contacts.length,
      correlationId,
    });

    if (contacts.length === 0) {
      this.logger.warn('No contacts to enqueue', {
        campaignRunId: campaignRun.id,
      });
      return [];
    }

    try {
      // Map channel string to enum
      const channel = this.mapChannel(campaignRun.channel);

      // Create job data for each contact
      const jobsData = contacts.map(contact => ({
        tenantId: campaignRun.tenantId,
        campaignId: campaignRun.campaignId,
        campaignRunId: campaignRun.id,
        contactId: contact.id,
        templateVersionId: campaignRun.templateVersionId,
        channel,
        payload: this.buildPayload(contact, channel, campaignRun.campaignName),
        status: PipelineJobStatus.PENDING,
        retryCount: 0,
      }));

      // Bulk create jobs in database
      const jobs = await this.pipelineRepository.createJobsBulk(jobsData);

      // Enqueue to BullMQ if available
      if (this.useBullMQ) {
        const enqueueResult = await this.enqueueToBullMQ(jobs, campaignRun, correlationId);
        this.logger.log('[BULLMQ] Jobs enqueued', {
          campaignRunId: campaignRun.id,
          totalJobs: jobs.length,
          enqueuedJobs: enqueueResult.enqueuedJobs,
          correlationId,
        });
      }

      // Publish batch created event
      await this.publishBatchCreatedEvent(campaignRun, jobs.length, channel, correlationId);

      // Publish individual job created events (in batches to avoid overwhelming NATS)
      await this.publishJobCreatedEvents(jobs, correlationId);

      this.logger.logOperationEnd('enqueue campaign run', startTime, {
        jobsCreated: jobs.length,
        useBullMQ: this.useBullMQ,
      });

      return jobs;
    } catch (error) {
      this.logger.logOperationEnd('enqueue campaign run', startTime, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Enqueue jobs to BullMQ with per-tenant rate limiting
   */
  private async enqueueToBullMQ(
    jobs: PipelineJob[],
    campaignRun: CampaignRunInfo,
    correlationId: string,
  ): Promise<EnqueueResult> {
    if (!this.pipelineQueue || !this.queueConfigService) {
      return { totalJobs: jobs.length, enqueuedJobs: 0, skippedJobs: jobs.length };
    }

    // Get tenant-specific queue config
    const tenantConfig = await this.queueConfigService.getTenantConfig(campaignRun.tenantId);

    // Build BullMQ jobs with rate limiting delays
    const bullJobs = jobs.map((job, index) => {
      const delay = this.queueConfigService!.calculateJobDelay(index, tenantConfig);

      const jobData: PipelineJobData = {
        jobId: job.id,
        tenantId: job.tenantId,
        correlationId,
        campaignId: job.campaignId,
        campaignRunId: job.campaignRunId,
        contactId: job.contactId,
        channel: job.channel,
        templateVersionId: job.templateVersionId || '',
      };

      return {
        name: JOB_NAMES.SEND_MESSAGE,
        data: jobData,
        opts: {
          ...this.queueConfigService!.getJobOptions(tenantConfig),
          delay,
          jobId: job.id, // Use DB ID for idempotency
        },
      };
    });

    // Bulk add to queue
    await this.pipelineQueue.addBulk(bullJobs);

    // Update job statuses to QUEUED
    const jobIds = jobs.map(j => j.id);
    await this.pipelineRepository.bulkUpdateStatus(jobIds, PipelineJobStatus.QUEUED);

    return {
      totalJobs: jobs.length,
      enqueuedJobs: jobs.length,
      skippedJobs: 0,
    };
  }

  /**
   * Create a single pipeline job
   */
  async createJob(
    tenantId: string,
    data: {
      campaignId: string;
      campaignRunId: string;
      contactId: string;
      channel: PipelineChannel;
      templateVersionId?: string;
      payload?: Record<string, unknown>;
    },
    correlationId: string,
  ): Promise<PipelineJob> {
    const startTime = this.logger.logOperationStart('create job', {
      tenantId,
      campaignId: data.campaignId,
      contactId: data.contactId,
      correlationId,
    });

    const job = await this.pipelineRepository.createJob({
      tenantId,
      ...data,
    });

    // Publish event
    await this.publishJobCreatedEvent(job, correlationId);

    this.logger.logOperationEnd('create job', startTime, { jobId: job.id });

    return job;
  }

  /**
   * Map channel string to enum
   */
  private mapChannel(channel: string): PipelineChannel {
    const channelMap: Record<string, PipelineChannel> = {
      email: PipelineChannel.EMAIL,
      sms: PipelineChannel.SMS,
      whatsapp: PipelineChannel.WHATSAPP,
      push: PipelineChannel.PUSH,
    };
    return channelMap[channel.toLowerCase()] || PipelineChannel.EMAIL;
  }

  /**
   * Build job payload based on contact and channel
   */
  private buildPayload(
    contact: ContactInfo,
    channel: PipelineChannel,
    campaignName?: string,
  ): Record<string, unknown> {
    const base = {
      contactId: contact.id,
      fullName: contact.fullName,
      attributes: contact.attributes,
      campaignName,
    };

    switch (channel) {
      case PipelineChannel.EMAIL:
        return { ...base, to: contact.email, recipientEmail: contact.email };
      case PipelineChannel.SMS:
      case PipelineChannel.WHATSAPP:
        return { ...base, to: contact.phone, recipientPhone: contact.phone };
      case PipelineChannel.PUSH:
        return { ...base };
      default:
        return base;
    }
  }

  /**
   * Publish job created event
   */
  private async publishJobCreatedEvent(job: PipelineJob, correlationId: string): Promise<void> {
    const event: PipelineJobCreatedEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_CREATED,
      tenantId: job.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        jobId: job.id,
        campaignId: job.campaignId,
        campaignRunId: job.campaignRunId,
        contactId: job.contactId,
        channel: job.channel,
        templateVersionId: job.templateVersionId,
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_CREATED, event, {
        correlationId,
        tenantId: job.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.JOB_CREATED, correlationId, {
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn('Failed to publish job created event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Publish job created events in batches
   */
  private async publishJobCreatedEvents(jobs: PipelineJob[], correlationId: string): Promise<void> {
    // Publish in batches of 100 to avoid overwhelming NATS
    const batchSize = 100;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      await Promise.all(batch.map(job => this.publishJobCreatedEvent(job, correlationId)));
    }
  }

  /**
   * Publish batch created event
   */
  private async publishBatchCreatedEvent(
    campaignRun: CampaignRunInfo,
    totalJobs: number,
    channel: PipelineChannel,
    correlationId: string,
  ): Promise<void> {
    const event: PipelineBatchCreatedEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.BATCH_CREATED,
      tenantId: campaignRun.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        campaignId: campaignRun.campaignId,
        campaignRunId: campaignRun.id,
        totalJobs,
        channel,
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.BATCH_CREATED, event, {
        correlationId,
        tenantId: campaignRun.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.BATCH_CREATED, correlationId, {
        campaignRunId: campaignRun.id,
        totalJobs,
      });
    } catch (error) {
      this.logger.warn('Failed to publish batch created event', {
        campaignRunId: campaignRun.id,
        error: (error as Error).message,
      });
    }
  }
}
