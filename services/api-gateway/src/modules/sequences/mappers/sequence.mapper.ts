import { Injectable } from '@nestjs/common';
import { Sequence } from '../entities/sequence.entity';
import { SequenceStep } from '../entities/sequence-step.entity';
import { SequenceRun, SequenceRunContext, StepExecutionRecord } from '../entities/sequence-run.entity';
import {
  SequenceSummaryResponseDto,
  SequenceResponseDto,
  SequenceStepResponseDto,
  SequenceRunResponseDto,
  SequenceRunDetailResponseDto,
  SequenceRunContextDto,
  TriggerConfigDto,
} from '../dto/sequence.dto';

/**
 * Sequence Mapper
 * Maps entities to DTOs
 */
@Injectable()
export class SequenceMapper {
  /**
   * Map Sequence entity to summary response DTO
   */
  toSummaryDto(entity: Sequence): SequenceSummaryResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      isPublished: entity.isPublished,
      publishedAt: entity.publishedAt,
      totalEnrollments: entity.totalEnrollments,
      completedRuns: entity.completedRuns,
      stepCount: entity.steps?.length ?? 0,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Map Sequence entity to full response DTO
   */
  toResponseDto(entity: Sequence): SequenceResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      isPublished: entity.isPublished,
      publishedAt: entity.publishedAt,
      totalEnrollments: entity.totalEnrollments,
      completedRuns: entity.completedRuns,
      exitedRuns: entity.exitedRuns,
      failedRuns: entity.failedRuns,
      stepCount: entity.steps?.length ?? 0,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      triggerConfig: entity.triggerConfig as unknown as TriggerConfigDto | null,
      publishedBy: entity.publishedBy,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      steps: entity.steps
        ? entity.steps
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((step) => this.toStepResponseDto(step))
        : [],
    };
  }

  /**
   * Map SequenceStep entity to response DTO
   */
  toStepResponseDto(entity: SequenceStep): SequenceStepResponseDto {
    return {
      id: entity.id,
      sequenceId: entity.sequenceId,
      stepNumber: entity.stepNumber,
      name: entity.name,
      description: entity.description,
      stepType: entity.stepType,
      config: entity.config as SequenceStepResponseDto['config'],
      nextStepId: entity.nextStepId,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Map SequenceRun entity to summary response DTO
   */
  toRunResponseDto(entity: SequenceRun): SequenceRunResponseDto {
    return {
      id: entity.id,
      sequenceId: entity.sequenceId,
      contactId: entity.contactId,
      currentStepId: entity.currentStepId,
      currentStepNumber: entity.currentStepNumber,
      status: entity.status,
      nextExecutionAt: entity.nextExecutionAt,
      exitReason: entity.exitReason,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      errorMessage: entity.errorMessage,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Map SequenceRun entity to detail response DTO
   */
  toRunDetailResponseDto(entity: SequenceRun): SequenceRunDetailResponseDto {
    return {
      id: entity.id,
      sequenceId: entity.sequenceId,
      contactId: entity.contactId,
      currentStepId: entity.currentStepId,
      currentStepNumber: entity.currentStepNumber,
      status: entity.status,
      nextExecutionAt: entity.nextExecutionAt,
      exitReason: entity.exitReason,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      errorMessage: entity.errorMessage,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      context: this.toRunContextDto(entity.context),
      correlationId: entity.correlationId,
      enrolledBy: entity.enrolledBy,
      enrollmentSource: entity.enrollmentSource,
    };
  }

  /**
   * Map SequenceRunContext to DTO
   */
  private toRunContextDto(context: SequenceRunContext): SequenceRunContextDto {
    return {
      variables: context.variables || {},
      stepHistory: context.stepHistory || [],
      triggerData: context.triggerData,
      error: context.error,
      exitDetails: context.exitDetails,
    };
  }

  /**
   * Map multiple sequences to summary DTOs
   */
  toSummaryDtoList(entities: Sequence[]): SequenceSummaryResponseDto[] {
    return entities.map((entity) => this.toSummaryDto(entity));
  }

  /**
   * Map multiple runs to response DTOs
   */
  toRunResponseDtoList(entities: SequenceRun[]): SequenceRunResponseDto[] {
    return entities.map((entity) => this.toRunResponseDto(entity));
  }

  /**
   * Create step execution record for context
   */
  createStepExecutionRecord(
    step: SequenceStep,
    startTime: number,
    result: 'success' | 'failed' | 'skipped',
    output?: Record<string, unknown>,
    error?: string,
  ): StepExecutionRecord {
    return {
      stepId: step.id,
      stepNumber: step.stepNumber,
      stepType: step.stepType,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      result,
      output,
      error,
    };
  }
}
