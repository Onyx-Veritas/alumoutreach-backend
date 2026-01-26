import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { Workflow, WorkflowTriggerType } from '../entities/workflow.entity';

export interface FindWorkflowsOptions {
  tenantId: string;
  triggerType?: WorkflowTriggerType;
  isPublished?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface FindWorkflowsResult {
  data: Workflow[];
  total: number;
}

@Injectable()
export class WorkflowRepository {
  constructor(
    @InjectRepository(Workflow)
    private readonly repository: Repository<Workflow>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowRepository');
  }

  async findById(id: string, tenantId: string): Promise<Workflow | null> {
    this.logger.logDbQuery('findById', undefined, { id, tenantId });
    
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findByIdWithRuns(id: string, tenantId: string): Promise<Workflow | null> {
    this.logger.logDbQuery('findByIdWithRuns', undefined, { id, tenantId });
    
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['runs'],
    });
  }

  async findAll(options: FindWorkflowsOptions): Promise<FindWorkflowsResult> {
    const {
      tenantId,
      triggerType,
      isPublished,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: FindOptionsWhere<Workflow> = {
      tenantId,
      isDeleted: false,
    };

    if (triggerType) {
      where.triggerType = triggerType;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { [sortBy]: sortOrder.toUpperCase() },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('findAll', total, { tenantId, page, limit });
    
    return { data, total };
  }

  async findByTriggerType(tenantId: string, triggerType: WorkflowTriggerType): Promise<Workflow[]> {
    this.logger.logDbQuery('findByTriggerType', undefined, { tenantId, triggerType });
    
    return this.repository.find({
      where: {
        tenantId,
        triggerType,
        isPublished: true,
        isDeleted: false,
      },
    });
  }

  async findPublishedByName(name: string, tenantId: string): Promise<Workflow | null> {
    return this.repository.findOne({
      where: {
        name,
        tenantId,
        isPublished: true,
        isDeleted: false,
      },
    });
  }

  async create(workflow: Partial<Workflow>): Promise<Workflow> {
    this.logger.logDbQuery('create', undefined, { tenantId: workflow.tenantId });
    
    const entity = this.repository.create(workflow);
    return this.repository.save(entity);
  }

  async update(id: string, tenantId: string, data: Partial<Workflow>): Promise<Workflow | null> {
    this.logger.logDbQuery('update', undefined, { id, tenantId });
    
    await this.repository.update(
      { id, tenantId, isDeleted: false },
      data,
    );
    
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string, userId?: string): Promise<boolean> {
    this.logger.logDbQuery('softDelete', undefined, { id, tenantId });
    
    const result = await this.repository.update(
      { id, tenantId, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      },
    );
    
    return (result.affected ?? 0) > 0;
  }

  async publish(id: string, tenantId: string, userId?: string): Promise<Workflow | null> {
    this.logger.logDbQuery('publish', undefined, { id, tenantId });
    
    await this.repository.update(
      { id, tenantId, isDeleted: false },
      {
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: userId,
        updatedBy: userId,
      },
    );
    
    return this.findById(id, tenantId);
  }

  async unpublish(id: string, tenantId: string, userId?: string): Promise<Workflow | null> {
    this.logger.logDbQuery('unpublish', undefined, { id, tenantId });
    
    await this.repository.update(
      { id, tenantId, isDeleted: false },
      {
        isPublished: false,
        updatedBy: userId,
      },
    );
    
    return this.findById(id, tenantId);
  }

  async incrementStats(
    id: string,
    field: 'totalRuns' | 'successfulRuns' | 'failedRuns',
  ): Promise<void> {
    this.logger.logDbQuery('incrementStats', undefined, { id, field });
    
    await this.repository
      .createQueryBuilder()
      .update(Workflow)
      .set({ [field]: () => `"${field}" + 1` })
      .where('id = :id', { id })
      .execute();
  }

  async existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const where: FindOptionsWhere<Workflow> = {
      name,
      tenantId,
      isDeleted: false,
    };

    const existing = await this.repository.findOne({ where });
    
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;
    
    return true;
  }
}
