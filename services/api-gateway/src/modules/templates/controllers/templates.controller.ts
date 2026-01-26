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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TemplatesService } from '../services/templates.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateVersionDto,
  PreviewTemplateDto,
  ApproveTemplateDto,
  RejectTemplateDto,
  TemplateSearchDto,
  TemplateResponseDto,
  TemplateVersionResponseDto,
  TemplatePreviewResponseDto,
  TemplateStatsResponseDto,
} from '../dto/template.dto';
import { TemplateChannel } from '../entities/template.entity';
import { TemplateContent } from '../entities/template-version.entity';
import { ValidationResult } from '../validators/template-validators';

@ApiTags('Templates')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
@Controller('templates')
export class TemplatesController {
  private readonly logger: AppLoggerService;

  constructor(private readonly templatesService: TemplatesService) {
    this.logger = new AppLoggerService();
    this.logger.setContext('TemplatesController');
  }

  // ============ Template CRUD ============

  @Post()
  @ApiOperation({ summary: 'Create a new template' })
  @ApiResponse({ status: 201, description: 'Template created successfully', type: TemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Template name already exists' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('POST /templates', { tenantId, channel: dto.channel });

    try {
      const result = await this.templatesService.create(tenantId, userId, dto);
      this.logger.logOperationEnd('POST /templates', startTime, { templateId: result.id });
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates', error as Error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List templates with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: TemplateSearchDto,
  ) {
    const startTime = this.logger.logOperationStart('GET /templates', { tenantId });

    try {
      const result = await this.templatesService.findAll(tenantId, query);
      this.logger.logOperationEnd('GET /templates', startTime, { total: result.total });
      return result;
    } catch (error) {
      this.logger.logOperationError('GET /templates', error as Error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiQuery({ name: 'includeVersions', required: false, description: 'Include all versions' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeVersions') includeVersions?: string,
  ): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('GET /templates/:id', { tenantId, templateId: id });

    try {
      const include = includeVersions === 'true';
      const result = await this.templatesService.findById(tenantId, id, include);
      this.logger.logOperationEnd('GET /templates/:id', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('GET /templates/:id', error as Error);
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 409, description: 'Template name already exists' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('PATCH /templates/:id', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.update(tenantId, id, userId, dto);
      this.logger.logOperationEnd('PATCH /templates/:id', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('PATCH /templates/:id', error as Error);
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template (soft delete)' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('DELETE /templates/:id', { tenantId, templateId: id });

    try {
      await this.templatesService.delete(tenantId, id, userId);
      this.logger.logOperationEnd('DELETE /templates/:id', startTime);
    } catch (error) {
      this.logger.logOperationError('DELETE /templates/:id', error as Error);
      throw error;
    }
  }

  // ============ Version Management ============

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a new template version' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Version created successfully', type: TemplateVersionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async createVersion(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionDto,
  ): Promise<TemplateVersionResponseDto> {
    const startTime = this.logger.logOperationStart('POST /templates/:id/versions', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.createVersion(tenantId, id, userId, dto);
      this.logger.logOperationEnd('POST /templates/:id/versions', startTime, { versionId: result.id });
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates/:id/versions', error as Error);
      throw error;
    }
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions of a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Versions retrieved successfully', type: [TemplateVersionResponseDto] })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getVersions(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplateVersionResponseDto[]> {
    const startTime = this.logger.logOperationStart('GET /templates/:id/versions', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.getVersions(tenantId, id);
      this.logger.logOperationEnd('GET /templates/:id/versions', startTime, { count: result.length });
      return result;
    } catch (error) {
      this.logger.logOperationError('GET /templates/:id/versions', error as Error);
      throw error;
    }
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'Get a specific version of a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Version retrieved successfully', type: TemplateVersionResponseDto })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersionById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<TemplateVersionResponseDto> {
    const startTime = this.logger.logOperationStart('GET /templates/:id/versions/:versionId', {
      tenantId,
      templateId: id,
      versionId,
    });

    try {
      const result = await this.templatesService.getVersionById(tenantId, id, versionId);
      this.logger.logOperationEnd('GET /templates/:id/versions/:versionId', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('GET /templates/:id/versions/:versionId', error as Error);
      throw error;
    }
  }

  // ============ Preview & Render ============

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview a template with variables' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Preview generated successfully', type: TemplatePreviewResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async preview(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewTemplateDto,
  ): Promise<TemplatePreviewResponseDto> {
    const startTime = this.logger.logOperationStart('POST /templates/:id/preview', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.preview(tenantId, id, dto);
      this.logger.logOperationEnd('POST /templates/:id/preview', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates/:id/preview', error as Error);
      throw error;
    }
  }

  // ============ Approval Workflow ============

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template approved successfully', type: TemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot approve template' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTemplateDto,
  ): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('POST /templates/:id/approve', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.approve(tenantId, id, userId, dto);
      this.logger.logOperationEnd('POST /templates/:id/approve', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates/:id/approve', error as Error);
      throw error;
    }
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template rejected successfully', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async reject(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTemplateDto,
  ): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('POST /templates/:id/reject', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.reject(tenantId, id, userId, dto);
      this.logger.logOperationEnd('POST /templates/:id/reject', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates/:id/reject', error as Error);
      throw error;
    }
  }

  // ============ Statistics ============

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get template usage statistics' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: TemplateStatsResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getStats(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplateStatsResponseDto> {
    const startTime = this.logger.logOperationStart('GET /templates/:id/stats', { tenantId, templateId: id });

    try {
      const result = await this.templatesService.getStats(tenantId, id);
      this.logger.logOperationEnd('GET /templates/:id/stats', startTime);
      return result;
    } catch (error) {
      this.logger.logOperationError('GET /templates/:id/stats', error as Error);
      throw error;
    }
  }

  // ============ Validation ============

  @Post('validate')
  @ApiOperation({ summary: 'Validate template content without creating' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate(
    @Body() body: { channel: TemplateChannel; content: TemplateContent },
  ): Promise<ValidationResult> {
    const startTime = this.logger.logOperationStart('POST /templates/validate', { channel: body.channel });

    try {
      const result = await this.templatesService.validate(body.channel, body.content);
      this.logger.logOperationEnd('POST /templates/validate', startTime, { isValid: result.isValid });
      return result;
    } catch (error) {
      this.logger.logOperationError('POST /templates/validate', error as Error);
      throw error;
    }
  }
}
