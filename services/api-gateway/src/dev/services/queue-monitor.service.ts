import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobType } from 'bullmq';
import { QUEUE_NAMES } from '../../modules/queue/queue.constants';
import { AppLoggerService } from '../../common/logger/app-logger.service';

export interface QueueStats {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  isPaused: boolean;
}

export interface JobSummary {
  id: string;
  name: string;
  data: {
    campaignId?: string;
    recipientId?: string;
    channel?: string;
    [key: string]: unknown;
  };
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  progress: unknown;
  timestamp: number;
  state: string;
}

export interface QueueDashboard {
  timestamp: string;
  queues: QueueStats[];
  totalJobs: number;
  recentJobs: JobSummary[];
  recentFailures: JobSummary[];
}

/**
 * Service for monitoring BullMQ queues in dev playground
 */
@Injectable()
export class QueueMonitorService {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectQueue(QUEUE_NAMES.PIPELINE_JOBS)
    private readonly pipelineQueue: Queue,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('QueueMonitorService');
  }

  /**
   * Get overview of all queues
   */
  async getQueuesDashboard(recentLimit: number = 20): Promise<QueueDashboard> {
    const queues: QueueStats[] = [];
    let totalJobs = 0;

    // Get stats for pipeline queue
    const pipelineStats = await this.getQueueStats(this.pipelineQueue);
    queues.push(pipelineStats);
    totalJobs += Object.values(pipelineStats.counts).reduce((a, b) => a + b, 0);

    // Get recent jobs
    const recentJobs = await this.getRecentJobs(this.pipelineQueue, recentLimit);

    // Get recent failures
    const recentFailures = await this.getFailedJobs(this.pipelineQueue, recentLimit);

    return {
      timestamp: new Date().toISOString(),
      queues,
      totalJobs,
      recentJobs,
      recentFailures,
    };
  }

  /**
   * Get stats for a specific queue
   */
  async getQueueStats(queue: Queue): Promise<QueueStats> {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );

    const isPaused = await queue.isPaused();

    return {
      name: queue.name,
      counts: {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
      },
      isPaused,
    };
  }

  /**
   * Get recent completed and active jobs
   */
  async getRecentJobs(queue: Queue, limit: number = 20): Promise<JobSummary[]> {
    const completed = await queue.getJobs(['completed'], 0, limit);
    const active = await queue.getJobs(['active'], 0, limit);
    const waiting = await queue.getJobs(['waiting'], 0, limit);

    const jobs = [...completed, ...active, ...waiting]
      .filter((job): job is Job => !!job)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);

    return Promise.all(jobs.map((job) => this.jobToSummary(job)));
  }

  /**
   * Get recent failed jobs
   */
  async getFailedJobs(queue: Queue, limit: number = 20): Promise<JobSummary[]> {
    const failed = await queue.getJobs(['failed'], 0, limit);

    return Promise.all(
      failed
        .filter((job): job is Job => !!job)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limit)
        .map((job) => this.jobToSummary(job)),
    );
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: string): Promise<JobSummary | null> {
    const job = await this.pipelineQueue.getJob(jobId);
    if (!job) {
      return null;
    }
    return this.jobToSummary(job);
  }

  /**
   * Get jobs for a specific campaign
   */
  async getJobsByCampaign(
    campaignId: string,
    states: JobType[] = ['completed', 'failed', 'active', 'waiting'],
    limit: number = 100,
  ): Promise<JobSummary[]> {
    const allJobs: Job[] = [];

    for (const state of states) {
      const jobs = await this.pipelineQueue.getJobs([state], 0, limit);
      allJobs.push(...jobs.filter((job): job is Job => !!job));
    }

    const campaignJobs = allJobs
      .filter((job) => job.data?.campaignId === campaignId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit);

    return Promise.all(campaignJobs.map((job) => this.jobToSummary(job)));
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.pipelineQueue.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state !== 'failed') {
      return false;
    }

    await job.retry();
    this.logger.log(`Retried job ${jobId}`);
    return true;
  }

  /**
   * Clean up completed/failed jobs
   */
  async cleanJobs(grace: number = 0): Promise<{ completed: number; failed: number }> {
    const completedCount = await this.pipelineQueue.clean(grace, 1000, 'completed');
    const failedCount = await this.pipelineQueue.clean(grace, 1000, 'failed');

    this.logger.log(`Cleaned ${completedCount.length} completed and ${failedCount.length} failed jobs`);

    return {
      completed: completedCount.length,
      failed: failedCount.length,
    };
  }

  /**
   * Convert Job to JobSummary
   */
  private async jobToSummary(job: Job): Promise<JobSummary> {
    const state = await job.getState();

    return {
      id: job.id || 'unknown',
      name: job.name,
      data: {
        campaignId: job.data?.campaignId,
        recipientId: job.data?.recipientId,
        channel: job.data?.channel,
        ...job.data,
      },
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      progress: job.progress,
      timestamp: job.timestamp,
      state,
    };
  }
}
