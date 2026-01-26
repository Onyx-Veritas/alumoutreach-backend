import { PipelineJob, PipelineFailure } from '../entities';
import {
  PipelineJobResponseDto,
  PipelineFailureResponseDto,
  PaginatedPipelineJobsResponseDto,
  PaginatedPipelineFailuresResponseDto,
  PaginationMeta,
  PipelineJobStatsDto,
} from '../dto';
import { PipelineJobStatus } from '../entities/pipeline.enums';

// ============ Pipeline Mapper ============

export class PipelineMapper {
  /**
   * Map PipelineJob entity to response DTO
   */
  static toJobResponseDto(job: PipelineJob): PipelineJobResponseDto {
    return {
      id: job.id,
      tenantId: job.tenantId,
      campaignId: job.campaignId,
      campaignRunId: job.campaignRunId,
      contactId: job.contactId,
      templateVersionId: job.templateVersionId,
      channel: job.channel,
      payload: job.payload,
      status: job.status,
      retryCount: job.retryCount,
      nextAttemptAt: job.nextAttemptAt,
      errorMessage: job.errorMessage,
      providerMessageId: job.providerMessageId,
      sentAt: job.sentAt,
      deliveredAt: job.deliveredAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Map PipelineFailure entity to response DTO
   */
  static toFailureResponseDto(failure: PipelineFailure): PipelineFailureResponseDto {
    return {
      id: failure.id,
      tenantId: failure.tenantId,
      jobId: failure.jobId,
      campaignId: failure.campaignId,
      contactId: failure.contactId,
      errorMessage: failure.errorMessage,
      lastStatus: failure.lastStatus,
      retryCount: failure.retryCount,
      createdAt: failure.createdAt,
    };
  }

  /**
   * Map paginated jobs to response DTO
   */
  static toPaginatedJobsResponseDto(
    jobs: PipelineJob[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedPipelineJobsResponseDto {
    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return {
      data: jobs.map(job => this.toJobResponseDto(job)),
      meta,
    };
  }

  /**
   * Map paginated failures to response DTO
   */
  static toPaginatedFailuresResponseDto(
    failures: PipelineFailure[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedPipelineFailuresResponseDto {
    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return {
      data: failures.map(failure => this.toFailureResponseDto(failure)),
      meta,
    };
  }

  /**
   * Create job stats DTO from counts
   */
  static toJobStatsDto(counts: Record<string, number>): PipelineJobStatsDto {
    return {
      total: counts.total || 0,
      pending: counts[PipelineJobStatus.PENDING] || 0,
      processing: counts[PipelineJobStatus.PROCESSING] || 0,
      sent: counts[PipelineJobStatus.SENT] || 0,
      delivered: counts[PipelineJobStatus.DELIVERED] || 0,
      failed: counts[PipelineJobStatus.FAILED] || 0,
      retrying: counts[PipelineJobStatus.RETRYING] || 0,
      dead: counts[PipelineJobStatus.DEAD] || 0,
    };
  }
}
