import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { WorkflowNodeRun, WorkflowNodeRunStatus, WorkflowNodeType } from '../entities/workflow-node-run.entity';
import { NodeRunResult } from '../entities/workflow-node-run.entity';

@Injectable()
export class WorkflowNodeRunRepository {
  constructor(
    @InjectRepository(WorkflowNodeRun)
    private readonly repository: Repository<WorkflowNodeRun>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowNodeRunRepository');
  }

  async findById(id: string, tenantId: string): Promise<WorkflowNodeRun | null> {
    this.logger.logDbQuery('findById', undefined, { id, tenantId });
    
    return this.repository.findOne({
      where: { id, tenantId },
    });
  }

  async findByRunId(runId: string, tenantId: string): Promise<WorkflowNodeRun[]> {
    this.logger.logDbQuery('findByRunId', undefined, { runId, tenantId });
    
    return this.repository.find({
      where: { runId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByRunAndNode(runId: string, nodeId: string, tenantId: string): Promise<WorkflowNodeRun | null> {
    return this.repository.findOne({
      where: { runId, nodeId, tenantId },
    });
  }

  async create(nodeRun: Partial<WorkflowNodeRun>): Promise<WorkflowNodeRun> {
    this.logger.logDbQuery('create', undefined, { 
      runId: nodeRun.runId, 
      nodeId: nodeRun.nodeId,
    });
    
    const entity = this.repository.create(nodeRun);
    return this.repository.save(entity);
  }

  async startExecution(
    runId: string,
    nodeId: string,
    nodeType: WorkflowNodeType,
    tenantId: string,
    input?: Record<string, unknown>,
  ): Promise<WorkflowNodeRun> {
    this.logger.logDbQuery('startExecution', undefined, { runId, nodeId, nodeType });
    
    const nodeRun = this.repository.create({
      tenantId,
      runId,
      nodeId,
      nodeType,
      status: WorkflowNodeRunStatus.EXECUTING,
      input,
      executedAt: new Date(),
    });
    
    return this.repository.save(nodeRun);
  }

  async completeExecution(
    id: string,
    tenantId: string,
    result: NodeRunResult,
    durationMs: number,
  ): Promise<void> {
    this.logger.logDbQuery('completeExecution', undefined, { id, tenantId, durationMs });
    
    await this.repository.update(
      { id, tenantId },
      {
        status: result.success ? WorkflowNodeRunStatus.COMPLETED : WorkflowNodeRunStatus.FAILED,
        result,
        durationMs,
        errorMessage: result.error,
      },
    );
  }

  async markSkipped(
    runId: string,
    nodeId: string,
    nodeType: WorkflowNodeType,
    tenantId: string,
    reason: string,
  ): Promise<WorkflowNodeRun> {
    this.logger.logDbQuery('markSkipped', undefined, { runId, nodeId });
    
    const nodeRun = this.repository.create({
      tenantId,
      runId,
      nodeId,
      nodeType,
      status: WorkflowNodeRunStatus.SKIPPED,
      result: { success: true, output: { reason } },
      executedAt: new Date(),
      durationMs: 0,
    });
    
    return this.repository.save(nodeRun);
  }

  async getExecutionStats(runId: string, tenantId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    avgDurationMs: number;
  }> {
    this.logger.logDbQuery('getExecutionStats', undefined, { runId, tenantId });
    
    const nodeRuns = await this.repository.find({
      where: { runId, tenantId },
    });

    const total = nodeRuns.length;
    const completed = nodeRuns.filter(n => n.status === WorkflowNodeRunStatus.COMPLETED).length;
    const failed = nodeRuns.filter(n => n.status === WorkflowNodeRunStatus.FAILED).length;
    const skipped = nodeRuns.filter(n => n.status === WorkflowNodeRunStatus.SKIPPED).length;
    
    const durations = nodeRuns
      .filter(n => n.durationMs !== null && n.durationMs !== undefined)
      .map(n => n.durationMs!);
    
    const avgDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return { total, completed, failed, skipped, avgDurationMs };
  }
}
