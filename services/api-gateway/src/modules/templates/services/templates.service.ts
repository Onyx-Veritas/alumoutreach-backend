import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TemplateRepository, PaginatedResult } from '../repositories/template.repository';
import { Template, TemplateChannel, TemplateCategory, ApprovalStatus, TemplateStatus } from '../entities/template.entity';
import { TemplateVersion, TemplateContent } from '../entities/template-version.entity';
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
import { TemplateMapper } from '../mappers/template.mapper';
import { TemplateValidatorFactory, ValidationResult } from '../validators/template-validators';
import { TemplateRendererService } from '../render/template-renderer.service';
import { TemplateEventType } from '../../../common/events/template.events';

@Injectable()
export class TemplatesService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly validatorFactory: TemplateValidatorFactory,
    private readonly rendererService: TemplateRendererService,
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('TemplatesService');
  }

  // ============ Template CRUD ============

  async create(tenantId: string, userId: string, dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('create template', { tenantId, correlationId });

    try {
      // Check for duplicate name
      const existing = await this.templateRepository.findByName(tenantId, dto.name);
      if (existing) {
        throw new ConflictException(`Template with name "${dto.name}" already exists`);
      }

      // Validate content if provided
      if (dto.content) {
        const validation = this.validatorFactory.validate(dto.channel, dto.content);
        if (!validation.isValid) {
          throw new BadRequestException({
            message: 'Template content validation failed',
            errors: validation.errors,
          });
        }
      }

      // Create template entity
      const template = new Template();
      template.id = uuidv4();
      template.tenantId = tenantId;
      template.name = dto.name;
      template.description = dto.description;
      template.channel = dto.channel;
      template.category = dto.category || TemplateCategory.TRANSACTIONAL;
      template.folder = dto.folder;
      template.tags = dto.tags || [];
      template.status = TemplateStatus.INACTIVE;
      template.approvalStatus = ApprovalStatus.DRAFT;
      template.isApproved = false;
      template.usageCount = 0;
      template.createdBy = userId;
      template.updatedBy = userId;
      template.metadata = dto.metadata;

      // Save template
      const saved = await this.templateRepository.create(template);

      // Create initial version if content provided
      if (dto.content) {
        const version = await this.createVersionInternal(
          tenantId,
          saved.id,
          userId,
          dto.content as TemplateContent,
          dto.channel,
          'Initial version',
        );
        saved.currentVersion = version;
        saved.currentVersionId = version.id;
      }

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_CREATED, {
        templateId: saved.id,
        name: saved.name,
        channel: saved.channel,
        category: saved.category,
        versionId: saved.currentVersionId,
        createdBy: userId,
      }, correlationId);

      this.logger.logOperationEnd('create template', startTime, { templateId: saved.id });
      return TemplateMapper.toResponseDto(saved);
    } catch (error) {
      this.logger.logOperationError('create template', error as Error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string, includeVersions = false): Promise<TemplateResponseDto> {
    const startTime = this.logger.logOperationStart('find template by id', { tenantId, templateId: id });

    try {
      const template = await this.templateRepository.findById(tenantId, id, includeVersions);
      if (!template) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      this.logger.logOperationEnd('find template by id', startTime);
      return TemplateMapper.toResponseDto(template);
    } catch (error) {
      this.logger.logOperationError('find template by id', error as Error);
      throw error;
    }
  }

  async findAll(tenantId: string, query: TemplateSearchDto): Promise<PaginatedResult<TemplateResponseDto>> {
    const startTime = this.logger.logOperationStart('find all templates', { tenantId });

    try {
      const result = await this.templateRepository.findAll(tenantId, query);

      this.logger.logOperationEnd('find all templates', startTime, { total: result.total });
      return {
        data: TemplateMapper.toResponseDtoList(result.data),
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    } catch (error) {
      this.logger.logOperationError('find all templates', error as Error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, userId: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('update template', { tenantId, templateId: id, correlationId });

    try {
      const existing = await this.templateRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      // Check for duplicate name if name is being changed
      if (dto.name && dto.name !== existing.name) {
        const duplicate = await this.templateRepository.findByName(tenantId, dto.name);
        if (duplicate) {
          throw new ConflictException(`Template with name "${dto.name}" already exists`);
        }
      }

      // Build updates
      const updates: Partial<Template> = {
        updatedBy: userId,
      };

      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.description !== undefined) updates.description = dto.description;
      if (dto.category !== undefined) updates.category = dto.category;
      if (dto.folder !== undefined) updates.folder = dto.folder;
      if (dto.tags !== undefined) updates.tags = dto.tags;
      if (dto.status !== undefined) updates.status = dto.status;
      if (dto.metadata !== undefined) updates.metadata = dto.metadata;

      // If status changed to active, require approval
      if (dto.status === TemplateStatus.ACTIVE && !existing.isApproved) {
        throw new BadRequestException('Template must be approved before activation');
      }

      const updated = await this.templateRepository.update(tenantId, id, updates);

      // If content provided, create new version
      if (dto.content) {
        const channel = existing.channel;
        const validation = this.validatorFactory.validate(channel, dto.content);
        if (!validation.isValid) {
          throw new BadRequestException({
            message: 'Template content validation failed',
            errors: validation.errors,
          });
        }

        await this.createVersionInternal(
          tenantId,
          id,
          userId,
          dto.content as TemplateContent,
          channel,
          'Updated content',
        );
      }

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_UPDATED, {
        templateId: id,
        changes: updates,
        updatedBy: userId,
      }, correlationId);

      this.logger.logOperationEnd('update template', startTime);
      return TemplateMapper.toResponseDto(updated);
    } catch (error) {
      this.logger.logOperationError('update template', error as Error);
      throw error;
    }
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('delete template', { tenantId, templateId: id, correlationId });

    try {
      const existing = await this.templateRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      await this.templateRepository.softDelete(tenantId, id, userId);

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_DELETED, {
        templateId: id,
        name: existing.name,
        deletedBy: userId,
        hardDelete: false,
      }, correlationId);

      this.logger.logOperationEnd('delete template', startTime);
    } catch (error) {
      this.logger.logOperationError('delete template', error as Error);
      throw error;
    }
  }

  // ============ Version Management ============

  async createVersion(
    tenantId: string,
    templateId: string,
    userId: string,
    dto: CreateVersionDto,
  ): Promise<TemplateVersionResponseDto> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('create template version', {
      tenantId,
      templateId,
      correlationId,
    });

    try {
      const template = await this.templateRepository.findById(tenantId, templateId);
      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      // Validate content
      const validation = this.validatorFactory.validate(template.channel, dto.content);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Template content validation failed',
          errors: validation.errors,
        });
      }

      const version = await this.createVersionInternal(
        tenantId,
        templateId,
        userId,
        dto.content as TemplateContent,
        template.channel,
        dto.changelog,
      );

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_VERSION_CREATED, {
        templateId,
        versionId: version.id,
        versionNumber: version.versionNumber,
        changelog: dto.changelog,
        createdBy: userId,
      }, correlationId);

      this.logger.logOperationEnd('create template version', startTime, { versionId: version.id });
      return TemplateMapper.toVersionResponseDto(version);
    } catch (error) {
      this.logger.logOperationError('create template version', error as Error);
      throw error;
    }
  }

  async getVersions(tenantId: string, templateId: string): Promise<TemplateVersionResponseDto[]> {
    const startTime = this.logger.logOperationStart('get template versions', { tenantId, templateId });

    try {
      const template = await this.templateRepository.findById(tenantId, templateId);
      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      const versions = await this.templateRepository.findVersionsByTemplateId(tenantId, templateId);

      this.logger.logOperationEnd('get template versions', startTime, { count: versions.length });
      return versions.map((v) => TemplateMapper.toVersionResponseDto(v));
    } catch (error) {
      this.logger.logOperationError('get template versions', error as Error);
      throw error;
    }
  }

  async getVersionById(
    tenantId: string,
    templateId: string,
    versionId: string,
  ): Promise<TemplateVersionResponseDto> {
    const startTime = this.logger.logOperationStart('get template version by id', { tenantId, templateId, versionId });

    try {
      const version = await this.templateRepository.findVersionById(tenantId, versionId);
      if (!version || version.templateId !== templateId) {
        throw new NotFoundException(`Version with id "${versionId}" not found`);
      }

      this.logger.logOperationEnd('get template version by id', startTime);
      return TemplateMapper.toVersionResponseDto(version);
    } catch (error) {
      this.logger.logOperationError('get template version by id', error as Error);
      throw error;
    }
  }

  // ============ Preview & Render ============

  async preview(tenantId: string, templateId: string, dto: PreviewTemplateDto): Promise<TemplatePreviewResponseDto> {
    const startTime = this.logger.logOperationStart('preview template', { tenantId, templateId });

    try {
      const template = await this.templateRepository.findById(tenantId, templateId);
      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      let version: TemplateVersion | null = null;

      if (dto.versionId) {
        version = await this.templateRepository.findVersionById(tenantId, dto.versionId);
        if (!version || version.templateId !== templateId) {
          throw new NotFoundException(`Version with id "${dto.versionId}" not found`);
        }
      } else {
        version = template.currentVersion;
        if (!version) {
          throw new BadRequestException('Template has no content version');
        }
      }

      // Render with variables or generate preview with sample data
      const renderResult = dto.variables && Object.keys(dto.variables).length > 0
        ? this.rendererService.render(template.channel, version.content, dto.variables)
        : this.rendererService.generatePreview(template.channel, version.content);

      this.logger.logOperationEnd('preview template', startTime);
      return {
        templateId,
        versionId: version.id,
        versionNumber: version.versionNumber,
        channel: template.channel,
        renderedContent: renderResult.renderedContent as unknown as Record<string, unknown>,
        variablesUsed: renderResult.variablesUsed,
        missingVariables: renderResult.missingVariables,
      };
    } catch (error) {
      this.logger.logOperationError('preview template', error as Error);
      throw error;
    }
  }

  async render(
    tenantId: string,
    templateId: string,
    variables: Record<string, string>,
    versionId?: string,
  ): Promise<TemplateContent> {
    const startTime = this.logger.logOperationStart('render template', { tenantId, templateId });

    try {
      const template = await this.templateRepository.findById(tenantId, templateId);
      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      let version: TemplateVersion | null = null;

      if (versionId) {
        version = await this.templateRepository.findVersionById(tenantId, versionId);
      } else {
        version = template.currentVersion;
      }

      if (!version) {
        throw new BadRequestException('Template has no content version');
      }

      const renderResult = this.rendererService.render(template.channel, version.content, variables);

      // Track usage
      await this.templateRepository.incrementUsage(tenantId, templateId, version.id);

      this.logger.logOperationEnd('render template', startTime);
      return renderResult.renderedContent;
    } catch (error) {
      this.logger.logOperationError('render template', error as Error);
      throw error;
    }
  }

  // ============ Approval Workflow ============

  async approve(tenantId: string, id: string, userId: string, dto: ApproveTemplateDto): Promise<TemplateResponseDto> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('approve template', { tenantId, templateId: id, correlationId });

    try {
      const template = await this.templateRepository.findById(tenantId, id);
      if (!template) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      if (template.approvalStatus === ApprovalStatus.APPROVED) {
        throw new BadRequestException('Template is already approved');
      }

      // Verify template has content
      if (!template.currentVersion) {
        throw new BadRequestException('Cannot approve template without content');
      }

      const updated = await this.templateRepository.approve(tenantId, id, userId, dto.notes);

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_APPROVED, {
        templateId: id,
        name: template.name,
        approvedBy: userId,
        notes: dto.notes,
      }, correlationId);

      this.logger.logOperationEnd('approve template', startTime);
      return TemplateMapper.toResponseDto(updated);
    } catch (error) {
      this.logger.logOperationError('approve template', error as Error);
      throw error;
    }
  }

  async reject(tenantId: string, id: string, userId: string, dto: RejectTemplateDto): Promise<TemplateResponseDto> {
    const correlationId = uuidv4();
    const startTime = this.logger.logOperationStart('reject template', { tenantId, templateId: id, correlationId });

    try {
      const template = await this.templateRepository.findById(tenantId, id);
      if (!template) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      const updated = await this.templateRepository.reject(tenantId, id, userId, dto.reason);

      // Publish event
      this.publishEvent(TemplateEventType.TEMPLATE_REJECTED, {
        templateId: id,
        name: template.name,
        rejectedBy: userId,
        reason: dto.reason,
      }, correlationId);

      this.logger.logOperationEnd('reject template', startTime);
      return TemplateMapper.toResponseDto(updated);
    } catch (error) {
      this.logger.logOperationError('reject template', error as Error);
      throw error;
    }
  }

  // ============ Statistics ============

  async getStats(tenantId: string, templateId: string): Promise<TemplateStatsResponseDto> {
    const startTime = this.logger.logOperationStart('get template stats', { tenantId, templateId });

    try {
      const template = await this.templateRepository.findById(tenantId, templateId);
      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      const stats = await this.templateRepository.getTemplateStats(tenantId, templateId);

      this.logger.logOperationEnd('get template stats', startTime);
      return {
        templateId,
        ...stats,
      };
    } catch (error) {
      this.logger.logOperationError('get template stats', error as Error);
      throw error;
    }
  }

  // ============ Validation ============

  async validate(channel: TemplateChannel, content: TemplateContent): Promise<ValidationResult> {
    const startTime = this.logger.logOperationStart('validate template content', { channel });

    try {
      const result = this.validatorFactory.validate(channel, content);
      this.logger.logOperationEnd('validate template content', startTime, { isValid: result.isValid });
      return result;
    } catch (error) {
      this.logger.logOperationError('validate template content', error as Error);
      throw error;
    }
  }

  // ============ Private Helpers ============

  private async createVersionInternal(
    tenantId: string,
    templateId: string,
    userId: string,
    content: TemplateContent,
    channel: TemplateChannel,
    changelog?: string,
  ): Promise<TemplateVersion> {
    const latestVersionNumber = await this.templateRepository.getLatestVersionNumber(templateId);

    const version = new TemplateVersion();
    version.id = uuidv4();
    version.tenantId = tenantId;
    version.templateId = templateId;
    version.versionNumber = latestVersionNumber + 1;
    version.channel = channel;
    version.content = content;
    version.variables = this.rendererService.extractVariables(channel, content);
    version.changelog = changelog;
    version.isValid = true;
    version.createdBy = userId;

    const saved = await this.templateRepository.createVersion(version);

    // Update template with current version
    await this.templateRepository.update(tenantId, templateId, {
      currentVersionId: saved.id,
      currentVersionNumber: saved.versionNumber,
      updatedBy: userId,
    });

    return saved;
  }

  private publishEvent(eventType: TemplateEventType, payload: Record<string, unknown>, correlationId: string): void {
    try {
      const eventId = uuidv4();
      const event = {
        eventId,
        eventType,
        version: '1.0',
        source: 'templates-service',
        correlationId,
        timestamp: new Date().toISOString(),
        payload,
      };
      this.natsClient.emit(eventType, event);
      this.logger.logEventPublish(eventType, correlationId, { templateId: payload.templateId as string });
    } catch (error) {
      this.logger.warn(`Failed to publish event: ${eventType}`, { error: (error as Error).message });
    }
  }
}
