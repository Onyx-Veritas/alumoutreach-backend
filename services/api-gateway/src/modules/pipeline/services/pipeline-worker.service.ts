import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { PipelineRepository } from '../repositories/pipeline.repository';
import { PipelineJob, PipelineJobStatus, PipelineChannel } from '../entities';
import {
  PipelineEventType,
  PipelineSubjects,
  PipelineJobStartedEvent,
  PipelineJobSentEvent,
  PipelineJobFailedEvent,
} from '../events';

// ============ Send Result Interface ============

interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

// ============ Pipeline Worker Service ============

@Injectable()
export class PipelineWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLoggerService;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 1000; // Poll every second
  private readonly maxConcurrent = 10; // Max concurrent jobs
  private activeJobs = 0;
  private readonly useBullMQ: boolean;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineWorkerService');
    
    // Check if BullMQ is enabled - if so, disable this polling worker
    // BullMQ is now the default execution engine
    this.useBullMQ = process.env.PIPELINE_USE_BULLMQ !== 'false';
  }

  async onModuleInit(): Promise<void> {
    if (this.useBullMQ) {
      this.logger.info('BullMQ is the active execution engine - polling worker DISABLED');
      return;
    }
    // Start worker in background (legacy fallback only)
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  /**
   * Start the worker (legacy mode only)
   */
  start(): void {
    if (this.useBullMQ) {
      this.logger.warn('Cannot start polling worker - BullMQ is enabled');
      return;
    }
    
    if (this.isRunning) {
      this.logger.warn('Worker already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting pipeline worker (LEGACY MODE)', {
      pollIntervalMs: this.pollIntervalMs,
      maxConcurrent: this.maxConcurrent,
    });

    this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.logger.info('Pipeline worker stopped');
  }

  /**
   * Poll for pending jobs
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    if (this.activeJobs >= this.maxConcurrent) return;

    try {
      const job = await this.pipelineRepository.acquireNextJob();
      if (job) {
        this.activeJobs++;
        // Process job in background
        this.processJob(job).finally(() => {
          this.activeJobs--;
        });
      }
    } catch (error) {
      this.logger.warn('Poll error', { error: (error as Error).message });
    }
  }

  /**
   * Process a single job
   */
  async processJob(job: PipelineJob): Promise<void> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('process job', {
      jobId: job.id,
      tenantId: job.tenantId,
      campaignId: job.campaignId,
      contactId: job.contactId,
      channel: job.channel,
      correlationId,
    });

    try {
      // Publish job started event
      await this.publishJobStartedEvent(job, correlationId);

      // TODO: Load template version and render
      // For now, use payload as-is
      const renderedContent = await this.renderTemplate(job);

      // Send via channel
      const result = await this.sendMessage(job, renderedContent);

      if (result.success) {
        // Mark as sent
        await this.pipelineRepository.markJobSent(job.id, result.providerMessageId);

        // Publish sent event
        await this.publishJobSentEvent(job, result.providerMessageId, correlationId);

        this.logger.logOperationEnd('process job', startTime, {
          status: 'sent',
          providerMessageId: result.providerMessageId,
        });
      } else {
        // Mark as failed
        await this.pipelineRepository.markJobFailed(job.id, result.error || 'Unknown error');

        // Publish failed event
        await this.publishJobFailedEvent(job, result.error || 'Unknown error', correlationId);

        this.logger.logOperationEnd('process job', startTime, {
          status: 'failed',
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Mark as failed
      await this.pipelineRepository.markJobFailed(job.id, errorMessage);

      // Publish failed event
      await this.publishJobFailedEvent(job, errorMessage, correlationId);

      this.logger.logOperationEnd('process job', startTime, {
        status: 'error',
        error: errorMessage,
      });
    }
  }

  /**
   * Render template (placeholder - integrate with template service)
   */
  private async renderTemplate(job: PipelineJob): Promise<Record<string, unknown>> {
    // TODO: Integrate with TemplatesService to render template
    // For now, return payload as-is
    return {
      ...job.payload,
      templateVersionId: job.templateVersionId,
    };
  }

  /**
   * Send message via appropriate channel (mock implementation)
   */
  private async sendMessage(
    job: PipelineJob,
    content: Record<string, unknown>,
  ): Promise<SendResult> {
    const startTime = this.logger.logOperationStart('send message', {
      jobId: job.id,
      channel: job.channel,
    });

    try {
      // Mock implementation - simulate send with random success/failure
      // TODO: Integrate with actual channel senders from campaigns module
      await this.simulateDelay(100, 500);

      const successRate = this.getChannelSuccessRate(job.channel);
      const success = Math.random() < successRate;

      if (success) {
        const providerMessageId = `msg_${uuidv4().substring(0, 8)}`;
        this.logger.logOperationEnd('send message', startTime, {
          success: true,
          providerMessageId,
        });
        return { success: true, providerMessageId };
      } else {
        const error = this.getRandomError();
        this.logger.logOperationEnd('send message', startTime, {
          success: false,
          error,
        });
        return { success: false, error };
      }
    } catch (error) {
      this.logger.logOperationEnd('send message', startTime, {
        success: false,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get channel success rate for mock
   */
  private getChannelSuccessRate(channel: PipelineChannel): number {
    const rates: Record<PipelineChannel, number> = {
      [PipelineChannel.EMAIL]: 0.95,
      [PipelineChannel.SMS]: 0.92,
      [PipelineChannel.WHATSAPP]: 0.90,
      [PipelineChannel.PUSH]: 0.88,
    };
    return rates[channel] || 0.90;
  }

  /**
   * Get random error message for mock
   */
  private getRandomError(): string {
    const errors = [
      'Recipient address rejected',
      'Connection timeout',
      'Rate limit exceeded',
      'Invalid phone number',
      'Message too long',
      'Insufficient credits',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  /**
   * Simulate network delay
   */
  private simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Publish job started event
   */
  private async publishJobStartedEvent(job: PipelineJob, correlationId: string): Promise<void> {
    const event: PipelineJobStartedEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_STARTED,
      tenantId: job.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        channel: job.channel,
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_STARTED, event, {
        correlationId,
        tenantId: job.tenantId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish job started event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Publish job sent event
   */
  private async publishJobSentEvent(
    job: PipelineJob,
    providerMessageId: string | undefined,
    correlationId: string,
  ): Promise<void> {
    const event: PipelineJobSentEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_SENT,
      tenantId: job.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        channel: job.channel,
        providerMessageId: providerMessageId || '',
        sentAt: new Date().toISOString(),
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_SENT, event, {
        correlationId,
        tenantId: job.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.JOB_SENT, correlationId, {
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn('Failed to publish job sent event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Publish job failed event
   */
  private async publishJobFailedEvent(
    job: PipelineJob,
    errorMessage: string,
    correlationId: string,
  ): Promise<void> {
    const event: PipelineJobFailedEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_FAILED,
      tenantId: job.tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload: {
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        channel: job.channel,
        errorMessage,
        retryCount: job.retryCount,
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_FAILED, event, {
        correlationId,
        tenantId: job.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.JOB_FAILED, correlationId, {
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn('Failed to publish job failed event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }
}
