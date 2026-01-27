import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SequenceRepository } from '../repositories/sequence.repository';
import { SequenceRunRepository } from '../repositories/sequence-run.repository';
import { SequenceMapper } from '../mappers/sequence.mapper';
import { SequenceValidators } from '../validators/sequence.validators';
import { Sequence } from '../entities/sequence.entity';
import { SequenceStep, StepConfig } from '../entities/sequence-step.entity';
import { SequenceRun } from '../entities/sequence-run.entity';
import { SequenceType, SequenceStepType, SequenceRunStatus, SequenceExitReason, DelayUnit } from '../entities/sequence.enums';
import {
  CreateSequenceDto,
  UpdateSequenceDto,
  SequenceResponseDto,
  SequenceSummaryResponseDto,
  PaginatedSequencesResponseDto,
  ListSequencesQueryDto,
  ListSequenceRunsQueryDto,
  SequenceRunResponseDto,
  SequenceRunDetailResponseDto,
  PaginatedSequenceRunsResponseDto,
  EnrollContactDto,
  PreviewSequenceResponseDto,
  PreviewStepResultDto,
  SendMessageStepConfigDto,
  DelayStepConfigDto,
  ConditionStepConfigDto,
} from '../dto/sequence.dto';
import { SEQUENCE_EVENTS, SequenceEventFactory } from '../events/sequence.events';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';

/**
 * Sequences Service
 * Handles CRUD operations and enrollment logic for sequences
 */
@Injectable()
export class SequencesService {
  constructor(
    private readonly sequenceRepo: SequenceRepository,
    private readonly runRepo: SequenceRunRepository,
    private readonly mapper: SequenceMapper,
    private readonly validators: SequenceValidators,
    private readonly logger: AppLoggerService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger.setContext('SequencesService');
  }

  /**
   * Create a new sequence
   */
  async create(
    tenantId: string,
    dto: CreateSequenceDto,
    userId?: string,
    correlationId?: string,
  ): Promise<SequenceResponseDto> {
    const startTime = this.logger.logOperationStart('create sequence', { tenantId });

    try {
      // Validate DTO
      const validation = this.validators.validateCreateSequenceDto(dto);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Invalid sequence configuration',
          errors: validation.errors,
        });
      }

      // Create sequence entity
      const sequence = await this.sequenceRepo.create({
        tenantId,
        name: dto.name,
        description: dto.description || null,
        type: dto.type,
        triggerConfig: dto.triggerConfig || null,
        createdBy: userId,
        updatedBy: userId,
      });

      // Create steps if provided
      if (dto.steps && dto.steps.length > 0) {
        const steps = dto.steps.map((stepDto) => ({
          tenantId,
          sequenceId: sequence.id,
          stepNumber: stepDto.stepNumber,
          name: stepDto.name || null,
          description: stepDto.description || null,
          stepType: stepDto.stepType,
          config: this.normalizeStepConfig(stepDto.stepType, stepDto.config),
          nextStepId: stepDto.nextStepId || null,
        }));
        await this.sequenceRepo.createSteps(steps);
      }

      // Reload with steps
      const result = await this.sequenceRepo.findById(tenantId, sequence.id);
      if (!result) {
        throw new Error('Failed to reload created sequence');
      }

      // Publish event
      const event = SequenceEventFactory.createSequenceCreatedEvent(
        tenantId,
        sequence.id,
        sequence.name,
        sequence.type,
        userId,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.SEQUENCE_CREATED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.SEQUENCE_CREATED, correlationId || '');

      this.logger.logOperationEnd('create sequence', startTime, { sequenceId: sequence.id });
      return this.mapper.toResponseDto(result);
    } catch (error) {
      this.logger.logOperationError('create sequence', error as Error);
      throw error;
    }
  }

  /**
   * Get sequence by ID
   */
  async findById(tenantId: string, id: string): Promise<SequenceResponseDto> {
    const startTime = this.logger.logOperationStart('find sequence', { sequenceId: id });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, id);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${id} not found`);
      }

      this.logger.logOperationEnd('find sequence', startTime);
      return this.mapper.toResponseDto(sequence);
    } catch (error) {
      this.logger.logOperationError('find sequence', error as Error);
      throw error;
    }
  }

  /**
   * List sequences with pagination
   */
  async findMany(
    tenantId: string,
    query: ListSequencesQueryDto,
  ): Promise<PaginatedSequencesResponseDto> {
    const startTime = this.logger.logOperationStart('list sequences', { tenantId });

    try {
      const { sequences, total } = await this.sequenceRepo.findMany({
        tenantId,
        type: query.type,
        isPublished: query.isPublished,
        search: query.search,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      const data = this.mapper.toSummaryDtoList(sequences);
      const totalPages = Math.ceil(total / (query.limit || 20));

      this.logger.logOperationEnd('list sequences', startTime, { total });
      return {
        data,
        total,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages,
      };
    } catch (error) {
      this.logger.logOperationError('list sequences', error as Error);
      throw error;
    }
  }

  /**
   * Update sequence
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateSequenceDto,
    userId?: string,
    correlationId?: string,
  ): Promise<SequenceResponseDto> {
    const startTime = this.logger.logOperationStart('update sequence', { sequenceId: id });

    try {
      const existing = await this.sequenceRepo.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Sequence with ID ${id} not found`);
      }

      // Cannot update published sequence name or type
      if (existing.isPublished && (dto.name || dto.steps)) {
        throw new BadRequestException('Cannot modify name or steps of a published sequence. Unpublish first.');
      }

      // Update sequence
      const updates: Partial<Sequence> = {
        updatedBy: userId,
      };
      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.description !== undefined) updates.description = dto.description;
      if (dto.triggerConfig !== undefined) updates.triggerConfig = dto.triggerConfig;

      await this.sequenceRepo.update(tenantId, id, updates);

      // Update steps if provided
      if (dto.steps) {
        // Delete existing steps and recreate
        await this.sequenceRepo.deleteStepsBySequenceId(tenantId, id);
        const steps = dto.steps.map((stepDto) => ({
          tenantId,
          sequenceId: id,
          stepNumber: stepDto.stepNumber || 1,
          name: stepDto.name || null,
          description: stepDto.description || null,
          stepType: stepDto.stepType!,
          config: this.normalizeStepConfig(stepDto.stepType!, stepDto.config || {}),
          nextStepId: stepDto.nextStepId || null,
        }));
        await this.sequenceRepo.createSteps(steps);
      }

      const result = await this.sequenceRepo.findById(tenantId, id);
      if (!result) {
        throw new Error('Failed to reload updated sequence');
      }

      // Publish event
      const event = SequenceEventFactory.createSequenceUpdatedEvent(
        tenantId,
        id,
        result.name,
        result.type,
        userId,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.SEQUENCE_UPDATED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.SEQUENCE_UPDATED, correlationId || '');

      this.logger.logOperationEnd('update sequence', startTime);
      return this.mapper.toResponseDto(result);
    } catch (error) {
      this.logger.logOperationError('update sequence', error as Error);
      throw error;
    }
  }

  /**
   * Delete sequence (soft delete)
   */
  async delete(
    tenantId: string,
    id: string,
    userId?: string,
    correlationId?: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('delete sequence', { sequenceId: id });

    try {
      const existing = await this.sequenceRepo.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Sequence with ID ${id} not found`);
      }

      if (existing.isPublished) {
        throw new BadRequestException('Cannot delete a published sequence. Unpublish first.');
      }

      await this.sequenceRepo.softDelete(tenantId, id);

      // Publish event
      const event = SequenceEventFactory.createSequenceDeletedEvent(
        tenantId,
        id,
        existing.name,
        existing.type,
        userId,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.SEQUENCE_DELETED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.SEQUENCE_DELETED, correlationId || '');

      this.logger.logOperationEnd('delete sequence', startTime);
    } catch (error) {
      this.logger.logOperationError('delete sequence', error as Error);
      throw error;
    }
  }

  /**
   * Publish sequence
   */
  async publish(
    tenantId: string,
    id: string,
    userId?: string,
    correlationId?: string,
  ): Promise<SequenceResponseDto> {
    const startTime = this.logger.logOperationStart('publish sequence', { sequenceId: id });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, id);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${id} not found`);
      }

      if (sequence.isPublished) {
        throw new BadRequestException('Sequence is already published');
      }

      // Validate sequence before publishing
      const validation = this.validators.validateSequenceForPublishing(sequence);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Sequence validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      await this.sequenceRepo.update(tenantId, id, {
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: userId,
        updatedBy: userId,
      });

      const result = await this.sequenceRepo.findById(tenantId, id);
      if (!result) {
        throw new Error('Failed to reload published sequence');
      }

      // Publish event
      const event = SequenceEventFactory.createSequencePublishedEvent(
        tenantId,
        id,
        result.name,
        result.type,
        userId,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.SEQUENCE_PUBLISHED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.SEQUENCE_PUBLISHED, correlationId || '');

      this.logger.logOperationEnd('publish sequence', startTime);
      return this.mapper.toResponseDto(result);
    } catch (error) {
      this.logger.logOperationError('publish sequence', error as Error);
      throw error;
    }
  }

  /**
   * Unpublish sequence
   */
  async unpublish(
    tenantId: string,
    id: string,
    userId?: string,
    correlationId?: string,
  ): Promise<SequenceResponseDto> {
    const startTime = this.logger.logOperationStart('unpublish sequence', { sequenceId: id });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, id);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${id} not found`);
      }

      if (!sequence.isPublished) {
        throw new BadRequestException('Sequence is not published');
      }

      await this.sequenceRepo.update(tenantId, id, {
        isPublished: false,
        updatedBy: userId,
      });

      const result = await this.sequenceRepo.findById(tenantId, id);
      if (!result) {
        throw new Error('Failed to reload unpublished sequence');
      }

      // Publish event
      const event = SequenceEventFactory.createSequenceUnpublishedEvent(
        tenantId,
        id,
        result.name,
        result.type,
        userId,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.SEQUENCE_UNPUBLISHED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.SEQUENCE_UNPUBLISHED, correlationId || '');

      this.logger.logOperationEnd('unpublish sequence', startTime);
      return this.mapper.toResponseDto(result);
    } catch (error) {
      this.logger.logOperationError('unpublish sequence', error as Error);
      throw error;
    }
  }

  /**
   * Enroll contact in sequence
   */
  async enrollContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
    dto: EnrollContactDto,
    userId?: string,
    correlationId?: string,
  ): Promise<SequenceRunResponseDto> {
    const startTime = this.logger.logOperationStart('enroll contact', { sequenceId, contactId });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, sequenceId);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${sequenceId} not found`);
      }

      if (!sequence.isPublished) {
        throw new BadRequestException('Cannot enroll in unpublished sequence');
      }

      // Check for existing active run
      const existingRun = await this.runRepo.findActiveRun(tenantId, sequenceId, contactId);
      if (existingRun) {
        throw new ConflictException('Contact is already enrolled in this sequence');
      }

      // Check re-enrollment rules
      if (sequence.triggerConfig?.preventReEnrollment) {
        const completedCount = await this.runRepo.countCompletedRunsForContact(tenantId, sequenceId, contactId);
        if (completedCount > 0) {
          throw new BadRequestException('Contact has already completed this sequence and re-enrollment is disabled');
        }
      }

      if (sequence.triggerConfig?.maxEnrollmentsPerContact) {
        const allRuns = await this.runRepo.findBySequenceAndContact(tenantId, sequenceId, contactId);
        if (allRuns.length >= sequence.triggerConfig.maxEnrollmentsPerContact) {
          throw new BadRequestException('Contact has reached maximum enrollments for this sequence');
        }
      }

      // Get first step
      const firstStep = await this.sequenceRepo.findFirstStep(tenantId, sequenceId);
      if (!firstStep) {
        throw new BadRequestException('Sequence has no steps');
      }

      // Create run
      const run = await this.runRepo.create({
        tenantId,
        sequenceId,
        contactId,
        currentStepId: firstStep.id,
        currentStepNumber: 1,
        status: SequenceRunStatus.RUNNING,
        context: {
          variables: dto.variables || {},
          stepHistory: [],
        },
        nextExecutionAt: new Date(),
        correlationId,
        enrolledBy: userId,
        enrollmentSource: dto.source || 'api',
        startedAt: new Date(),
      });

      // Increment stats
      await this.sequenceRepo.incrementStats(sequenceId, 'totalEnrollments');

      // Publish event
      const event = SequenceEventFactory.createContactEnrolledEvent(
        tenantId,
        run.id,
        sequenceId,
        contactId,
        userId,
        dto.source || 'api',
        dto.variables,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.CONTACT_ENROLLED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.CONTACT_ENROLLED, correlationId || '');

      this.logger.logOperationEnd('enroll contact', startTime, { runId: run.id });
      return this.mapper.toRunResponseDto(run);
    } catch (error) {
      this.logger.logOperationError('enroll contact', error as Error);
      throw error;
    }
  }

  /**
   * Exit contact from sequence
   */
  async exitContact(
    tenantId: string,
    sequenceId: string,
    contactId: string,
    reason?: string,
    userId?: string,
    correlationId?: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('exit contact', { sequenceId, contactId });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, sequenceId);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${sequenceId} not found`);
      }

      const exitedCount = await this.runRepo.exitActiveRunsForContact(
        tenantId,
        sequenceId,
        contactId,
        SequenceExitReason.MANUAL_EXIT,
        reason,
      );

      if (exitedCount === 0) {
        throw new NotFoundException('No active run found for this contact in this sequence');
      }

      // Increment stats
      await this.sequenceRepo.incrementStats(sequenceId, 'exitedRuns');

      // Publish event
      const event = SequenceEventFactory.createContactExitedEvent(
        tenantId,
        '', // No specific run ID when exiting all
        sequenceId,
        contactId,
        SequenceExitReason.MANUAL_EXIT,
        correlationId,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.CONTACT_EXITED, event, { tenantId, correlationId });
      this.logger.logEventPublish(SEQUENCE_EVENTS.CONTACT_EXITED, correlationId || '');

      this.logger.logOperationEnd('exit contact', startTime, { exitedCount });
    } catch (error) {
      this.logger.logOperationError('exit contact', error as Error);
      throw error;
    }
  }

  /**
   * Get runs for a sequence
   */
  async findRuns(
    tenantId: string,
    sequenceId: string,
    query: ListSequenceRunsQueryDto,
  ): Promise<PaginatedSequenceRunsResponseDto> {
    const startTime = this.logger.logOperationStart('list runs', { sequenceId });

    try {
      const { runs, total } = await this.runRepo.findMany({
        tenantId,
        sequenceId,
        contactId: query.contactId,
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      const data = this.mapper.toRunResponseDtoList(runs);
      const totalPages = Math.ceil(total / (query.limit || 20));

      this.logger.logOperationEnd('list runs', startTime, { total });
      return {
        data,
        total,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages,
      };
    } catch (error) {
      this.logger.logOperationError('list runs', error as Error);
      throw error;
    }
  }

  /**
   * Get run details
   */
  async findRunById(
    tenantId: string,
    sequenceId: string,
    runId: string,
  ): Promise<SequenceRunDetailResponseDto> {
    const startTime = this.logger.logOperationStart('find run', { sequenceId, runId });

    try {
      const run = await this.runRepo.findById(tenantId, runId);
      if (!run || run.sequenceId !== sequenceId) {
        throw new NotFoundException(`Run with ID ${runId} not found`);
      }

      this.logger.logOperationEnd('find run', startTime);
      return this.mapper.toRunDetailResponseDto(run);
    } catch (error) {
      this.logger.logOperationError('find run', error as Error);
      throw error;
    }
  }

  /**
   * Preview sequence execution for a contact
   */
  async previewSequence(
    tenantId: string,
    sequenceId: string,
    contactId: string,
  ): Promise<PreviewSequenceResponseDto> {
    const startTime = this.logger.logOperationStart('preview sequence', { sequenceId, contactId });

    try {
      const sequence = await this.sequenceRepo.findById(tenantId, sequenceId);
      if (!sequence) {
        throw new NotFoundException(`Sequence with ID ${sequenceId} not found`);
      }

      const steps = sequence.steps?.sort((a, b) => a.stepNumber - b.stepNumber) || [];
      let totalDelayMs = 0;

      const previewSteps: PreviewStepResultDto[] = steps.map((step) => {
        const preview: Record<string, unknown> = {};

        if (step.stepType === 'delay') {
          const config = step.config as { duration: number; unit: DelayUnit };
          const delayMs = this.calculateDelayMs(config.duration, config.unit);
          totalDelayMs += delayMs;
          preview.delayMs = delayMs;
          preview.delayDescription = `Wait ${config.duration} ${config.unit}`;
        } else if (step.stepType === 'send_message') {
          const config = step.config as { templateId: string; channel: string };
          preview.templateId = config.templateId;
          preview.channel = config.channel;
        }

        return {
          stepId: step.id,
          stepNumber: step.stepNumber,
          stepType: step.stepType,
          name: step.name,
          wouldExecute: true,
          preview,
        };
      });

      this.logger.logOperationEnd('preview sequence', startTime);
      return {
        sequenceId,
        contactId,
        steps: previewSteps,
        estimatedDuration: this.formatDuration(totalDelayMs),
        totalSteps: steps.length,
      };
    } catch (error) {
      this.logger.logOperationError('preview sequence', error as Error);
      throw error;
    }
  }

  /**
   * Calculate delay in milliseconds
   */
  private calculateDelayMs(duration: number, unit: DelayUnit): number {
    switch (unit) {
      case DelayUnit.MINUTES:
        return duration * 60 * 1000;
      case DelayUnit.HOURS:
        return duration * 60 * 60 * 1000;
      case DelayUnit.DAYS:
        return duration * 24 * 60 * 60 * 1000;
      case DelayUnit.WEEKS:
        return duration * 7 * 24 * 60 * 60 * 1000;
      default:
        return duration * 60 * 1000;
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return 'Immediate';
  }

  /**
   * Normalize step config from DTO to entity type
   * Ensures optional fields have proper null values for entity compatibility
   */
  private normalizeStepConfig(
    stepType: SequenceStepType,
    config: SendMessageStepConfigDto | DelayStepConfigDto | ConditionStepConfigDto | Record<string, never>,
  ): StepConfig {
    if (stepType === SequenceStepType.CONDITION) {
      const conditionConfig = config as ConditionStepConfigDto;
      return {
        rules: conditionConfig.rules.map((rule) => ({
          field: rule.field,
          operator: rule.operator,
          value: rule.value,
          segmentId: rule.segmentId,
        })),
        logicalOperator: conditionConfig.logicalOperator,
        trueStepId: conditionConfig.trueStepId ?? null,
        falseStepId: conditionConfig.falseStepId ?? null,
        exitOnTrue: conditionConfig.exitOnTrue,
        exitOnFalse: conditionConfig.exitOnFalse,
      };
    }
    // For other step types, the config is already compatible
    return config as StepConfig;
  }
}
