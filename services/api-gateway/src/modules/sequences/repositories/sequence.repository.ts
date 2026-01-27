import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { Sequence } from '../entities/sequence.entity';
import { SequenceStep } from '../entities/sequence-step.entity';
import { SequenceType } from '../entities/sequence.enums';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface FindSequencesOptions {
  tenantId: string;
  type?: SequenceType;
  isPublished?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface FindSequencesResult {
  sequences: Sequence[];
  total: number;
}

/**
 * Sequence Repository
 * Handles all database operations for Sequence and SequenceStep entities
 */
@Injectable()
export class SequenceRepository {
  constructor(
    @InjectRepository(Sequence)
    private readonly sequenceRepo: Repository<Sequence>,
    @InjectRepository(SequenceStep)
    private readonly stepRepo: Repository<SequenceStep>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('SequenceRepository');
  }

  /**
   * Create a new sequence
   */
  async create(sequence: Partial<Sequence>): Promise<Sequence> {
    const startTime = this.logger.logOperationStart('create sequence');
    try {
      const entity = this.sequenceRepo.create(sequence);
      const saved = await this.sequenceRepo.save(entity);
      this.logger.logDbQuery('insert sequence', 1);
      this.logger.logOperationEnd('create sequence', startTime, { sequenceId: saved.id });
      return saved;
    } catch (error) {
      this.logger.logOperationError('create sequence', error as Error);
      throw error;
    }
  }

  /**
   * Find sequence by ID
   */
  async findById(tenantId: string, id: string, includeSteps = true): Promise<Sequence | null> {
    const startTime = this.logger.logOperationStart('find sequence by id', { sequenceId: id });
    try {
      const sequence = await this.sequenceRepo.findOne({
        where: { id, tenantId, isDeleted: false },
        relations: includeSteps ? ['steps'] : [],
      });
      this.logger.logDbQuery('select sequence', sequence ? 1 : 0);
      this.logger.logOperationEnd('find sequence by id', startTime);
      return sequence;
    } catch (error) {
      this.logger.logOperationError('find sequence by id', error as Error);
      throw error;
    }
  }

  /**
   * Find sequences with pagination and filters
   */
  async findMany(options: FindSequencesOptions): Promise<FindSequencesResult> {
    const startTime = this.logger.logOperationStart('find sequences', { type: options.type, isPublished: options.isPublished });
    try {
      const { tenantId, type, isPublished, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = options;

      const where: FindOptionsWhere<Sequence> = {
        tenantId,
        isDeleted: false,
      };

      if (type) {
        where.type = type;
      }

      if (isPublished !== undefined) {
        where.isPublished = isPublished;
      }

      if (search) {
        where.name = ILike(`%${search}%`);
      }

      const [sequences, total] = await this.sequenceRepo.findAndCount({
        where,
        relations: ['steps'],
        order: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      this.logger.logDbQuery('select sequences', sequences.length);
      this.logger.logOperationEnd('find sequences', startTime, { total });
      return { sequences, total };
    } catch (error) {
      this.logger.logOperationError('find sequences', error as Error);
      throw error;
    }
  }

  /**
   * Find published sequences by type
   */
  async findPublishedByType(tenantId: string, type: SequenceType): Promise<Sequence[]> {
    const startTime = this.logger.logOperationStart('find published sequences by type', { type });
    try {
      const sequences = await this.sequenceRepo.find({
        where: {
          tenantId,
          type,
          isPublished: true,
          isDeleted: false,
        },
        relations: ['steps'],
      });
      this.logger.logDbQuery('select sequences by type', sequences.length);
      this.logger.logOperationEnd('find published sequences by type', startTime);
      return sequences;
    } catch (error) {
      this.logger.logOperationError('find published sequences by type', error as Error);
      throw error;
    }
  }

  /**
   * Update sequence
   */
  async update(tenantId: string, id: string, updates: Partial<Sequence>): Promise<Sequence | null> {
    const startTime = this.logger.logOperationStart('update sequence', { sequenceId: id });
    try {
      await this.sequenceRepo.update({ id, tenantId, isDeleted: false }, updates);
      this.logger.logDbQuery('update sequence', 1);
      const updated = await this.findById(tenantId, id);
      this.logger.logOperationEnd('update sequence', startTime);
      return updated;
    } catch (error) {
      this.logger.logOperationError('update sequence', error as Error);
      throw error;
    }
  }

  /**
   * Soft delete sequence
   */
  async softDelete(tenantId: string, id: string): Promise<boolean> {
    const startTime = this.logger.logOperationStart('soft delete sequence', { sequenceId: id });
    try {
      const result = await this.sequenceRepo.update(
        { id, tenantId },
        { isDeleted: true, deletedAt: new Date() },
      );
      this.logger.logDbQuery('soft delete sequence', result.affected ?? 0);
      this.logger.logOperationEnd('soft delete sequence', startTime);
      return (result.affected ?? 0) > 0;
    } catch (error) {
      this.logger.logOperationError('soft delete sequence', error as Error);
      throw error;
    }
  }

  /**
   * Increment statistics
   */
  async incrementStats(
    id: string,
    field: 'totalEnrollments' | 'completedRuns' | 'exitedRuns' | 'failedRuns',
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('increment stats', { sequenceId: id, field });
    try {
      await this.sequenceRepo.increment({ id }, field, 1);
      this.logger.logDbQuery('increment stats', 1);
      this.logger.logOperationEnd('increment stats', startTime);
    } catch (error) {
      this.logger.logOperationError('increment stats', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Step Operations
  // ============================================================================

  /**
   * Create steps for a sequence
   */
  async createSteps(steps: Partial<SequenceStep>[]): Promise<SequenceStep[]> {
    const startTime = this.logger.logOperationStart('create steps', { count: steps.length });
    try {
      const entities = this.stepRepo.create(steps);
      const saved = await this.stepRepo.save(entities);
      this.logger.logDbQuery('insert steps', saved.length);
      this.logger.logOperationEnd('create steps', startTime);
      return saved;
    } catch (error) {
      this.logger.logOperationError('create steps', error as Error);
      throw error;
    }
  }

  /**
   * Find step by ID
   */
  async findStepById(tenantId: string, id: string): Promise<SequenceStep | null> {
    const startTime = this.logger.logOperationStart('find step by id', { stepId: id });
    try {
      const step = await this.stepRepo.findOne({
        where: { id, tenantId },
      });
      this.logger.logDbQuery('select step', step ? 1 : 0);
      this.logger.logOperationEnd('find step by id', startTime);
      return step;
    } catch (error) {
      this.logger.logOperationError('find step by id', error as Error);
      throw error;
    }
  }

  /**
   * Find steps by sequence ID
   */
  async findStepsBySequenceId(tenantId: string, sequenceId: string): Promise<SequenceStep[]> {
    const startTime = this.logger.logOperationStart('find steps by sequence', { sequenceId });
    try {
      const steps = await this.stepRepo.find({
        where: { tenantId, sequenceId },
        order: { stepNumber: 'ASC' },
      });
      this.logger.logDbQuery('select steps', steps.length);
      this.logger.logOperationEnd('find steps by sequence', startTime);
      return steps;
    } catch (error) {
      this.logger.logOperationError('find steps by sequence', error as Error);
      throw error;
    }
  }

  /**
   * Find first step of a sequence
   */
  async findFirstStep(tenantId: string, sequenceId: string): Promise<SequenceStep | null> {
    const startTime = this.logger.logOperationStart('find first step', { sequenceId });
    try {
      const step = await this.stepRepo.findOne({
        where: { tenantId, sequenceId, stepNumber: 1, isActive: true },
      });
      this.logger.logDbQuery('select first step', step ? 1 : 0);
      this.logger.logOperationEnd('find first step', startTime);
      return step;
    } catch (error) {
      this.logger.logOperationError('find first step', error as Error);
      throw error;
    }
  }

  /**
   * Update step
   */
  async updateStep(tenantId: string, id: string, updates: Partial<SequenceStep>): Promise<SequenceStep | null> {
    const startTime = this.logger.logOperationStart('update step', { stepId: id });
    try {
      await this.stepRepo.update({ id, tenantId }, updates);
      this.logger.logDbQuery('update step', 1);
      const updated = await this.findStepById(tenantId, id);
      this.logger.logOperationEnd('update step', startTime);
      return updated;
    } catch (error) {
      this.logger.logOperationError('update step', error as Error);
      throw error;
    }
  }

  /**
   * Delete steps by sequence ID
   */
  async deleteStepsBySequenceId(tenantId: string, sequenceId: string): Promise<number> {
    const startTime = this.logger.logOperationStart('delete steps', { sequenceId });
    try {
      const result = await this.stepRepo.delete({ tenantId, sequenceId });
      this.logger.logDbQuery('delete steps', result.affected ?? 0);
      this.logger.logOperationEnd('delete steps', startTime);
      return result.affected ?? 0;
    } catch (error) {
      this.logger.logOperationError('delete steps', error as Error);
      throw error;
    }
  }

  /**
   * Update multiple steps
   */
  async updateSteps(tenantId: string, steps: Array<{ id: string; updates: Partial<SequenceStep> }>): Promise<void> {
    const startTime = this.logger.logOperationStart('update multiple steps', { count: steps.length });
    try {
      for (const step of steps) {
        await this.stepRepo.update({ id: step.id, tenantId }, step.updates);
      }
      this.logger.logDbQuery('update steps', steps.length);
      this.logger.logOperationEnd('update multiple steps', startTime);
    } catch (error) {
      this.logger.logOperationError('update multiple steps', error as Error);
      throw error;
    }
  }
}
