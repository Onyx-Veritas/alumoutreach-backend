import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThanOrEqual, In } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { WorkflowRun, WorkflowRunStatus } from '../entities/workflow-run.entity';

export interface FindRunsOptions {
  tenantId?: string;
  workflowId?: string;
  contactId?: string;
  status?: WorkflowRunStatus;
  page?: number;
  limit?: number;
}

export interface FindRunsResult {
  data: WorkflowRun[];
  total: number;
}

@Injectable()
export class WorkflowRunRepository {
  constructor(
    @InjectRepository(WorkflowRun)
    private readonly repository: Repository<WorkflowRun>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowRunRepository');
  }

  async findById(id: string, tenantId: string): Promise<WorkflowRun | null> {
    this.logger.logDbQuery('findById', undefined, { id, tenantId });
    
    return this.repository.findOne({
      where: { id, tenantId },
    });
  }

  async findByIdWithNodeRuns(id: string, tenantId: string): Promise<WorkflowRun | null> {
    this.logger.logDbQuery('findByIdWithNodeRuns', undefined, { id, tenantId });
    
    return this.repository.findOne({
      where: { id, tenantId },
      relations: ['nodeRuns'],
      order: { nodeRuns: { createdAt: 'ASC' } },
    });
  }

  async findByWorkflowId(workflowId: string, tenantId: string, options?: FindRunsOptions): Promise<FindRunsResult> {
    const { status, page = 1, limit = 20 } = options || {};

    const where: FindOptionsWhere<WorkflowRun> = {
      workflowId,
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    this.logger.logDbQuery('findByWorkflowId', total, { workflowId, tenantId });
    
    return { data, total };
  }

  async findByContactId(contactId: string, tenantId: string): Promise<WorkflowRun[]> {
    this.logger.logDbQuery('findByContactId', undefined, { contactId, tenantId });
    
    return this.repository.find({
      where: { contactId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findDueRuns(batchSize: number = 100): Promise<WorkflowRun[]> {
    const now = new Date();
    
    this.logger.logDbQuery('findDueRuns', undefined, { batchSize, now: now.toISOString() });
    
    return this.repository.find({
      where: {
        status: WorkflowRunStatus.WAITING,
        nextExecutionAt: LessThanOrEqual(now),
      },
      order: { nextExecutionAt: 'ASC' },
      take: batchSize,
    });
  }

  async findActiveRuns(workflowId: string, contactId: string, tenantId: string): Promise<WorkflowRun[]> {
    return this.repository.find({
      where: {
        workflowId,
        contactId,
        tenantId,
        status: In([WorkflowRunStatus.PENDING, WorkflowRunStatus.RUNNING, WorkflowRunStatus.WAITING]),
      },
    });
  }

  async create(run: Partial<WorkflowRun>): Promise<WorkflowRun> {
    this.logger.logDbQuery('create', undefined, { 
      workflowId: run.workflowId, 
      contactId: run.contactId,
    });
    
    const entity = this.repository.create(run);
    return this.repository.save(entity);
  }

  async update(id: string, tenantId: string, data: Partial<WorkflowRun>): Promise<WorkflowRun | null> {
    this.logger.logDbQuery('update', undefined, { id, tenantId });
    
    await this.repository.update({ id, tenantId }, data);
    return this.findById(id, tenantId);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: WorkflowRunStatus,
    additionalData?: Partial<WorkflowRun>,
  ): Promise<void> {
    this.logger.logDbQuery('updateStatus', undefined, { id, tenantId, status });
    
    await this.repository.update(
      { id, tenantId },
      { status, ...additionalData },
    );
  }

  async setWaiting(
    id: string,
    tenantId: string,
    nextExecutionAt: Date,
    currentNodeId?: string,
  ): Promise<void> {
    this.logger.logDbQuery('setWaiting', undefined, { id, nextExecutionAt });
    
    await this.repository.update(
      { id, tenantId },
      {
        status: WorkflowRunStatus.WAITING,
        nextExecutionAt,
        currentNodeId,
      },
    );
  }

  async markCompleted(id: string, tenantId: string): Promise<void> {
    this.logger.logDbQuery('markCompleted', undefined, { id, tenantId });
    
    await this.repository.update(
      { id, tenantId },
      {
        status: WorkflowRunStatus.COMPLETED,
        completedAt: new Date(),
        nextExecutionAt: undefined,
      },
    );
  }

  async markFailed(id: string, tenantId: string, errorMessage: string): Promise<void> {
    this.logger.logDbQuery('markFailed', undefined, { id, tenantId });
    
    await this.repository.update(
      { id, tenantId },
      {
        status: WorkflowRunStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        nextExecutionAt: undefined,
      },
    );
  }

  async cancel(id: string, tenantId: string): Promise<boolean> {
    this.logger.logDbQuery('cancel', undefined, { id, tenantId });
    
    const result = await this.repository.update(
      {
        id,
        tenantId,
        status: In([WorkflowRunStatus.PENDING, WorkflowRunStatus.RUNNING, WorkflowRunStatus.WAITING]),
      },
      {
        status: WorkflowRunStatus.CANCELLED,
        completedAt: new Date(),
        nextExecutionAt: undefined,
      },
    );
    
    return (result.affected ?? 0) > 0;
  }

  async countByWorkflowId(workflowId: string, tenantId: string): Promise<number> {
    return this.repository.count({
      where: { workflowId, tenantId },
    });
  }

  async countByStatus(workflowId: string, tenantId: string, status: WorkflowRunStatus): Promise<number> {
    return this.repository.count({
      where: { workflowId, tenantId, status },
    });
  }
}
