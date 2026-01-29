import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, IsString, IsArray, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DevService } from './dev.service';
import { DevOnlyGuard } from './guards/dev-only.guard';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CorrelationId } from '../common/decorators/correlation-id.decorator';

console.log('=== DEV CONTROLLER FILE LOADED ===');

// ==================== DTOs ====================

class GraduationYearRangeDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;
}

class GenerateContactsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  count?: number;

  @IsOptional()
  @IsBoolean()
  withPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  withWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  withAcademic?: boolean;

  @IsOptional()
  @IsBoolean()
  withProfessional?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => GraduationYearRangeDto)
  graduationYearRange?: GraduationYearRangeDto;
}

class GenerateSegmentsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: ('static' | 'dynamic')[];

  @IsOptional()
  @IsBoolean()
  includeComplexRules?: boolean;
}

class GenerateCampaignsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  count?: number;

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: ('email' | 'sms' | 'whatsapp' | 'push')[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: ('draft' | 'scheduled')[];
}

class RunScenarioDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  contactCount?: number;
}

class RunInboxScenarioDto extends RunScenarioDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  messagesPerThread?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: ('email' | 'sms' | 'whatsapp')[];
}

class RunWorkflowScenarioDto extends RunScenarioDto {
  @IsOptional()
  @IsString()
  triggerType?: 'contact_created' | 'tag_added' | 'segment_joined';
}

// ==================== CONTROLLER ====================

@Controller('dev')
@ApiTags('Dev Playground')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@UseGuards(DevOnlyGuard)
export class DevController {
  private readonly logger = new Logger(DevController.name);

  constructor(private readonly devService: DevService) {
    console.log('=== DEV CONTROLLER CONSTRUCTOR CALLED ===');
    this.logger.log('DevController instantiated');
  }

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dev playground dashboard',
    description: 'Returns counts and status for the dev playground',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(
    @TenantId() tenantId: string,
  ) {
    const data = await this.devService.getDashboard(tenantId);
    return { success: true, data };
  }

  // ==================== GENERATORS ====================

  @Post('contacts/generate')
  @ApiOperation({
    summary: 'Generate contacts',
    description: 'Generate and create realistic contact data',
  })
  @ApiBody({ type: GenerateContactsDto })
  @ApiResponse({ status: 201, description: 'Contacts generated' })
  async generateContacts(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: GenerateContactsDto,
  ) {
    const result = await this.devService.generateContacts(
      tenantId,
      dto,
      correlationId,
    );
    return { success: result.success, data: result };
  }

  @Post('segments/generate')
  @ApiOperation({
    summary: 'Generate segments',
    description: 'Generate and create segments with rules',
  })
  @ApiBody({ type: GenerateSegmentsDto })
  @ApiResponse({ status: 201, description: 'Segments generated' })
  async generateSegments(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: GenerateSegmentsDto,
  ) {
    const result = await this.devService.generateSegments(
      tenantId,
      dto,
      correlationId,
    );
    return { success: result.success, data: result };
  }

  @Post('campaigns/generate')
  @ApiOperation({
    summary: 'Generate campaigns',
    description: 'Generate and create campaigns',
  })
  @ApiBody({ type: GenerateCampaignsDto })
  @ApiResponse({ status: 201, description: 'Campaigns generated' })
  async generateCampaigns(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: GenerateCampaignsDto,
  ) {
    const result = await this.devService.generateCampaigns(
      tenantId,
      dto,
      correlationId,
    );
    return { success: result.success, data: result };
  }

  // ==================== SCENARIOS ====================

  @Post('scenarios/campaign-basic')
  @ApiOperation({
    summary: 'Run campaign-basic scenario',
    description: 'Creates contacts, segment, and campaign in one flow',
  })
  @ApiBody({ type: RunScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed' })
  async runCampaignBasicScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunScenarioDto,
  ) {
    const result = await this.devService.runCampaignBasicScenario(tenantId, {
      contactCount: dto.contactCount,
      correlationId,
    });
    return { success: result.success, data: result };
  }

  @Post('scenarios/inbox-flow')
  @ApiOperation({
    summary: 'Run inbox-flow scenario',
    description: 'Creates contacts with inbox threads and messages',
  })
  @ApiBody({ type: RunInboxScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed' })
  async runInboxFlowScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunInboxScenarioDto,
  ) {
    const result = await this.devService.runInboxFlowScenario(tenantId, {
      contactCount: dto.contactCount,
      messagesPerThread: dto.messagesPerThread,
      channels: dto.channels,
      correlationId,
    });
    return { success: result.success, data: result };
  }

  @Post('scenarios/workflow-trigger')
  @ApiOperation({
    summary: 'Run workflow-trigger scenario',
    description: 'Creates workflow and contacts to trigger it',
  })
  @ApiBody({ type: RunWorkflowScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed' })
  async runWorkflowTriggerScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunWorkflowScenarioDto,
  ) {
    const result = await this.devService.runWorkflowTriggerScenario(tenantId, {
      contactCount: dto.contactCount,
      triggerType: dto.triggerType,
      correlationId,
    });
    return { success: result.success, data: result };
  }

  // ==================== RESET ====================

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset all data',
    description: 'WARNING: Deletes all data for the tenant. Only for development!',
  })
  @ApiResponse({ status: 200, description: 'Data reset complete' })
  async resetAll(@TenantId() tenantId: string) {
    const result = await this.devService.resetAll(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/contacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset contacts',
    description: 'Deletes all contacts for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Contacts reset complete' })
  async resetContacts(@TenantId() tenantId: string) {
    const result = await this.devService.resetContacts(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/segments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset segments',
    description: 'Deletes all segments for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Segments reset complete' })
  async resetSegments(@TenantId() tenantId: string) {
    const result = await this.devService.resetSegments(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/campaigns')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset campaigns',
    description: 'Deletes all campaigns for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Campaigns reset complete' })
  async resetCampaigns(@TenantId() tenantId: string) {
    const result = await this.devService.resetCampaigns(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/inbox')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset inbox',
    description: 'Deletes all inbox threads and messages for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Inbox reset complete' })
  async resetInbox(@TenantId() tenantId: string) {
    const result = await this.devService.resetInbox(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/workflows')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset workflows',
    description: 'Deletes all workflows for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Workflows reset complete' })
  async resetWorkflows(@TenantId() tenantId: string) {
    const result = await this.devService.resetWorkflows(tenantId);
    return { success: result.success, data: result };
  }

  @Post('reset/sequences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset sequences',
    description: 'Deletes all sequences for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Sequences reset complete' })
  async resetSequences(@TenantId() tenantId: string) {
    const result = await this.devService.resetSequences(tenantId);
    return { success: result.success, data: result };
  }

  // ==================== EXPLORER (List & Browse) ====================

  @Get('explorer/contacts')
  @ApiOperation({
    summary: 'List all contacts',
    description: 'Get a list of all contacts for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  async listContacts(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listContacts(tenantId, limit || 50);
    return { success: true, data };
  }

  @Get('explorer/segments')
  @ApiOperation({
    summary: 'List all segments',
    description: 'Get a list of all segments for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of segments' })
  async listSegments(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listSegments(tenantId, limit || 50);
    return { success: true, data };
  }

  @Get('explorer/campaigns')
  @ApiOperation({
    summary: 'List all campaigns',
    description: 'Get a list of all campaigns for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of campaigns' })
  async listCampaigns(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listCampaigns(tenantId, limit || 50);
    return { success: true, data };
  }
}

