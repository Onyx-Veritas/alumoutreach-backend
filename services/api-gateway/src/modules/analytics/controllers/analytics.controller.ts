import {
  Controller,
  Get,
  Query,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsQueryService } from '../services/analytics-query.service';
import { AnalyticsValidators } from '../validators/analytics.validators';
import {
  AnalyticsQueryDto,
  MessagesAnalyticsQueryDto,
  CampaignAnalyticsQueryDto,
  WorkflowAnalyticsQueryDto,
  SequenceAnalyticsQueryDto,
  TemplateAnalyticsQueryDto,
  TrafficAnalyticsQueryDto,
  AnalyticsApiResponse,
  OverviewStatsResponse,
  MessagesAnalyticsResponse,
  CampaignAnalyticsResponse,
  WorkflowAnalyticsResponse,
  SequenceAnalyticsResponse,
  TemplateAnalyticsResponse,
  TrafficAnalyticsResponse,
} from '../dto/analytics.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly analyticsService: AnalyticsService,
    private readonly queryService: AnalyticsQueryService,
    private readonly validators: AnalyticsValidators,
  ) {
    this.logger.setContext('AnalyticsController');
    this.logger.log('AnalyticsController initialized');
  }

  /**
   * Wrap response with standard format
   */
  private wrapResponse<T>(
    data: T,
    query: AnalyticsQueryDto,
  ): AnalyticsApiResponse<T> {
    const timeRange = this.validators.parseTimeRange(query);
    return {
      success: true,
      data,
      meta: {
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        timezone: timeRange.timezone,
        granularity: timeRange.granularity,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get overview analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Overview stats returned' })
  async getOverview(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<OverviewStatsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/overview', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.analyticsService.getOverviewStats(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/overview', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get messages analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiQuery({ name: 'direction', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Messages analytics returned' })
  async getMessages(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: MessagesAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<MessagesAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/messages', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getMessagesAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/messages', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Get campaign analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campaign analytics returned' })
  async getCampaigns(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: CampaignAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<CampaignAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/campaigns', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getCampaignAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/campaigns', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get workflow analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Workflow analytics returned' })
  async getWorkflows(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: WorkflowAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<WorkflowAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/workflows', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getWorkflowAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/workflows', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('sequences')
  @ApiOperation({ summary: 'Get sequence analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'sequenceId', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sequence analytics returned' })
  async getSequences(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: SequenceAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<SequenceAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/sequences', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getSequenceAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/sequences', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get template analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'templateId', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Template analytics returned' })
  async getTemplates(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: TemplateAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<TemplateAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/templates', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getTemplateAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/templates', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }

  @Get('traffic')
  @ApiOperation({ summary: 'Get traffic analytics' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'timezone', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Traffic analytics returned' })
  async getTraffic(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Query() query: TrafficAnalyticsQueryDto,
  ): Promise<AnalyticsApiResponse<TrafficAnalyticsResponse>> {
    const startTime = Date.now();
    this.logger.log('[START] GET /analytics/traffic', {
      tenantId,
      userId,
      correlationId,
    });

    const validation = this.validators.validateQuery(query);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const data = await this.queryService.getTrafficAnalytics(
      tenantId,
      query,
      correlationId,
    );

    this.logger.log('[END] GET /analytics/traffic', {
      tenantId,
      correlationId,
      duration: Date.now() - startTime,
    });

    return this.wrapResponse(data, query);
  }
}
