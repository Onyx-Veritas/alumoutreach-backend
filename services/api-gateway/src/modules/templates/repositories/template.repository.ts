import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, In } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { Template, TemplateChannel, TemplateCategory, ApprovalStatus, TemplateStatus } from '../entities/template.entity';
import { TemplateVersion, TemplateContent } from '../entities/template-version.entity';
import { TemplateUsageStats } from '../entities/template-usage-stats.entity';
import { TemplateSearchDto } from '../dto/template.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TemplateRepository {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    @InjectRepository(TemplateVersion)
    private readonly versionRepo: Repository<TemplateVersion>,
    @InjectRepository(TemplateUsageStats)
    private readonly statsRepo: Repository<TemplateUsageStats>,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('TemplateRepository');
  }

  // ============ Template CRUD ============

  async create(template: Template): Promise<Template> {
    const startTime = this.logger.logOperationStart('create template');

    try {
      const saved = await this.templateRepo.save(template);
      this.logger.logDbQuery('INSERT templates', 1, { templateId: saved.id, duration: Date.now() - startTime });
      this.logger.logOperationEnd('create template', startTime, { templateId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create template', error as Error);
      throw error;
    }
  }

  async findById(tenantId: string, id: string, includeVersions = false): Promise<Template | null> {
    const startTime = this.logger.logOperationStart('find template by id', { tenantId, templateId: id });

    try {
      const relations = ['currentVersion'];
      if (includeVersions) {
        relations.push('versions');
      }

      const template = await this.templateRepo.findOne({
        where: { id, tenantId, deletedAt: undefined },
        relations,
      });

      this.logger.logDbQuery('SELECT templates', template ? 1 : 0, { found: !!template, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find template by id', startTime);
      return template;
    } catch (error) {
      this.logger.logOperationError('find template by id', error as Error);
      throw error;
    }
  }

  async findByName(tenantId: string, name: string): Promise<Template | null> {
    const startTime = this.logger.logOperationStart('find template by name', { tenantId, name });

    try {
      const template = await this.templateRepo.findOne({
        where: { tenantId, name, deletedAt: undefined },
      });

      this.logger.logDbQuery('SELECT templates', template ? 1 : 0, { found: !!template, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find template by name', startTime);
      return template;
    } catch (error) {
      this.logger.logOperationError('find template by name', error as Error);
      throw error;
    }
  }

  async findAll(tenantId: string, query: TemplateSearchDto): Promise<PaginatedResult<Template>> {
    const startTime = this.logger.logOperationStart('find all templates', { tenantId });

    try {
      const {
        q,
        channel,
        category,
        status,
        approvalStatus,
        folder,
        tags,
        approvedOnly,
        page = 1,
        limit = 20,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = query;

      const where: FindOptionsWhere<Template> = {
        tenantId,
        deletedAt: undefined,
      };

      if (channel) where.channel = channel;
      if (category) where.category = category;
      if (status) where.status = status;
      if (approvalStatus) where.approvalStatus = approvalStatus;
      if (folder) where.folder = folder;
      if (approvedOnly) where.isApproved = true;

      const queryBuilder = this.templateRepo.createQueryBuilder('template')
        .where('template.tenant_id = :tenantId', { tenantId })
        .andWhere('template.deleted_at IS NULL');

      if (q) {
        queryBuilder.andWhere(
          '(template.name ILIKE :search OR template.description ILIKE :search)',
          { search: `%${q}%` },
        );
      }

      if (channel) {
        queryBuilder.andWhere('template.channel = :channel', { channel });
      }

      if (category) {
        queryBuilder.andWhere('template.category = :category', { category });
      }

      if (status) {
        queryBuilder.andWhere('template.status = :status', { status });
      }

      if (approvalStatus) {
        queryBuilder.andWhere('template.approval_status = :approvalStatus', { approvalStatus });
      }

      if (folder) {
        queryBuilder.andWhere('template.folder = :folder', { folder });
      }

      if (approvedOnly) {
        queryBuilder.andWhere('template.is_approved = true');
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere('template.tags && :tags', { tags });
      }

      // Sorting
      const order = sortOrder.toUpperCase() as 'ASC' | 'DESC';
      queryBuilder.orderBy(`template.${this.toSnakeCase(sortBy)}`, order);

      // Pagination
      queryBuilder.skip((page - 1) * limit).take(limit);

      // Include current version
      queryBuilder.leftJoinAndSelect('template.currentVersion', 'currentVersion');

      const [data, total] = await queryBuilder.getManyAndCount();

      this.logger.logDbQuery('SELECT templates', data.length, { total, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find all templates', startTime, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('find all templates', error as Error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, updates: Partial<Template>): Promise<Template> {
    const startTime = this.logger.logOperationStart('update template', { tenantId, templateId: id });

    try {
      await this.templateRepo.update({ id, tenantId }, updates);
      const updated = await this.findById(tenantId, id);

      this.logger.logDbQuery('UPDATE templates', 1, { templateId: id, duration: Date.now() - startTime });
      this.logger.logOperationEnd('update template', startTime);

      return updated!;
    } catch (error) {
      this.logger.logOperationError('update template', error as Error);
      throw error;
    }
  }

  async softDelete(tenantId: string, id: string, deletedBy: string): Promise<void> {
    const startTime = this.logger.logOperationStart('soft delete template', { tenantId, templateId: id });

    try {
      await this.templateRepo.update(
        { id, tenantId },
        { deletedAt: new Date(), updatedBy: deletedBy },
      );

      this.logger.logDbQuery('UPDATE soft delete templates', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('soft delete template', startTime);
    } catch (error) {
      this.logger.logOperationError('soft delete template', error as Error);
      throw error;
    }
  }

  // ============ Version Management ============

  async createVersion(version: TemplateVersion): Promise<TemplateVersion> {
    const startTime = this.logger.logOperationStart('create template version', {
      templateId: version.templateId,
      versionNumber: version.versionNumber,
    });

    try {
      // Mark previous versions as not current
      await this.versionRepo.update(
        { templateId: version.templateId },
        { isCurrent: false },
      );

      version.isCurrent = true;
      const saved = await this.versionRepo.save(version);

      this.logger.logDbQuery('INSERT template_versions', 1, {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
        duration: Date.now() - startTime,
      });
      this.logger.logOperationEnd('create template version', startTime);

      return saved;
    } catch (error) {
      this.logger.logOperationError('create template version', error as Error);
      throw error;
    }
  }

  async findVersionById(tenantId: string, versionId: string): Promise<TemplateVersion | null> {
    const startTime = this.logger.logOperationStart('find version by id', { versionId });

    try {
      const version = await this.versionRepo.findOne({
        where: { id: versionId, tenantId },
      });

      this.logger.logDbQuery('SELECT template_versions', version ? 1 : 0, { found: !!version, duration: Date.now() - startTime });
      this.logger.logOperationEnd('find version by id', startTime);
      return version;
    } catch (error) {
      this.logger.logOperationError('find version by id', error as Error);
      throw error;
    }
  }

  async findVersionsByTemplateId(tenantId: string, templateId: string): Promise<TemplateVersion[]> {
    const startTime = this.logger.logOperationStart('find versions by template', { templateId });

    try {
      const versions = await this.versionRepo.find({
        where: { templateId, tenantId },
        order: { versionNumber: 'DESC' },
      });

      this.logger.logDbQuery('SELECT template_versions', versions.length, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('find versions by template', startTime);
      return versions;
    } catch (error) {
      this.logger.logOperationError('find versions by template', error as Error);
      throw error;
    }
  }

  async getLatestVersionNumber(templateId: string): Promise<number> {
    const startTime = this.logger.logOperationStart('get latest version number', { templateId });

    try {
      const result = await this.versionRepo
        .createQueryBuilder('version')
        .select('MAX(version.version_number)', 'max')
        .where('version.template_id = :templateId', { templateId })
        .getRawOne();

      const maxVersion = result?.max || 0;
      this.logger.logDbQuery('SELECT MAX template_versions', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('get latest version number', startTime, { maxVersion });

      return maxVersion;
    } catch (error) {
      this.logger.logOperationError('get latest version number', error as Error);
      throw error;
    }
  }

  // ============ Approval ============

  async approve(tenantId: string, id: string, approvedBy: string, notes?: string): Promise<Template> {
    const startTime = this.logger.logOperationStart('approve template', { tenantId, templateId: id });

    try {
      await this.templateRepo.update(
        { id, tenantId },
        {
          approvalStatus: ApprovalStatus.APPROVED,
          isApproved: true,
          approvedBy,
          approvedAt: new Date(),
          approvalNotes: notes,
          updatedBy: approvedBy,
        },
      );

      const updated = await this.findById(tenantId, id);
      this.logger.logDbQuery('UPDATE approve templates', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('approve template', startTime);

      return updated!;
    } catch (error) {
      this.logger.logOperationError('approve template', error as Error);
      throw error;
    }
  }

  async reject(tenantId: string, id: string, rejectedBy: string, reason: string): Promise<Template> {
    const startTime = this.logger.logOperationStart('reject template', { tenantId, templateId: id });

    try {
      await this.templateRepo.update(
        { id, tenantId },
        {
          approvalStatus: ApprovalStatus.REJECTED,
          isApproved: false,
          approvedBy: rejectedBy,
          approvedAt: new Date(),
          approvalNotes: reason,
          updatedBy: rejectedBy,
        },
      );

      const updated = await this.findById(tenantId, id);
      this.logger.logDbQuery('UPDATE reject templates', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('reject template', startTime);

      return updated!;
    } catch (error) {
      this.logger.logOperationError('reject template', error as Error);
      throw error;
    }
  }

  // ============ Usage Stats ============

  async incrementUsage(tenantId: string, templateId: string, versionId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('increment usage', { templateId });

    try {
      // Update template usage count
      await this.templateRepo.increment({ id: templateId, tenantId }, 'usageCount', 1);
      await this.templateRepo.update({ id: templateId, tenantId }, { lastUsedAt: new Date() });

      // Update or create daily stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let stats = await this.statsRepo.findOne({
        where: { tenantId, templateVersionId: versionId, date: today },
      });

      if (stats) {
        stats.sentCount += 1;
        await this.statsRepo.save(stats);
      } else {
        stats = new TemplateUsageStats();
        stats.tenantId = tenantId;
        stats.templateId = templateId;
        stats.templateVersionId = versionId;
        stats.date = today;
        stats.sentCount = 1;
        await this.statsRepo.save(stats);
      }

      this.logger.logDbQuery('UPDATE usage templates + stats', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('increment usage', startTime);
    } catch (error) {
      this.logger.logOperationError('increment usage', error as Error);
      throw error;
    }
  }

  async getTemplateStats(tenantId: string, templateId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }> {
    const startTime = this.logger.logOperationStart('get template stats', { templateId });

    try {
      const result = await this.statsRepo
        .createQueryBuilder('stats')
        .select('SUM(stats.sent_count)', 'totalSent')
        .addSelect('SUM(stats.delivered_count)', 'totalDelivered')
        .addSelect('SUM(stats.opened_count)', 'totalOpened')
        .addSelect('SUM(stats.clicked_count)', 'totalClicked')
        .where('stats.tenant_id = :tenantId', { tenantId })
        .andWhere('stats.template_id = :templateId', { templateId })
        .getRawOne();

      const totalSent = parseInt(result?.totalSent || '0', 10);
      const totalDelivered = parseInt(result?.totalDelivered || '0', 10);
      const totalOpened = parseInt(result?.totalOpened || '0', 10);
      const totalClicked = parseInt(result?.totalClicked || '0', 10);

      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
      const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

      this.logger.logDbQuery('SELECT stats template_usage_stats', 1, { duration: Date.now() - startTime });
      this.logger.logOperationEnd('get template stats', startTime);

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
      };
    } catch (error) {
      this.logger.logOperationError('get template stats', error as Error);
      throw error;
    }
  }

  // ============ Helpers ============

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
