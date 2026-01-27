import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { SequenceRun, SequenceRunContext } from '../entities/sequence-run.entity';
import { SequenceRunStatus, SequenceExitReason } from '../entities/sequence.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface FindRunsOptions {
  tenantId?: string;
  sequenceId?: string;
  contactId?: string;
  status?: SequenceRunStatus;
  page?: number;
  limit?: number;
}

export interface FindRunsResult {
  runs: SequenceRun[];
  total: number;
}

/**
 * Sequence Run Repository
 * Handles all database operations for SequenceRun entity
 */
@Injectable()
export class SequenceRunRepository {
  constructor(
    @InjectRepository(SequenceRun)
    private readonly runRepo: Repository<SequenceRun>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('SequenceRunRepository');
  }

  /**
   * Create a new sequence run
   */
  async create(run: Partial<SequenceRun>): Promise<SequenceRun> {
    const startTime = this.logger.logOperationStart('create run');
    try {
      const entity = this.runRepo.create(run);
      const saved = await this.runRepo.save(entity);
      this.logger.logDbQuery('insert sequence_run', 1);
      this.logger.logOperationEnd('create run', startTime, { runId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create run', error as Error);
      throw error;
    }
  }

  /**
   * Find run by ID
   */
  async findById(tenantId: string, id: string): Promise<SequenceRun | null> {
    const startTime = this.logger.logOperationStart('find run by id', { runId: id });
    try {
      const run = await this.runRepo.findOne({
        where: { id, tenantId },
      });
      this.logger.logDbQuery('select sequence_run', run ? 1 : 0);
      this.logger.logOperationEnd('find run by id', startTime);
      return run;
    } catch (error) {
      this.logger.logOperationError('find run by id', error as Error);
      throw error;
    }
  }

  /**
   * Find runs by sequence and contact
   */
  async findBySequenceAndContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<SequenceRun[]> {
    const startTime = this.logger.logOperationStart('find runs by sequence and contact', { sequenceId, contactId });
    try {
      const runs = await this.runRepo.find({
        where: { tenantId, sequenceId, contactId },
        order: { createdAt: 'DESC' },
      });
      this.logger.logDbQuery('select sequence_runs', runs.length);
      this.logger.logOperationEnd('find runs by sequence and contact', startTime);
      return runs;
    } catch (error) {
      this.logger.logOperationError('find runs by sequence and contact', error as Error);
      throw error;
    }
  }

  /**
   * Find active run for contact in sequence
   */
  async findActiveRun(
    tenantId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<SequenceRun | null> {
    const startTime = this.logger.logOperationStart('find active run', { sequenceId, contactId });
    try {
      const run = await this.runRepo.findOne({
        where: {
          tenantId,
          sequenceId,
          contactId,
          status: In([SequenceRunStatus.RUNNING, SequenceRunStatus.WAITING]),
        },
      });
      this.logger.logDbQuery('select active run', run ? 1 : 0);
      this.logger.logOperationEnd('find active run', startTime);
      return run;
    } catch (error) {
      this.logger.logOperationError('find active run', error as Error);
      throw error;
    }
  }

  /**
   * Find runs with pagination and filters
   */
  async findMany(options: FindRunsOptions): Promise<FindRunsResult> {
    const startTime = this.logger.logOperationStart('find runs', { sequenceId: options.sequenceId });
    try {
      const { tenantId, sequenceId, contactId, status, page = 1, limit = 20 } = options;

      const where: Record<string, unknown> = {};
      if (tenantId) where.tenantId = tenantId;
      if (sequenceId) where.sequenceId = sequenceId;
      if (contactId) where.contactId = contactId;
      if (status) where.status = status;

      const [runs, total] = await this.runRepo.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      this.logger.logDbQuery('select sequence_runs', runs.length);
      this.logger.logOperationEnd('find runs', startTime, { total });
      return { runs, total };
    } catch (error) {
      this.logger.logOperationError('find runs', error as Error);
      throw error;
    }
  }

  /**
   * Find runs due for execution
   */
  async findDueRuns(batchSize = 100): Promise<SequenceRun[]> {
    const startTime = this.logger.logOperationStart('find due runs');
    try {
      const runs = await this.runRepo.find({
        where: {
          status: In([SequenceRunStatus.RUNNING, SequenceRunStatus.WAITING]),
          nextExecutionAt: LessThanOrEqual(new Date()),
        },
        order: { nextExecutionAt: 'ASC' },
        take: batchSize,
      });
      this.logger.logDbQuery('select due runs', runs.length);
      this.logger.logOperationEnd('find due runs', startTime, { count: runs.length });
      return runs;
    } catch (error) {
      this.logger.logOperationError('find due runs', error as Error);
      throw error;
    }
  }

  /**
   * Update run
   */
  async update(tenantId: string, id: string, updates: Partial<SequenceRun>): Promise<SequenceRun | null> {
    const startTime = this.logger.logOperationStart('update run', { runId: id });
    try {
      await this.runRepo.update({ id, tenantId }, updates);
      this.logger.logDbQuery('update sequence_run', 1);
      const updated = await this.findById(tenantId, id);
      this.logger.logOperationEnd('update run', startTime);
      return updated;
    } catch (error) {
      this.logger.logOperationError('update run', error as Error);
      throw error;
    }
  }

  /**
   * Update run by ID only (for scheduler)
   */
  async updateById(id: string, updates: Partial<SequenceRun>): Promise<void> {
    const startTime = this.logger.logOperationStart('update run by id', { runId: id });
    try {
      await this.runRepo.update({ id }, updates);
      this.logger.logDbQuery('update sequence_run', 1);
      this.logger.logOperationEnd('update run by id', startTime);
    } catch (error) {
      this.logger.logOperationError('update run by id', error as Error);
      throw error;
    }
  }

  /**
   * Mark run as completed
   */
  async markCompleted(id: string): Promise<void> {
    const startTime = this.logger.logOperationStart('mark run completed', { runId: id });
    try {
      await this.runRepo.update(
        { id },
        {
          status: SequenceRunStatus.COMPLETED,
          exitReason: SequenceExitReason.COMPLETED,
          completedAt: new Date(),
          nextExecutionAt: null,
        },
      );
      this.logger.logDbQuery('update sequence_run', 1);
      this.logger.logOperationEnd('mark run completed', startTime);
    } catch (error) {
      this.logger.logOperationError('mark run completed', error as Error);
      throw error;
    }
  }

  /**
   * Mark run as exited
   */
  async markExited(id: string, reason: SequenceExitReason, message?: string): Promise<void> {
    const startTime = this.logger.logOperationStart('mark run exited', { runId: id, reason });
    try {
      await this.runRepo.update(
        { id },
        {
          status: SequenceRunStatus.EXITED,
          exitReason: reason,
          completedAt: new Date(),
          nextExecutionAt: null,
          errorMessage: message || null,
        },
      );
      this.logger.logDbQuery('update sequence_run', 1);
      this.logger.logOperationEnd('mark run exited', startTime);
    } catch (error) {
      this.logger.logOperationError('mark run exited', error as Error);
      throw error;
    }
  }

  /**
   * Mark run as failed
   */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    const startTime = this.logger.logOperationStart('mark run failed', { runId: id });
    try {
      await this.runRepo.update(
        { id },
        {
          status: SequenceRunStatus.FAILED,
          exitReason: SequenceExitReason.ERROR,
          completedAt: new Date(),
          nextExecutionAt: null,
          errorMessage,
        },
      );
      this.logger.logDbQuery('update sequence_run', 1);
      this.logger.logOperationEnd('mark run failed', startTime);
    } catch (error) {
      this.logger.logOperationError('mark run failed', error as Error);
      throw error;
    }
  }

  /**
   * Update run context
   */
  async updateContext(id: string, context: SequenceRunContext): Promise<void> {
    const startTime = this.logger.logOperationStart('update run context', { runId: id });
    try {
      await this.runRepo.update({ id }, { context });
      this.logger.logDbQuery('update sequence_run context', 1);
      this.logger.logOperationEnd('update run context', startTime);
    } catch (error) {
      this.logger.logOperationError('update run context', error as Error);
      throw error;
    }
  }

  /**
   * Count active runs for contact in sequence
   */
  async countActiveRunsForContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<number> {
    const startTime = this.logger.logOperationStart('count active runs', { sequenceId, contactId });
    try {
      const count = await this.runRepo.count({
        where: {
          tenantId,
          sequenceId,
          contactId,
          status: In([SequenceRunStatus.RUNNING, SequenceRunStatus.WAITING]),
        },
      });
      this.logger.logDbQuery('count active runs', count);
      this.logger.logOperationEnd('count active runs', startTime);
      return count;
    } catch (error) {
      this.logger.logOperationError('count active runs', error as Error);
      throw error;
    }
  }

  /**
   * Count completed runs for contact in sequence
   */
  async countCompletedRunsForContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<number> {
    const startTime = this.logger.logOperationStart('count completed runs', { sequenceId, contactId });
    try {
      const count = await this.runRepo.count({
        where: {
          tenantId,
          sequenceId,
          contactId,
          status: SequenceRunStatus.COMPLETED,
        },
      });
      this.logger.logDbQuery('count completed runs', count);
      this.logger.logOperationEnd('count completed runs', startTime);
      return count;
    } catch (error) {
      this.logger.logOperationError('count completed runs', error as Error);
      throw error;
    }
  }

  /**
   * Exit all active runs for a contact in a sequence
   */
  async exitActiveRunsForContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
    reason: SequenceExitReason,
    message?: string,
  ): Promise<number> {
    const startTime = this.logger.logOperationStart('exit active runs for contact', { sequenceId, contactId });
    try {
      const result = await this.runRepo.update(
        {
          tenantId,
          sequenceId,
          contactId,
          status: In([SequenceRunStatus.RUNNING, SequenceRunStatus.WAITING]),
        },
        {
          status: SequenceRunStatus.EXITED,
          exitReason: reason,
          completedAt: new Date(),
          nextExecutionAt: null,
          errorMessage: message || null,
        },
      );
      this.logger.logDbQuery('exit active runs', result.affected ?? 0);
      this.logger.logOperationEnd('exit active runs for contact', startTime);
      return result.affected ?? 0;
    } catch (error) {
      this.logger.logOperationError('exit active runs for contact', error as Error);
      throw error;
    }
  }
}
