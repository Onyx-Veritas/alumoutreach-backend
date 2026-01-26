import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { PipelineRepository } from '../repositories/pipeline.repository';
import { PipelineJob, PipelineJobStatus, PipelineChannel } from '../entities';
import { PipelineEventType, PipelineSubjects, PipelineJobCreatedEvent, PipelineBatchCreatedEvent } from '../events';

// ============ Types for Campaign Integration ============

export interface CampaignRunInfo {
  id: string;
  campaignId: string;
  tenantId: string;
  channel: string;
  templateVersionId?: string;
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

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineProducerService');
  }

  /**
   * Enqueue jobs for a campaign run
   * Called by CampaignDispatchService to create pipeline jobs
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
        payload: this.buildPayload(contact, channel),
        status: PipelineJobStatus.PENDING,
        retryCount: 0,
      }));

      // Bulk create jobs
      const jobs = await this.pipelineRepository.createJobsBulk(jobsData);

      // Publish batch created event
      await this.publishBatchCreatedEvent(campaignRun, jobs.length, channel, correlationId);

      // Publish individual job created events (in batches to avoid overwhelming NATS)
      await this.publishJobCreatedEvents(jobs, correlationId);

      this.logger.logOperationEnd('enqueue campaign run', startTime, {
        jobsCreated: jobs.length,
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
  private buildPayload(contact: ContactInfo, channel: PipelineChannel): Record<string, unknown> {
    const base = {
      contactId: contact.id,
      fullName: contact.fullName,
      attributes: contact.attributes,
    };

    switch (channel) {
      case PipelineChannel.EMAIL:
        return { ...base, to: contact.email };
      case PipelineChannel.SMS:
      case PipelineChannel.WHATSAPP:
        return { ...base, to: contact.phone };
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
