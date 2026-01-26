import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';
import { PipelineStatusService } from '../services/pipeline-status.service';
import { PipelineRetryService } from '../services/pipeline-retry.service';
import {
  PipelineJobSearchDto,
  PipelineFailureSearchDto,
  PaginatedPipelineJobsResponseDto,
  PaginatedPipelineFailuresResponseDto,
  PipelineJobResponseDto,
  RetryJobResponseDto,
  PipelineJobStatsDto,
} from '../dto';
import { PipelineJobStatus } from '../entities';

// ============ Pipeline Controller ============

@ApiTags('pipeline')
@Controller('pipeline')
export class PipelineController {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly pipelineStatusService: PipelineStatusService,
    private readonly pipelineRetryService: PipelineRetryService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('PipelineController');
    this.logger.info('PipelineController initialized');
  }

  // ============ Job Endpoints ============

  @Get('jobs')
  @ApiOperation({ summary: 'List pipeline jobs' })
  @ApiResponse({
    status: 200,
    description: 'Jobs retrieved successfully',
    type: PaginatedPipelineJobsResponseDto,
  })
  async listJobs(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query() searchDto: PipelineJobSearchDto,
  ): Promise<{ success: boolean; data: PaginatedPipelineJobsResponseDto['data']; meta: PaginatedPipelineJobsResponseDto['meta'] }> {
    const result = await this.pipelineStatusService.listJobs(tenantId, searchDto, correlationId);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a pipeline job by ID' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job retrieved successfully',
    type: PipelineJobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(
    @TenantId() tenantId: string,
    @Param('id') jobId: string,
  ): Promise<{ success: boolean; data: PipelineJobResponseDto }> {
    const job = await this.pipelineStatusService.getJob(tenantId, jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID "${jobId}" not found`);
    }

    return {
      success: true,
      data: job,
    };
  }

  @Get('jobs/campaign/:campaignId/stats')
  @ApiOperation({ summary: 'Get job statistics for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Stats retrieved successfully',
    type: PipelineJobStatsDto,
  })
  async getJobStats(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('campaignId') campaignId: string,
  ): Promise<{ success: boolean; data: PipelineJobStatsDto }> {
    const stats = await this.pipelineStatusService.getJobStats(tenantId, campaignId, correlationId);
    return {
      success: true,
      data: stats,
    };
  }

  // ============ Failure Endpoints ============

  @Get('failures')
  @ApiOperation({ summary: 'List pipeline failures' })
  @ApiResponse({
    status: 200,
    description: 'Failures retrieved successfully',
    type: PaginatedPipelineFailuresResponseDto,
  })
  async listFailures(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query() searchDto: PipelineFailureSearchDto,
  ): Promise<{ success: boolean; data: PaginatedPipelineFailuresResponseDto['data']; meta: PaginatedPipelineFailuresResponseDto['meta'] }> {
    const result = await this.pipelineStatusService.listFailures(tenantId, searchDto, correlationId);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  // ============ Dead Jobs Endpoints ============

  @Get('dead')
  @ApiOperation({ summary: 'List dead jobs (failed after max retries)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Dead jobs retrieved successfully',
    type: PaginatedPipelineJobsResponseDto,
  })
  async listDeadJobs(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: PaginatedPipelineJobsResponseDto['data']; meta: PaginatedPipelineJobsResponseDto['meta'] }> {
    const result = await this.pipelineStatusService.listDeadJobs(
      tenantId,
      page || 1,
      limit || 20,
      correlationId,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  // ============ Retry Endpoints ============

  @Post('retry/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually retry a failed or dead job' })
  @ApiParam({ name: 'id', description: 'Job ID to retry' })
  @ApiResponse({
    status: 200,
    description: 'Job scheduled for retry',
    type: RetryJobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  async retryJob(
    @TenantId() tenantId: string,
    @Param('id') jobId: string,
  ): Promise<{ success: boolean; data: RetryJobResponseDto }> {
    const job = await this.pipelineRetryService.retryJob(tenantId, jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID "${jobId}" not found`);
    }

    if (job.status !== PipelineJobStatus.PENDING) {
      return {
        success: false,
        data: {
          success: false,
          jobId: job.id,
          newStatus: job.status,
          message: `Job cannot be retried. Current status: ${job.status}`,
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        jobId: job.id,
        newStatus: job.status,
        message: 'Job scheduled for retry',
      },
    };
  }

  // ============ Health Endpoint ============

  @Get('health')
  @ApiOperation({ summary: 'Get pipeline health metrics' })
  @ApiResponse({
    status: 200,
    description: 'Health metrics retrieved successfully',
  })
  async getPipelineHealth(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<{
    success: boolean;
    data: {
      pendingJobs: number;
      processingJobs: number;
      failedJobs: number;
      deadJobs: number;
      isHealthy: boolean;
    };
  }> {
    const health = await this.pipelineStatusService.getPipelineHealth(tenantId, correlationId);
    return {
      success: true,
      data: health,
    };
  }
}
