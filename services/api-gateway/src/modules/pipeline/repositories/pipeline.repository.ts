import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PipelineJob, PipelineFailure } from '../entities';
import { PipelineJobStatus, PipelineChannel, PipelineSkipReason } from '../entities/pipeline.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

// ============ State Machine Configuration ============

/**
 * Defines valid state transitions for pipeline jobs.
 * Key: current status, Value: array of allowed next statuses
 */
export const VALID_TRANSITIONS: Record<PipelineJobStatus, PipelineJobStatus[]> = {
  [PipelineJobStatus.PENDING]: [
    PipelineJobStatus.QUEUED,
    PipelineJobStatus.SKIPPED, // Can skip from pending if validation fails
    PipelineJobStatus.FAILED,  // Can fail from pending if critical error
  ],
  [PipelineJobStatus.QUEUED]: [
    PipelineJobStatus.PROCESSING,
    PipelineJobStatus.SKIPPED, // Can skip if pre-send validation fails
    PipelineJobStatus.FAILED,
  ],
  [PipelineJobStatus.PROCESSING]: [
    PipelineJobStatus.SENT,
    PipelineJobStatus.FAILED,
    PipelineJobStatus.SKIPPED, // Can skip during processing (e.g., invalid recipient discovered)
    PipelineJobStatus.DEAD,    // Max retries exhausted during processing
  ],
  [PipelineJobStatus.SENT]: [
    PipelineJobStatus.DELIVERED,
    PipelineJobStatus.FAILED, // Bounce, etc.
  ],
  [PipelineJobStatus.DELIVERED]: [], // Terminal state
  [PipelineJobStatus.FAILED]: [
    PipelineJobStatus.RETRYING,
    PipelineJobStatus.DEAD, // After max retries
    PipelineJobStatus.PENDING, // Manual retry reset
  ],
  [PipelineJobStatus.RETRYING]: [
    PipelineJobStatus.QUEUED,     // Re-queued for retry
    PipelineJobStatus.PROCESSING, // Being retried
    PipelineJobStatus.SENT,       // Retry succeeded
    PipelineJobStatus.FAILED,     // Retry failed
    PipelineJobStatus.DEAD,       // Max retries exceeded
  ],
  [PipelineJobStatus.DEAD]: [
    PipelineJobStatus.PENDING, // Manual retry reset
  ],
  [PipelineJobStatus.SKIPPED]: [], // Terminal state
};

/**
 * Maps status transitions to their timestamp fields
 */
export const STATUS_TIMESTAMP_MAP: Partial<Record<PipelineJobStatus, keyof PipelineJob>> = {
  [PipelineJobStatus.QUEUED]: 'queuedAt',
  [PipelineJobStatus.PROCESSING]: 'processingAt',
  [PipelineJobStatus.SENT]: 'sentAt',
  [PipelineJobStatus.DELIVERED]: 'deliveredAt',
  [PipelineJobStatus.FAILED]: 'failedAt',
  [PipelineJobStatus.SKIPPED]: 'skippedAt',
};

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly fromStatus: PipelineJobStatus,
    public readonly toStatus: PipelineJobStatus,
  ) {
    super(`Invalid state transition for job ${jobId}: ${fromStatus} -> ${toStatus}`);
    this.name = 'InvalidStateTransitionError';
  }
}

// ============ Pipeline Repository ============

@Injectable()
export class PipelineRepository {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepository: Repository<PipelineJob>,
    @InjectRepository(PipelineFailure)
    private readonly failureRepository: Repository<PipelineFailure>,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineRepository');
  }

  // ============ Job Operations ============

  /**
   * Create a new pipeline job
   */
  async createJob(jobData: Partial<PipelineJob>): Promise<PipelineJob> {
    const startTime = this.logger.logOperationStart('create job', {
      tenantId: jobData.tenantId,
      campaignId: jobData.campaignId,
      contactId: jobData.contactId,
    });

    const job = this.jobRepository.create({
      id: uuidv4(),
      status: PipelineJobStatus.PENDING,
      retryCount: 0,
      ...jobData,
    });

    const saved = await this.jobRepository.save(job);

    this.logger.logDbQuery('insert job', 1, { jobId: saved.id });
    this.logger.logOperationEnd('create job', startTime, { jobId: saved.id });

    return saved;
  }

  /**
   * Bulk create pipeline jobs
   */
  async createJobsBulk(jobsData: Partial<PipelineJob>[]): Promise<PipelineJob[]> {
    if (jobsData.length === 0) return [];

    const startTime = this.logger.logOperationStart('create jobs bulk', {
      count: jobsData.length,
      tenantId: jobsData[0]?.tenantId,
    });

    const jobs = jobsData.map(data =>
      this.jobRepository.create({
        id: uuidv4(),
        status: PipelineJobStatus.PENDING,
        retryCount: 0,
        ...data,
      }),
    );

    const saved = await this.jobRepository.save(jobs);

    this.logger.logDbQuery('insert jobs bulk', saved.length);
    this.logger.logOperationEnd('create jobs bulk', startTime, { count: saved.length });

    return saved;
  }

  /**
   * Find job by ID
   */
  async findJobById(tenantId: string, jobId: string): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('find job by id', { tenantId, jobId });

    const job = await this.jobRepository.findOne({
      where: { id: jobId, tenantId },
    });

    this.logger.logDbQuery('select job', job ? 1 : 0);
    this.logger.logOperationEnd('find job by id', startTime, { found: !!job });

    return job;
  }

  /**
   * Find job by provider message ID (e.g., SendGrid message ID)
   * Used by webhook processors to correlate delivery events back to pipeline jobs
   */
  async findByProviderMessageId(providerMessageId: string): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('find job by provider message id', { providerMessageId });

    const job = await this.jobRepository.findOne({
      where: { providerMessageId },
    });

    this.logger.logDbQuery('select job by provider message id', job ? 1 : 0);
    this.logger.logOperationEnd('find job by provider message id', startTime, { found: !!job });

    return job;
  }

  /**
   * Find jobs with pagination
   */
  async findJobs(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      campaignId?: string;
      campaignRunId?: string;
      contactId?: string;
      status?: PipelineJobStatus;
      channel?: PipelineChannel;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
  ): Promise<{ jobs: PipelineJob[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';

    const startTime = this.logger.logOperationStart('find jobs', {
      tenantId,
      page,
      limit,
      ...options,
    });

    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .where('job.tenant_id = :tenantId', { tenantId });

    if (options.campaignId) {
      queryBuilder.andWhere('job.campaign_id = :campaignId', { campaignId: options.campaignId });
    }

    if (options.campaignRunId) {
      queryBuilder.andWhere('job.campaign_run_id = :campaignRunId', {
        campaignRunId: options.campaignRunId,
      });
    }

    if (options.contactId) {
      queryBuilder.andWhere('job.contact_id = :contactId', { contactId: options.contactId });
    }

    if (options.status) {
      queryBuilder.andWhere('job.status = :status', { status: options.status });
    }

    if (options.channel) {
      queryBuilder.andWhere('job.channel = :channel', { channel: options.channel });
    }

    const columnMap: Record<string, string> = {
      createdAt: 'job.created_at',
      updatedAt: 'job.updated_at',
      status: 'job.status',
      retryCount: 'job.retry_count',
    };

    const orderColumn = columnMap[sortBy] || 'job.created_at';
    queryBuilder.orderBy(orderColumn, sortOrder);

    const [jobs, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    this.logger.logDbQuery('select jobs', jobs.length, { total });
    this.logger.logOperationEnd('find jobs', startTime, { count: jobs.length, total });

    return { jobs, total };
  }

  /**
   * Acquire next pending job for processing (SELECT FOR UPDATE SKIP LOCKED)
   */
  async acquireNextJob(tenantId?: string): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('acquire next job', { tenantId });

    const queryRunner = this.jobRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let query = `
        SELECT * FROM pipeline_jobs
        WHERE status = $1
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      `;
      const params: (string | Date)[] = [PipelineJobStatus.PENDING];

      if (tenantId) {
        query += ' AND tenant_id = $2';
        params.push(tenantId);
      }

      query += ' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED';

      const [job] = await queryRunner.query(query, params) as PipelineJob[];

      if (!job) {
        await queryRunner.rollbackTransaction();
        this.logger.logOperationEnd('acquire next job', startTime, { acquired: false });
        return null;
      }

      // Update status to PROCESSING
      await queryRunner.query(
        `UPDATE pipeline_jobs SET status = $1, updated_at = NOW() WHERE id = $2`,
        [PipelineJobStatus.PROCESSING, job.id],
      );

      await queryRunner.commitTransaction();

      this.logger.logDbQuery('acquire job', 1, { jobId: job.id });
      this.logger.logOperationEnd('acquire next job', startTime, { acquired: true, jobId: job.id });

      // Return updated job (raw query returns snake_case, so use job.tenant_id)
      const jobTenantId = (job as unknown as Record<string, string>).tenant_id;
      return this.findJobById(jobTenantId, job.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.logOperationEnd('acquire next job', startTime, {
        acquired: false,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update job status (basic - no state machine validation)
   * WARNING: Only use for MessageProcessor's onFailed handler and manual retry resets
   * where the caller manages transition validity. All other callers should use the
   * typed convenience methods (markJobSent, markJobFailed, etc.) which enforce the
   * state machine via transitionJobState().
   */
  async updateJobStatus(
    jobId: string,
    status: PipelineJobStatus,
    updates?: Partial<PipelineJob>,
  ): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('update job status', { jobId, status });

    // Auto-set timestamp for the status
    const timestampField = STATUS_TIMESTAMP_MAP[status];
    const timestampUpdate = timestampField ? { [timestampField]: new Date() } : {};

    await this.jobRepository.update(jobId, {
      status,
      ...timestampUpdate,
      ...updates,
    });

    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    this.logger.logDbQuery('update job status', 1, { jobId, status });
    this.logger.logOperationEnd('update job status', startTime, { jobId, status });

    return job;
  }

  /**
   * Mark job as sent (state machine enforced)
   */
  async markJobSent(
    jobId: string,
    providerMessageId?: string,
  ): Promise<PipelineJob> {
    return this.transitionJobState(jobId, PipelineJobStatus.SENT, {
      providerMessageId,
    });
  }

  /**
   * Mark job as delivered (state machine enforced)
   */
  async markJobDelivered(jobId: string): Promise<PipelineJob> {
    return this.transitionJobState(jobId, PipelineJobStatus.DELIVERED);
  }

  /**
   * Mark job as failed (state machine enforced)
   */
  async markJobFailed(jobId: string, errorMessage: string): Promise<PipelineJob> {
    return this.transitionJobState(jobId, PipelineJobStatus.FAILED, {
      errorMessage,
    });
  }

  /**
   * Mark job as skipped (state machine enforced)
   */
  async markJobSkipped(
    jobId: string,
    skipReason: PipelineSkipReason,
    errorMessage?: string,
  ): Promise<PipelineJob> {
    return this.transitionJobState(jobId, PipelineJobStatus.SKIPPED, {
      skipReason,
      errorMessage,
    });
  }

  /**
   * Transition job to a new state with state machine validation.
   * Throws InvalidStateTransitionError if the transition is not allowed.
   */
  async transitionJobState(
    jobId: string,
    toStatus: PipelineJobStatus,
    updates?: Partial<PipelineJob>,
  ): Promise<PipelineJob> {
    const startTime = this.logger.logOperationStart('transition job state', { jobId, toStatus });

    // Fetch current job state
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[job.status] || [];
    if (!allowedTransitions.includes(toStatus)) {
      this.logger.warn('[STATE MACHINE] Invalid state transition attempted', {
        jobId,
        fromStatus: job.status,
        toStatus,
        allowedTransitions,
      });
      throw new InvalidStateTransitionError(jobId, job.status, toStatus);
    }

    // Auto-set timestamp for the status
    const timestampField = STATUS_TIMESTAMP_MAP[toStatus];
    const timestampUpdate = timestampField ? { [timestampField]: new Date() } : {};

    await this.jobRepository.update(jobId, {
      status: toStatus,
      ...timestampUpdate,
      ...updates,
    });

    const updatedJob = await this.jobRepository.findOne({ where: { id: jobId } });

    this.logger.logDbQuery('transition job state', 1, {
      jobId,
      fromStatus: job.status,
      toStatus,
    });
    this.logger.logOperationEnd('transition job state', startTime, {
      jobId,
      fromStatus: job.status,
      toStatus,
    });

    return updatedJob!;
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromStatus: PipelineJobStatus, toStatus: PipelineJobStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Bulk update status for multiple jobs
   */
  async bulkUpdateStatus(
    jobIds: string[],
    status: PipelineJobStatus,
  ): Promise<number> {
    if (jobIds.length === 0) return 0;

    const startTime = this.logger.logOperationStart('bulk update status', {
      count: jobIds.length,
      status,
    });

    const result = await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status, updatedAt: new Date() })
      .whereInIds(jobIds)
      .execute();

    const affected = result.affected || 0;
    this.logger.logDbQuery('bulk update status', affected);
    this.logger.logOperationEnd('bulk update status', startTime, { affected });

    return affected;
  }

  /**
   * Find retryable jobs
   */
  async findRetryableJobs(
    maxRetries: number,
    limit: number = 100,
  ): Promise<PipelineJob[]> {
    const startTime = this.logger.logOperationStart('find retryable jobs', { maxRetries, limit });

    const jobs = await this.jobRepository.find({
      where: {
        status: In([PipelineJobStatus.FAILED, PipelineJobStatus.RETRYING]),
        retryCount: LessThanOrEqual(maxRetries),
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    this.logger.logDbQuery('select retryable jobs', jobs.length);
    this.logger.logOperationEnd('find retryable jobs', startTime, { count: jobs.length });

    return jobs;
  }

  /**
   * Schedule job for retry (state machine enforced)
   */
  async scheduleRetry(
    jobId: string,
    nextAttemptAt: Date,
    incrementRetry: boolean = true,
  ): Promise<PipelineJob> {
    const startTime = this.logger.logOperationStart('schedule retry', { jobId, nextAttemptAt });

    // Need current retryCount before transitioning
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const updates: Partial<PipelineJob> = { nextAttemptAt };
    if (incrementRetry) {
      updates.retryCount = job.retryCount + 1;
    }

    const result = await this.transitionJobState(jobId, PipelineJobStatus.RETRYING, updates);

    this.logger.logDbQuery('schedule retry', 1, { jobId, retryCount: updates.retryCount });
    this.logger.logOperationEnd('schedule retry', startTime, { jobId });

    return result;
  }

  /**
   * Mark job as dead after max retries (state machine enforced)
   */
  async markJobDead(jobId: string, errorMessage: string): Promise<PipelineJob> {
    return this.transitionJobState(jobId, PipelineJobStatus.DEAD, { errorMessage });
  }

  /**
   * Find dead jobs
   */
  async findDeadJobs(
    tenantId: string,
    options: { page?: number; limit?: number },
  ): Promise<{ jobs: PipelineJob[]; total: number }> {
    return this.findJobs(tenantId, {
      ...options,
      status: PipelineJobStatus.DEAD,
    });
  }

  /**
   * Get job stats by status for a campaign
   */
  async getJobStatsByCampaign(
    tenantId: string,
    campaignId: string,
  ): Promise<Record<string, number>> {
    const startTime = this.logger.logOperationStart('get job stats', { tenantId, campaignId });

    const result = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('job.tenant_id = :tenantId', { tenantId })
      .andWhere('job.campaign_id = :campaignId', { campaignId })
      .groupBy('job.status')
      .getRawMany();

    const stats: Record<string, number> = { total: 0 };
    for (const row of result) {
      const count = parseInt(row.count, 10);
      stats[row.status] = count;
      stats.total += count;
    }

    this.logger.logDbQuery('get job stats', 1);
    this.logger.logOperationEnd('get job stats', startTime, stats);

    return stats;
  }

  // ============ Failure Operations ============

  /**
   * Record a failure
   */
  async recordFailure(failureData: Partial<PipelineFailure>): Promise<PipelineFailure> {
    const startTime = this.logger.logOperationStart('record failure', {
      jobId: failureData.jobId,
      tenantId: failureData.tenantId,
    });

    const failure = this.failureRepository.create({
      id: uuidv4(),
      ...failureData,
    });

    const saved = await this.failureRepository.save(failure);

    this.logger.logDbQuery('insert failure', 1, { failureId: saved.id });
    this.logger.logOperationEnd('record failure', startTime, { failureId: saved.id });

    return saved;
  }

  /**
   * Find failures with pagination
   */
  async findFailures(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      campaignId?: string;
      jobId?: string;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
  ): Promise<{ failures: PipelineFailure[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';

    const startTime = this.logger.logOperationStart('find failures', {
      tenantId,
      page,
      limit,
    });

    const queryBuilder = this.failureRepository
      .createQueryBuilder('failure')
      .where('failure.tenant_id = :tenantId', { tenantId });

    if (options.campaignId) {
      queryBuilder.andWhere('failure.campaign_id = :campaignId', {
        campaignId: options.campaignId,
      });
    }

    if (options.jobId) {
      queryBuilder.andWhere('failure.job_id = :jobId', { jobId: options.jobId });
    }

    const columnMap: Record<string, string> = {
      createdAt: 'failure.created_at',
    };

    const orderColumn = columnMap[sortBy] || 'failure.created_at';
    queryBuilder.orderBy(orderColumn, sortOrder);

    const [failures, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    this.logger.logDbQuery('select failures', failures.length, { total });
    this.logger.logOperationEnd('find failures', startTime, { count: failures.length, total });

    return { failures, total };
  }
}
