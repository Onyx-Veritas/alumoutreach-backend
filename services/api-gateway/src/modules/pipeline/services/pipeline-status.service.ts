import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { PipelineRepository } from '../repositories/pipeline.repository';
import { PipelineJob, PipelineFailure, PipelineJobStatus } from '../entities';
import { PipelineMapper } from '../mappers/pipeline.mapper';
import {
  PipelineJobSearchDto,
  PipelineFailureSearchDto,
  PaginatedPipelineJobsResponseDto,
  PaginatedPipelineFailuresResponseDto,
  PipelineJobResponseDto,
  PipelineJobStatsDto,
} from '../dto';

// ============ Pipeline Status Service ============

@Injectable()
export class PipelineStatusService {
  private readonly logger: AppLoggerService;

  constructor(private readonly pipelineRepository: PipelineRepository) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineStatusService');
  }

  /**
   * Get a job by ID
   */
  async getJob(tenantId: string, jobId: string): Promise<PipelineJobResponseDto | null> {
    const startTime = this.logger.logOperationStart('get job', { tenantId, jobId });

    const job = await this.pipelineRepository.findJobById(tenantId, jobId);

    if (!job) {
      this.logger.logOperationEnd('get job', startTime, { found: false });
      return null;
    }

    this.logger.logOperationEnd('get job', startTime, { found: true });
    return PipelineMapper.toJobResponseDto(job);
  }

  /**
   * List jobs with pagination and filters
   */
  async listJobs(
    tenantId: string,
    searchDto: PipelineJobSearchDto,
    correlationId: string,
  ): Promise<PaginatedPipelineJobsResponseDto> {
    const startTime = this.logger.logOperationStart('list jobs', {
      tenantId,
      correlationId,
      ...searchDto,
    });

    const { jobs, total } = await this.pipelineRepository.findJobs(tenantId, {
      page: searchDto.page,
      limit: searchDto.limit,
      campaignId: searchDto.campaignId,
      campaignRunId: searchDto.campaignRunId,
      contactId: searchDto.contactId,
      status: searchDto.status,
      channel: searchDto.channel,
      sortBy: searchDto.sortBy,
      sortOrder: searchDto.sortOrder,
    });

    this.logger.logOperationEnd('list jobs', startTime, {
      count: jobs.length,
      total,
    });

    return PipelineMapper.toPaginatedJobsResponseDto(
      jobs,
      total,
      searchDto.page || 1,
      searchDto.limit || 20,
    );
  }

  /**
   * List failures with pagination
   */
  async listFailures(
    tenantId: string,
    searchDto: PipelineFailureSearchDto,
    correlationId: string,
  ): Promise<PaginatedPipelineFailuresResponseDto> {
    const startTime = this.logger.logOperationStart('list failures', {
      tenantId,
      correlationId,
      ...searchDto,
    });

    const { failures, total } = await this.pipelineRepository.findFailures(tenantId, {
      page: searchDto.page,
      limit: searchDto.limit,
      campaignId: searchDto.campaignId,
      jobId: searchDto.jobId,
      sortBy: searchDto.sortBy,
      sortOrder: searchDto.sortOrder,
    });

    this.logger.logOperationEnd('list failures', startTime, {
      count: failures.length,
      total,
    });

    return PipelineMapper.toPaginatedFailuresResponseDto(
      failures,
      total,
      searchDto.page || 1,
      searchDto.limit || 20,
    );
  }

  /**
   * List dead jobs
   */
  async listDeadJobs(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    correlationId: string,
  ): Promise<PaginatedPipelineJobsResponseDto> {
    const startTime = this.logger.logOperationStart('list dead jobs', {
      tenantId,
      page,
      limit,
      correlationId,
    });

    const { jobs, total } = await this.pipelineRepository.findDeadJobs(tenantId, {
      page,
      limit,
    });

    this.logger.logOperationEnd('list dead jobs', startTime, {
      count: jobs.length,
      total,
    });

    return PipelineMapper.toPaginatedJobsResponseDto(jobs, total, page, limit);
  }

  /**
   * Get job stats for a campaign
   */
  async getJobStats(
    tenantId: string,
    campaignId: string,
    correlationId: string,
  ): Promise<PipelineJobStatsDto> {
    const startTime = this.logger.logOperationStart('get job stats', {
      tenantId,
      campaignId,
      correlationId,
    });

    const stats = await this.pipelineRepository.getJobStatsByCampaign(tenantId, campaignId);

    this.logger.logOperationEnd('get job stats', startTime, stats);

    return PipelineMapper.toJobStatsDto(stats);
  }

  /**
   * Get overall pipeline health metrics
   */
  async getPipelineHealth(tenantId: string, correlationId: string): Promise<{
    pendingJobs: number;
    processingJobs: number;
    failedJobs: number;
    deadJobs: number;
    isHealthy: boolean;
  }> {
    const startTime = this.logger.logOperationStart('get pipeline health', {
      tenantId,
      correlationId,
    });

    // Get counts for each status
    const pendingResult = await this.pipelineRepository.findJobs(tenantId, {
      status: PipelineJobStatus.PENDING,
      limit: 1,
    });
    const processingResult = await this.pipelineRepository.findJobs(tenantId, {
      status: PipelineJobStatus.PROCESSING,
      limit: 1,
    });
    const failedResult = await this.pipelineRepository.findJobs(tenantId, {
      status: PipelineJobStatus.FAILED,
      limit: 1,
    });
    const deadResult = await this.pipelineRepository.findJobs(tenantId, {
      status: PipelineJobStatus.DEAD,
      limit: 1,
    });

    const health = {
      pendingJobs: pendingResult.total,
      processingJobs: processingResult.total,
      failedJobs: failedResult.total,
      deadJobs: deadResult.total,
      isHealthy: deadResult.total < 100 && failedResult.total < 1000,
    };

    this.logger.logOperationEnd('get pipeline health', startTime, health);

    return health;
  }
}
