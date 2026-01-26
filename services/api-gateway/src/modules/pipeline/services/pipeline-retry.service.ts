import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { PipelineRepository } from '../repositories/pipeline.repository';
import { PipelineJob, PipelineJobStatus } from '../entities';
import {
  PipelineEventType,
  PipelineSubjects,
  PipelineJobRetryingEvent,
  PipelineJobDeadEvent,
} from '../events';

// ============ Retry Configuration ============

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_INTERVAL_MS = 60000; // 1 minute
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

// ============ Pipeline Retry Service ============

@Injectable()
export class PipelineRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLoggerService;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly maxRetries: number;
  private readonly baseRetryIntervalMs: number;
  private readonly backoffMultiplier: number;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineRetryService');

    // Load configuration from environment or use defaults
    this.maxRetries = parseInt(process.env.PIPELINE_MAX_RETRIES || '', 10) || DEFAULT_MAX_RETRIES;
    this.baseRetryIntervalMs =
      parseInt(process.env.PIPELINE_RETRY_INTERVAL_MS || '', 10) || DEFAULT_RETRY_INTERVAL_MS;
    this.backoffMultiplier =
      parseFloat(process.env.PIPELINE_BACKOFF_MULTIPLIER || '') || DEFAULT_BACKOFF_MULTIPLIER;
    this.pollIntervalMs =
      parseInt(process.env.PIPELINE_RETRY_POLL_INTERVAL_MS || '', 10) || DEFAULT_POLL_INTERVAL_MS;
  }

  async onModuleInit(): Promise<void> {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  /**
   * Start the retry service
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Retry service already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting pipeline retry service', {
      maxRetries: this.maxRetries,
      baseRetryIntervalMs: this.baseRetryIntervalMs,
      backoffMultiplier: this.backoffMultiplier,
      pollIntervalMs: this.pollIntervalMs,
    });

    this.pollInterval = setInterval(() => this.processRetries(), this.pollIntervalMs);
  }

  /**
   * Stop the retry service
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.logger.info('Pipeline retry service stopped');
  }

  /**
   * Process retryable jobs
   */
  async processRetries(): Promise<void> {
    if (!this.isRunning) return;

    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('process retries', { correlationId });

    try {
      // Find failed jobs that need retry
      const failedJobs = await this.pipelineRepository.findRetryableJobs(this.maxRetries, 100);

      if (failedJobs.length === 0) {
        this.logger.logOperationEnd('process retries', startTime, { processed: 0 });
        return;
      }

      let retriedCount = 0;
      let deadCount = 0;

      for (const job of failedJobs) {
        if (job.retryCount >= this.maxRetries) {
          // Move to DEAD
          await this.markJobDead(job, correlationId);
          deadCount++;
        } else {
          // Schedule retry
          await this.scheduleRetry(job, correlationId);
          retriedCount++;
        }
      }

      this.logger.logOperationEnd('process retries', startTime, {
        found: failedJobs.length,
        retried: retriedCount,
        dead: deadCount,
      });
    } catch (error) {
      this.logger.logOperationEnd('process retries', startTime, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Schedule a job for retry
   */
  private async scheduleRetry(job: PipelineJob, correlationId: string): Promise<void> {
    const nextRetryCount = job.retryCount + 1;
    const delay = this.calculateBackoff(nextRetryCount);
    const nextAttemptAt = new Date(Date.now() + delay);

    this.logger.debug('Scheduling retry', {
      jobId: job.id,
      retryCount: nextRetryCount,
      delay,
      nextAttemptAt: nextAttemptAt.toISOString(),
    });

    // Update job for retry
    await this.pipelineRepository.scheduleRetry(job.id, nextAttemptAt, true);

    // Publish event
    await this.publishRetryingEvent(job, nextRetryCount, nextAttemptAt, correlationId);
  }

  /**
   * Mark a job as dead after max retries
   */
  private async markJobDead(job: PipelineJob, correlationId: string): Promise<void> {
    this.logger.info('Marking job as dead', {
      jobId: job.id,
      retryCount: job.retryCount,
      errorMessage: job.errorMessage,
    });

    // Update job status to DEAD
    await this.pipelineRepository.markJobDead(job.id, job.errorMessage || 'Max retries exceeded');

    // Record failure
    await this.pipelineRepository.recordFailure({
      tenantId: job.tenantId,
      jobId: job.id,
      campaignId: job.campaignId,
      contactId: job.contactId,
      errorMessage: job.errorMessage || 'Max retries exceeded',
      lastStatus: PipelineJobStatus.DEAD,
      retryCount: job.retryCount,
    });

    // Publish event
    await this.publishDeadEvent(job, correlationId);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    return this.baseRetryIntervalMs * Math.pow(this.backoffMultiplier, retryCount - 1);
  }

  /**
   * Manually retry a specific job
   */
  async retryJob(tenantId: string, jobId: string): Promise<PipelineJob | null> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('manual retry job', {
      tenantId,
      jobId,
      correlationId,
    });

    const job = await this.pipelineRepository.findJobById(tenantId, jobId);

    if (!job) {
      this.logger.logOperationEnd('manual retry job', startTime, { found: false });
      return null;
    }

    // Check if job can be retried
    if (![PipelineJobStatus.FAILED, PipelineJobStatus.DEAD].includes(job.status)) {
      this.logger.warn('Job cannot be retried', {
        jobId,
        currentStatus: job.status,
      });
      return job;
    }

    // Reset job for immediate retry
    const nextAttemptAt = new Date();
    const updated = await this.pipelineRepository.updateJobStatus(jobId, PipelineJobStatus.PENDING, {
      nextAttemptAt,
      errorMessage: undefined,
    });

    this.logger.logOperationEnd('manual retry job', startTime, {
      newStatus: PipelineJobStatus.PENDING,
    });

    return updated;
  }

  /**
   * Publish retrying event
   */
  private async publishRetryingEvent(
    job: PipelineJob,
    retryCount: number,
    nextAttemptAt: Date,
    correlationId: string,
  ): Promise<void> {
    const event: PipelineJobRetryingEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_RETRYING,
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
        retryCount,
        nextAttemptAt: nextAttemptAt.toISOString(),
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_RETRYING, event, {
        correlationId,
        tenantId: job.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.JOB_RETRYING, correlationId, {
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn('Failed to publish retrying event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Publish dead event
   */
  private async publishDeadEvent(job: PipelineJob, correlationId: string): Promise<void> {
    const event: PipelineJobDeadEvent = {
      eventId: uuidv4(),
      eventType: PipelineEventType.JOB_DEAD,
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
        errorMessage: job.errorMessage || 'Max retries exceeded',
        retryCount: job.retryCount,
      },
    };

    try {
      await this.eventBus.publish(PipelineSubjects.JOB_DEAD, event, {
        correlationId,
        tenantId: job.tenantId,
      });
      this.logger.logEventPublish(PipelineEventType.JOB_DEAD, correlationId, {
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn('Failed to publish dead event', {
        jobId: job.id,
        error: (error as Error).message,
      });
    }
  }
}
