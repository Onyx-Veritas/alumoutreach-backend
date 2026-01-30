import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, IsString, IsArray, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DevService } from './dev.service';
import { DemoSeedService, DemoPreset, SeedResult } from './services/demo-seed.service';
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

class GenerateTemplatesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  count?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: ('email' | 'sms' | 'whatsapp' | 'push')[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: ('transactional' | 'marketing' | 'lifecycle' | 'compliance' | 'notification' | 'reminder')[];
}

class GenerateSequencesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  count?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: ('drip' | 'onboarding' | 'behavioral')[];

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(15)
  minSteps?: number;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(20)
  maxSteps?: number;
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

class ExecuteCampaignDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

class RunCampaignExecutionScenarioDto extends RunScenarioDto {
  @IsOptional()
  @IsString()
  channel?: 'email' | 'sms' | 'whatsapp' | 'push';
  
  @IsOptional()
  @IsBoolean()
  executeImmediately?: boolean;
}

class RunSequenceEnrollmentScenarioDto extends RunScenarioDto {
  @IsOptional()
  @IsString()
  sequenceType?: 'drip' | 'onboarding' | 'behavioral';
  
  @IsOptional()
  @IsBoolean()
  enrollAll?: boolean;
}

class RunPartialFailureScenarioDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  validCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  invalidEmailCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  missingEmailCount?: number;

  @IsOptional()
  @IsBoolean()
  waitForCompletion?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5000)
  @Max(120000)
  waitTimeoutMs?: number;
}
// ==================== CONTROLLER ====================

@Controller('dev')
@ApiTags('Dev Playground')
@ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant ID' })
@UseGuards(DevOnlyGuard)
export class DevController {
  private readonly logger = new Logger(DevController.name);

  constructor(
    private readonly devService: DevService,
    private readonly demoSeedService: DemoSeedService,
  ) {
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

  @Post('templates/generate')
  @ApiOperation({
    summary: 'Generate templates',
    description: 'Generate and create message templates',
  })
  @ApiBody({ type: GenerateTemplatesDto })
  @ApiResponse({ status: 201, description: 'Templates generated' })
  async generateTemplates(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: GenerateTemplatesDto,
  ) {
    const result = await this.devService.generateTemplates(
      tenantId,
      dto,
      correlationId,
    );
    return { success: result.success, data: result };
  }

  @Post('sequences/generate')
  @ApiOperation({
    summary: 'Generate sequences',
    description: 'Generate and create sequences with steps',
  })
  @ApiBody({ type: GenerateSequencesDto })
  @ApiResponse({ status: 201, description: 'Sequences generated' })
  async generateSequences(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: GenerateSequencesDto,
  ) {
    const result = await this.devService.generateSequences(
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

  @Post('scenarios/campaign-execution')
  @ApiOperation({
    summary: 'Run campaign-execution scenario (BullMQ)',
    description: 'Creates contacts, segment, campaign and executes it via BullMQ pipeline',
  })
  @ApiBody({ type: RunCampaignExecutionScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed' })
  async runCampaignExecutionScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunCampaignExecutionScenarioDto,
  ) {
    const result = await this.devService.runCampaignExecutionScenario(tenantId, {
      contactCount: dto.contactCount,
      channel: dto.channel,
      executeImmediately: dto.executeImmediately ?? true,
      correlationId,
    });
    return { success: result.success, data: result };
  }

  @Post('scenarios/sequence-enrollment')
  @ApiOperation({
    summary: 'Run sequence-enrollment scenario',
    description: 'Creates contacts, sequence, and enrolls contacts into it',
  })
  @ApiBody({ type: RunSequenceEnrollmentScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed' })
  async runSequenceEnrollmentScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunSequenceEnrollmentScenarioDto,
  ) {
    const result = await this.devService.runSequenceEnrollmentScenario(tenantId, {
      contactCount: dto.contactCount,
      sequenceType: dto.sequenceType,
      enrollAll: dto.enrollAll ?? true,
      correlationId,
    });
    return { success: result.success, data: result };
  }

  @Post('scenarios/partial-failure')
  @ApiOperation({
    summary: 'Run partial-failure scenario',
    description: 'Creates campaign with mix of valid/invalid/missing emails to test failure handling',
  })
  @ApiBody({ type: RunPartialFailureScenarioDto })
  @ApiResponse({ status: 200, description: 'Scenario completed with stats' })
  async runPartialFailureScenario(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: RunPartialFailureScenarioDto,
  ) {
    const result = await this.devService.runPartialFailureScenario(tenantId, {
      validCount: dto.validCount ?? 3,
      invalidEmailCount: dto.invalidEmailCount ?? 2,
      missingEmailCount: dto.missingEmailCount ?? 1,
      waitForCompletion: dto.waitForCompletion ?? true,
      waitTimeoutMs: dto.waitTimeoutMs ?? 30000,
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

  @Post('reset/templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset templates',
    description: 'Deletes all templates for the tenant',
  })
  @ApiResponse({ status: 200, description: 'Templates reset complete' })
  async resetTemplates(@TenantId() tenantId: string) {
    const result = await this.devService.resetTemplates(tenantId);
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

  @Get('explorer/templates')
  @ApiOperation({
    summary: 'List all templates',
    description: 'Get a list of all templates for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async listTemplates(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listTemplates(tenantId, limit || 50);
    return { success: true, data };
  }

  @Get('explorer/workflows')
  @ApiOperation({
    summary: 'List all workflows',
    description: 'Get a list of all workflows for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of workflows' })
  async listWorkflows(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listWorkflows(tenantId, limit || 50);
    return { success: true, data };
  }

  @Get('explorer/sequences')
  @ApiOperation({
    summary: 'List all sequences',
    description: 'Get a list of all sequences for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of sequences' })
  async listSequences(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listSequences(tenantId, limit || 50);
    return { success: true, data };
  }

  @Get('explorer/inbox-threads')
  @ApiOperation({
    summary: 'List all inbox threads',
    description: 'Get a list of all inbox threads for the tenant (for explorer)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiResponse({ status: 200, description: 'List of inbox threads' })
  async listInboxThreads(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.listInboxThreads(tenantId, limit || 50);
    return { success: true, data };
  }

  // ==================== LOGS ====================

  @Get('logs')
  @ApiOperation({
    summary: 'Get dev playground logs',
    description: 'Returns recent activity logs from the dev playground',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max logs to return' })
  @ApiQuery({ name: 'level', required: false, enum: ['debug', 'info', 'warn', 'error'], description: 'Filter by log level' })
  @ApiQuery({ name: 'module', required: false, type: String, description: 'Filter by module name' })
  @ApiQuery({ name: 'since', required: false, type: String, description: 'ISO timestamp to get logs after' })
  @ApiResponse({ status: 200, description: 'Logs list' })
  async getLogs(
    @Query('limit') limit?: number,
    @Query('level') level?: string,
    @Query('module') module?: string,
    @Query('since') since?: string,
  ) {
    const data = await this.devService.getLogs({
      limit: limit ? parseInt(String(limit), 10) : undefined,
      level: level as any,
      module,
      since,
    });
    return { success: true, data };
  }

  @Get('logs/poll')
  @ApiOperation({
    summary: 'Poll for new logs',
    description: 'Get logs newer than a specific log ID (for polling)',
  })
  @ApiQuery({ name: 'afterId', required: true, type: String, description: 'Get logs after this log ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'New logs' })
  async pollLogs(
    @Query('afterId') afterId: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.devService.getNewLogs(afterId, limit ? parseInt(String(limit), 10) : undefined);
    return { success: true, data };
  }

  @Get('logs/stats')
  @ApiOperation({
    summary: 'Get log stats',
    description: 'Returns stats about stored logs',
  })
  @ApiResponse({ status: 200, description: 'Log stats' })
  async getLogStats() {
    const data = await this.devService.getLogStats();
    return { success: true, data };
  }

  @Post('logs/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear all logs',
    description: 'Clears all stored dev playground logs',
  })
  @ApiResponse({ status: 200, description: 'Logs cleared' })
  async clearLogs() {
    await this.devService.clearLogs();
    return { success: true, message: 'Logs cleared' };
  }

  // ==================== DEMO SEEDING ====================

  @Get('seed/presets')
  @ApiOperation({
    summary: 'Get available demo presets',
    description: 'Returns list of predefined demo data configurations',
  })
  @ApiResponse({ status: 200, description: 'List of presets' })
  async getPresets(): Promise<{ success: boolean; data: DemoPreset[] }> {
    const presets = this.demoSeedService.getPresets();
    return { success: true, data: presets };
  }

  @Get('seed/presets/:presetId')
  @ApiOperation({
    summary: 'Get a specific preset',
    description: 'Returns details of a specific preset',
  })
  @ApiParam({ name: 'presetId', description: 'Preset ID' })
  @ApiResponse({ status: 200, description: 'Preset details' })
  async getPreset(
    @Param('presetId') presetId: string,
  ): Promise<{ success: boolean; data: DemoPreset | null }> {
    const preset = this.demoSeedService.getPreset(presetId);
    return { success: true, data: preset || null };
  }

  @Post('seed/:presetId')
  @ApiOperation({
    summary: 'Seed data with preset',
    description: 'Populate the system with demo data using a preset configuration',
  })
  @ApiParam({ name: 'presetId', description: 'Preset ID (minimal, small-team, full-demo, campaign-focus, automation-focus)' })
  @ApiQuery({ name: 'resetFirst', required: false, type: Boolean, description: 'Reset all data before seeding' })
  @ApiResponse({ status: 200, description: 'Seed result' })
  async seedWithPreset(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('presetId') presetId: string,
    @Query('resetFirst') resetFirst?: string,
  ): Promise<{ success: boolean; data: SeedResult }> {
    const result = await this.demoSeedService.seedWithPreset(
      tenantId,
      presetId,
      correlationId,
      resetFirst === 'true',
    );
    return { success: result.success, data: result };
  }
}

