import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PipelineJob, PipelineFailure } from '../entities';
import { PipelineJobStatus, PipelineChannel } from '../entities/pipeline.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

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
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: PipelineJobStatus,
    updates?: Partial<PipelineJob>,
  ): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('update job status', { jobId, status });

    await this.jobRepository.update(jobId, {
      status,
      ...updates,
    });

    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    this.logger.logDbQuery('update job status', 1, { jobId, status });
    this.logger.logOperationEnd('update job status', startTime, { jobId, status });

    return job;
  }

  /**
   * Mark job as sent
   */
  async markJobSent(
    jobId: string,
    providerMessageId?: string,
  ): Promise<PipelineJob | null> {
    return this.updateJobStatus(jobId, PipelineJobStatus.SENT, {
      providerMessageId,
      sentAt: new Date(),
    });
  }

  /**
   * Mark job as delivered
   */
  async markJobDelivered(jobId: string): Promise<PipelineJob | null> {
    return this.updateJobStatus(jobId, PipelineJobStatus.DELIVERED, {
      deliveredAt: new Date(),
    });
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId: string, errorMessage: string): Promise<PipelineJob | null> {
    return this.updateJobStatus(jobId, PipelineJobStatus.FAILED, {
      errorMessage,
    });
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
   * Schedule job for retry
   */
  async scheduleRetry(
    jobId: string,
    nextAttemptAt: Date,
    incrementRetry: boolean = true,
  ): Promise<PipelineJob | null> {
    const startTime = this.logger.logOperationStart('schedule retry', { jobId, nextAttemptAt });

    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      this.logger.logOperationEnd('schedule retry', startTime, { found: false });
      return null;
    }

    const updates: Partial<PipelineJob> = {
      status: PipelineJobStatus.RETRYING,
      nextAttemptAt,
    };

    if (incrementRetry) {
      updates.retryCount = job.retryCount + 1;
    }

    await this.jobRepository.update(jobId, updates);

    this.logger.logDbQuery('schedule retry', 1, { jobId, retryCount: updates.retryCount });
    this.logger.logOperationEnd('schedule retry', startTime, { jobId });

    return this.jobRepository.findOne({ where: { id: jobId } });
  }

  /**
   * Mark job as dead (after max retries)
   */
  async markJobDead(jobId: string, errorMessage: string): Promise<PipelineJob | null> {
    return this.updateJobStatus(jobId, PipelineJobStatus.DEAD, { errorMessage });
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
