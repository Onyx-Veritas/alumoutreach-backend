import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsArray, Min, Max } from 'class-validator';
import { DevOnlyGuard } from '../guards/dev-only.guard';
import { QueueMonitorService, QueueDashboard, JobSummary } from '../services/queue-monitor.service';
import { Public } from '../../modules/auth/decorators/public.decorator';

// ==================== DTOs ====================

class GetJobsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

class GetCampaignJobsQueryDto extends GetJobsQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];
}

// ==================== CONTROLLER ====================

@Controller('dev/queues')
@ApiTags('Dev Playground - Queue Monitor')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@Public()
@UseGuards(DevOnlyGuard)
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueMonitorService: QueueMonitorService) {
    this.logger.log('QueueController instantiated');
  }

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get queue dashboard',
    description: 'Returns overview of all queues with stats and recent jobs',
  })
  @ApiQuery({ name: 'recentLimit', required: false, type: Number, description: 'Number of recent jobs to return' })
  @ApiResponse({ status: 200, description: 'Queue dashboard data' })
  async getDashboard(
    @Query('recentLimit') recentLimit?: number,
  ): Promise<{ success: boolean; data: QueueDashboard }> {
    const dashboard = await this.queueMonitorService.getQueuesDashboard(recentLimit || 20);
    return { success: true, data: dashboard };
  }

  // ==================== JOBS ====================

  @Get('jobs/recent')
  @ApiOperation({
    summary: 'Get recent jobs',
    description: 'Returns recent completed and active jobs',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Recent jobs list' })
  async getRecentJobs(
    @Query() query: GetJobsQueryDto,
  ): Promise<{ success: boolean; data: { jobs: JobSummary[]; count: number } }> {
    const jobs = await this.queueMonitorService.getRecentJobs(
      (this.queueMonitorService as any).pipelineQueue,
      query.limit || 20,
    );
    return {
      success: true,
      data: { jobs, count: jobs.length },
    };
  }

  @Get('jobs/failed')
  @ApiOperation({
    summary: 'Get failed jobs',
    description: 'Returns recent failed jobs',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Failed jobs list' })
  async getFailedJobs(
    @Query() query: GetJobsQueryDto,
  ): Promise<{ success: boolean; data: { jobs: JobSummary[]; count: number } }> {
    const jobs = await this.queueMonitorService.getFailedJobs(
      (this.queueMonitorService as any).pipelineQueue,
      query.limit || 20,
    );
    return {
      success: true,
      data: { jobs, count: jobs.length },
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get job by ID',
    description: 'Returns details of a specific job',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job details' })
  async getJob(
    @Param('jobId') jobId: string,
  ): Promise<{ success: boolean; data: JobSummary | null }> {
    const job = await this.queueMonitorService.getJob(jobId);
    return { success: true, data: job };
  }

  @Get('campaigns/:campaignId/jobs')
  @ApiOperation({
    summary: 'Get jobs by campaign',
    description: 'Returns all jobs for a specific campaign',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Campaign jobs list' })
  async getCampaignJobs(
    @Param('campaignId') campaignId: string,
    @Query() query: GetCampaignJobsQueryDto,
  ): Promise<{ success: boolean; data: { jobs: JobSummary[]; count: number } }> {
    const states = query.states || ['completed', 'failed', 'active', 'waiting'];
    const jobs = await this.queueMonitorService.getJobsByCampaign(
      campaignId,
      states as any,
      query.limit || 100,
    );
    return {
      success: true,
      data: { jobs, count: jobs.length },
    };
  }

  // ==================== ACTIONS ====================

  @Post('jobs/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retries a failed job',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retry result' })
  async retryJob(
    @Param('jobId') jobId: string,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.queueMonitorService.retryJob(jobId);
    return {
      success: result,
      message: result ? 'Job queued for retry' : 'Failed to retry job (not found or not in failed state)',
    };
  }

  @Post('clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clean completed and failed jobs',
    description: 'Removes old completed and failed jobs from the queue',
  })
  @ApiQuery({ name: 'grace', required: false, type: Number, description: 'Grace period in ms' })
  @ApiResponse({ status: 200, description: 'Clean result' })
  async cleanJobs(
    @Query('grace') grace?: number,
  ): Promise<{ success: boolean; data: { completed: number; failed: number } }> {
    const result = await this.queueMonitorService.cleanJobs(grace || 0);
    return { success: true, data: result };
  }
}
