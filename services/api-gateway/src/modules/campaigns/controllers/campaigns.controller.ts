import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { CampaignsService } from '../services/campaigns.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SYSTEM_USER_ID } from '../../../common/constants/system';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ScheduleCampaignDto,
  CampaignPreviewDto,
  CampaignSearchDto,
  CampaignMessageSearchDto,
  CampaignResponseDto,
  CampaignPreviewResponseDto,
  PaginatedCampaignsResponseDto,
  PaginatedMessagesResponseDto,
} from '../dto/campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
@ApiHeader({ name: 'X-Correlation-ID', required: false, description: 'Request correlation ID for tracing' })
@Controller('campaigns')
export class CampaignsController {
  private readonly logger: AppLoggerService;

  constructor(private readonly campaignsService: CampaignsService) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignsController');
    this.logger.info('CampaignsController initialized');
  }

  // ============ CREATE ============

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Create a new campaign', description: 'Creates a new campaign with the provided data' })
  @ApiBody({ type: CreateCampaignDto })
  @ApiResponse({ status: 201, description: 'Campaign created successfully', type: CampaignResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Campaign with name already exists' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: CreateCampaignDto,
  ): Promise<{ success: boolean; data: CampaignResponseDto }> {
    this.logger.debug('Create campaign request received', { tenantId, correlationId });
    const campaign = await this.campaignsService.create(tenantId, dto, userId || SYSTEM_USER_ID, correlationId);
    return { success: true, data: campaign };
  }

  // ============ LIST ============

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get all campaigns', description: 'Retrieves campaigns with pagination, filtering, and sorting' })
  @ApiResponse({ status: 200, description: 'Campaigns retrieved successfully', type: PaginatedCampaignsResponseDto })
  async findAll(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query() query: CampaignSearchDto,
  ): Promise<{ success: boolean; data: CampaignResponseDto[]; meta: any }> {
    this.logger.debug('Find all campaigns request', { tenantId, correlationId, page: query.page });
    const result = await this.campaignsService.findAll(tenantId, query, correlationId);
    return { success: true, data: result.data, meta: result.meta };
  }

  // ============ GET BY ID ============

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID', description: 'Retrieves a single campaign by its ID' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved successfully', type: CampaignResponseDto })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findById(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; data: CampaignResponseDto }> {
    this.logger.debug('Find campaign by id request', { tenantId, id, correlationId });
    const campaign = await this.campaignsService.findById(tenantId, id, correlationId);
    return { success: true, data: campaign };
  }

  // ============ UPDATE ============

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update a campaign', description: 'Updates an existing campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiBody({ type: UpdateCampaignDto })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully', type: CampaignResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot update campaign in current status' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({ status: 409, description: 'Campaign with name already exists' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<{ success: boolean; data: CampaignResponseDto }> {
    this.logger.debug('Update campaign request', { tenantId, id, correlationId });
    const campaign = await this.campaignsService.update(tenantId, id, dto, userId || SYSTEM_USER_ID, correlationId);
    return { success: true, data: campaign };
  }

  // ============ DELETE ============

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign', description: 'Soft deletes a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Campaign deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete running campaign' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.debug('Delete campaign request', { tenantId, id, correlationId });
    await this.campaignsService.delete(tenantId, id, userId || SYSTEM_USER_ID, correlationId);
  }

  // ============ PREVIEW ============

  @Post(':id/preview')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Preview campaign audience', description: 'Preview the campaign audience and template' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiBody({ type: CampaignPreviewDto })
  @ApiResponse({ status: 200, description: 'Campaign preview generated', type: CampaignPreviewResponseDto })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async preview(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CampaignPreviewDto,
  ): Promise<{ success: boolean; data: CampaignPreviewResponseDto }> {
    this.logger.debug('Preview campaign request', { tenantId, id, correlationId });
    const preview = await this.campaignsService.preview(tenantId, id, dto, correlationId);
    return { success: true, data: preview };
  }

  // ============ SCHEDULE ============

  @Post(':id/schedule')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Schedule a campaign', description: 'Schedule a campaign for future delivery' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiBody({ type: ScheduleCampaignDto })
  @ApiResponse({ status: 200, description: 'Campaign scheduled successfully', type: CampaignResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid schedule time or missing required fields' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async schedule(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCampaignDto,
  ): Promise<{ success: boolean; data: CampaignResponseDto }> {
    this.logger.debug('Schedule campaign request', { tenantId, id, scheduleAt: dto.scheduleAt, correlationId });
    const campaign = await this.campaignsService.schedule(tenantId, id, dto, userId || SYSTEM_USER_ID, correlationId);
    return { success: true, data: campaign };
  }

  // ============ CANCEL ============

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a campaign', description: 'Cancel a scheduled or running campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Campaign cancelled successfully', type: CampaignResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot cancel campaign in current status' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; data: CampaignResponseDto }> {
    this.logger.debug('Cancel campaign request', { tenantId, id, correlationId });
    const campaign = await this.campaignsService.cancel(tenantId, id, userId || SYSTEM_USER_ID, correlationId);
    return { success: true, data: campaign };
  }

  // ============ MESSAGES ============

  @Get(':id/messages')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get campaign messages', description: 'Retrieves all messages for a campaign with pagination' })
  @ApiParam({ name: 'id', description: 'Campaign ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Campaign messages retrieved', type: PaginatedMessagesResponseDto })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getMessages(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CampaignMessageSearchDto,
  ): Promise<{ success: boolean; data: any[]; meta: any }> {
    this.logger.debug('Get campaign messages request', { tenantId, id, correlationId });
    const result = await this.campaignsService.getMessages(tenantId, id, query, correlationId);
    return { success: true, data: result.data, meta: result.meta };
  }
}
