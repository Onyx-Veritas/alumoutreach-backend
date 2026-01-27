import { Injectable } from '@nestjs/common';
import { SequenceRepository } from '../repositories/sequence.repository';
import { SequenceRunRepository } from '../repositories/sequence-run.repository';
import { SequenceMapper } from '../mappers/sequence.mapper';
import { SequenceValidators } from '../validators/sequence.validators';
import { SequenceStep, SendMessageStepConfig, DelayStepConfig, ConditionStepConfig } from '../entities/sequence-step.entity';
import { SequenceRun, SequenceRunContext, StepExecutionRecord } from '../entities/sequence-run.entity';
import { SequenceStepType, SequenceRunStatus, SequenceExitReason, DelayUnit } from '../entities/sequence.enums';
import { SEQUENCE_EVENTS, SequenceEventFactory } from '../events/sequence.events';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';

/**
 * Sequence Executor Service
 * Executes individual steps and manages run progression
 */
@Injectable()
export class SequenceExecutorService {
  constructor(
    private readonly sequenceRepo: SequenceRepository,
    private readonly runRepo: SequenceRunRepository,
    private readonly mapper: SequenceMapper,
    private readonly validators: SequenceValidators,
    private readonly logger: AppLoggerService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger.setContext('SequenceExecutorService');
  }

  /**
   * Execute a sequence run
   */
  async executeRun(run: SequenceRun): Promise<void> {
    const startTime = this.logger.logOperationStart('execute run', { runId: run.id, contactId: run.contactId });

    try {
      // Load sequence with steps
      const sequence = await this.sequenceRepo.findById(run.tenantId, run.sequenceId);
      if (!sequence) {
        await this.failRun(run, 'Sequence not found');
        return;
      }

      if (!sequence.isPublished) {
        await this.failRun(run, 'Sequence is not published');
        return;
      }

      // Get current step
      const currentStep = sequence.steps?.find((s) => s.id === run.currentStepId);
      if (!currentStep) {
        await this.failRun(run, 'Current step not found');
        return;
      }

      // Execute the step
      const result = await this.executeStep(run, currentStep, sequence.steps || []);

      if (result.status === 'completed') {
        // Mark run as completed
        await this.completeRun(run);
        await this.sequenceRepo.incrementStats(run.sequenceId, 'completedRuns');
      } else if (result.status === 'exited') {
        // Mark run as exited
        await this.exitRun(run, result.exitReason || SequenceExitReason.CONDITION_EXIT);
        await this.sequenceRepo.incrementStats(run.sequenceId, 'exitedRuns');
      } else if (result.status === 'waiting') {
        // Update run to waiting state
        await this.runRepo.updateById(run.id, {
          status: SequenceRunStatus.WAITING,
          currentStepId: result.nextStepId || run.currentStepId,
          currentStepNumber: result.nextStepNumber || run.currentStepNumber,
          nextExecutionAt: result.nextExecutionAt,
          context: result.context,
        });
      } else if (result.status === 'continue') {
        // Move to next step and execute immediately
        if (result.nextStepId) {
          await this.runRepo.updateById(run.id, {
            currentStepId: result.nextStepId,
            currentStepNumber: result.nextStepNumber || run.currentStepNumber + 1,
            nextExecutionAt: new Date(),
            context: result.context,
          });
        } else {
          // No next step, complete the run
          await this.completeRun(run);
          await this.sequenceRepo.incrementStats(run.sequenceId, 'completedRuns');
        }
      }

      this.logger.logOperationEnd('execute run', startTime, { status: result.status });
    } catch (error) {
      this.logger.logOperationError('execute run', error as Error);
      await this.failRun(run, (error as Error).message);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    run: SequenceRun,
    step: SequenceStep,
    allSteps: SequenceStep[],
  ): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();
    this.logger.logOperationStart('execute step', {
      runId: run.id,
      stepId: step.id,
      stepType: step.stepType,
    });

    try {
      let result: StepExecutionResult;

      switch (step.stepType) {
        case SequenceStepType.SEND_MESSAGE:
          result = await this.executeSendMessageStep(run, step);
          break;
        case SequenceStepType.DELAY:
          result = await this.executeDelayStep(run, step);
          break;
        case SequenceStepType.CONDITION:
          result = await this.executeConditionStep(run, step, allSteps);
          break;
        case SequenceStepType.END:
          result = { status: 'completed', context: run.context };
          break;
        default:
          result = await this.executeUnknownStep(run, step);
      }

      // Record step execution in context
      const executionRecord = this.mapper.createStepExecutionRecord(
        step,
        stepStartTime,
        result.status === 'failed' ? 'failed' : 'success',
        result.output,
        result.error,
      );
      result.context = this.appendStepHistory(result.context || run.context, executionRecord);

      // Publish step executed event
      const event = SequenceEventFactory.createStepExecutedEvent(
        run.tenantId,
        run.id,
        run.sequenceId,
        run.contactId,
        step.id,
        step.stepNumber,
        step.stepType,
        Date.now() - stepStartTime,
        result.status,
        run.correlationId || undefined,
        result.error,
      );
      await this.eventBus.publish(SEQUENCE_EVENTS.STEP_EXECUTED, event, {
        tenantId: run.tenantId,
        correlationId: run.correlationId || undefined,
      });

      // Determine next step if not already set
      if (result.status === 'continue' && !result.nextStepId && step.nextStepId) {
        const nextStep = allSteps.find((s) => s.id === step.nextStepId);
        if (nextStep) {
          result.nextStepId = nextStep.id;
          result.nextStepNumber = nextStep.stepNumber;
        }
      }

      return result;
    } catch (error) {
      this.logger.logOperationError('execute step', error as Error);
      return {
        status: 'failed',
        context: run.context,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Execute SEND_MESSAGE step
   */
  private async executeSendMessageStep(
    run: SequenceRun,
    step: SequenceStep,
  ): Promise<StepExecutionResult> {
    const config = step.config as SendMessageStepConfig;
    this.logger.logOperationStart('execute send_message', {
      runId: run.id,
      templateId: config.templateId,
      channel: config.channel,
    });

    try {
      // Publish message send event for pipeline to process
      const messageEvent = {
        eventId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        eventType: 'pipeline.message.enqueue',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'sequences-module',
        tenantId: run.tenantId,
        correlationId: run.correlationId || '',
        contactId: run.contactId,
        templateId: config.templateId,
        channel: config.channel,
        variables: {
          ...run.context.variables,
          ...config.variables,
        },
        sourceType: 'sequence',
        sourceId: run.sequenceId,
        runId: run.id,
      };

      await this.eventBus.publish('alumoutreach.pipeline.message.enqueue', messageEvent, {
        tenantId: run.tenantId,
        correlationId: run.correlationId || undefined,
      });
      this.logger.logEventPublish('alumoutreach.pipeline.message.enqueue', run.correlationId || '');

      return {
        status: 'continue',
        context: run.context,
        output: {
          templateId: config.templateId,
          channel: config.channel,
          messageSent: true,
        },
      };
    } catch (error) {
      this.logger.logOperationError('execute send_message', error as Error);
      return {
        status: 'failed',
        context: run.context,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Execute DELAY step
   */
  private async executeDelayStep(
    run: SequenceRun,
    step: SequenceStep,
  ): Promise<StepExecutionResult> {
    const config = step.config as DelayStepConfig;
    this.logger.logOperationStart('execute delay', {
      runId: run.id,
      duration: config.duration,
      unit: config.unit,
    });

    const delayMs = this.calculateDelayMs(config.duration, config.unit);
    const nextExecutionAt = new Date(Date.now() + delayMs);

    return {
      status: 'waiting',
      context: run.context,
      nextExecutionAt,
      nextStepId: step.nextStepId || undefined,
      nextStepNumber: step.stepNumber + 1,
      output: {
        delayMs,
        resumeAt: nextExecutionAt.toISOString(),
      },
    };
  }

  /**
   * Execute CONDITION step
   */
  private async executeConditionStep(
    run: SequenceRun,
    step: SequenceStep,
    allSteps: SequenceStep[],
  ): Promise<StepExecutionResult> {
    const config = step.config as ConditionStepConfig;
    this.logger.logOperationStart('execute condition', {
      runId: run.id,
      ruleCount: config.rules?.length || 0,
    });

    try {
      // Get contact attributes (would normally fetch from ContactsService)
      const contactAttributes = run.context.variables as Record<string, unknown>;
      const segmentMembership: string[] = []; // Would fetch from SegmentsService
      const eventContext = run.context.triggerData || {};

      // Evaluate condition
      const conditionResult = this.validators.evaluateCondition(
        config,
        contactAttributes,
        segmentMembership,
        eventContext,
      );

      this.logger.info(`Condition evaluated to: ${conditionResult}`, {
        runId: run.id,
        result: conditionResult,
      });

      // Determine outcome
      if (conditionResult) {
        if (config.exitOnTrue) {
          return {
            status: 'exited',
            context: run.context,
            exitReason: SequenceExitReason.CONDITION_EXIT,
            output: { conditionResult: true, action: 'exit' },
          };
        }
        if (config.trueStepId) {
          const nextStep = allSteps.find((s) => s.id === config.trueStepId);
          return {
            status: 'continue',
            context: run.context,
            nextStepId: config.trueStepId,
            nextStepNumber: nextStep?.stepNumber,
            output: { conditionResult: true, nextStep: config.trueStepId },
          };
        }
      } else {
        if (config.exitOnFalse) {
          return {
            status: 'exited',
            context: run.context,
            exitReason: SequenceExitReason.CONDITION_EXIT,
            output: { conditionResult: false, action: 'exit' },
          };
        }
        if (config.falseStepId) {
          const nextStep = allSteps.find((s) => s.id === config.falseStepId);
          return {
            status: 'continue',
            context: run.context,
            nextStepId: config.falseStepId,
            nextStepNumber: nextStep?.stepNumber,
            output: { conditionResult: false, nextStep: config.falseStepId },
          };
        }
      }

      // Default: continue to next step in sequence
      return {
        status: 'continue',
        context: run.context,
        output: { conditionResult, action: 'continue' },
      };
    } catch (error) {
      this.logger.logOperationError('execute condition', error as Error);
      return {
        status: 'failed',
        context: run.context,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Execute unknown step type
   */
  private async executeUnknownStep(
    run: SequenceRun,
    step: SequenceStep,
  ): Promise<StepExecutionResult> {
    this.logger.warn(`Unknown step type: ${step.stepType}`, { runId: run.id, stepId: step.id });
    return {
      status: 'continue',
      context: run.context,
      output: { skipped: true, reason: 'Unknown step type' },
    };
  }

  /**
   * Append step execution record to context
   */
  private appendStepHistory(
    context: SequenceRunContext,
    record: StepExecutionRecord,
  ): SequenceRunContext {
    return {
      ...context,
      stepHistory: [...(context.stepHistory || []), record],
    };
  }

  /**
   * Mark run as completed
   */
  private async completeRun(run: SequenceRun): Promise<void> {
    await this.runRepo.markCompleted(run.id);

    const event = SequenceEventFactory.createRunCompletedEvent(
      run.tenantId,
      run.id,
      run.sequenceId,
      run.contactId,
      run.correlationId || undefined,
    );
    await this.eventBus.publish(SEQUENCE_EVENTS.RUN_COMPLETED, event, {
      tenantId: run.tenantId,
      correlationId: run.correlationId || undefined,
    });
    this.logger.logEventPublish(SEQUENCE_EVENTS.RUN_COMPLETED, run.correlationId || '');
  }

  /**
   * Mark run as exited
   */
  private async exitRun(run: SequenceRun, reason: SequenceExitReason): Promise<void> {
    await this.runRepo.markExited(run.id, reason);

    const event = SequenceEventFactory.createRunExitedEvent(
      run.tenantId,
      run.id,
      run.sequenceId,
      run.contactId,
      reason,
      run.correlationId || undefined,
    );
    await this.eventBus.publish(SEQUENCE_EVENTS.RUN_EXITED, event, {
      tenantId: run.tenantId,
      correlationId: run.correlationId || undefined,
    });
    this.logger.logEventPublish(SEQUENCE_EVENTS.RUN_EXITED, run.correlationId || '');
  }

  /**
   * Mark run as failed
   */
  private async failRun(run: SequenceRun, errorMessage: string): Promise<void> {
    await this.runRepo.markFailed(run.id, errorMessage);
    await this.sequenceRepo.incrementStats(run.sequenceId, 'failedRuns');

    const event = SequenceEventFactory.createRunFailedEvent(
      run.tenantId,
      run.id,
      run.sequenceId,
      run.contactId,
      errorMessage,
      run.correlationId || undefined,
    );
    await this.eventBus.publish(SEQUENCE_EVENTS.RUN_FAILED, event, {
      tenantId: run.tenantId,
      correlationId: run.correlationId || undefined,
    });
    this.logger.logEventPublish(SEQUENCE_EVENTS.RUN_FAILED, run.correlationId || '');
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
}

/**
 * Result of step execution
 */
interface StepExecutionResult {
  status: 'continue' | 'waiting' | 'completed' | 'exited' | 'failed';
  context: SequenceRunContext;
  nextStepId?: string;
  nextStepNumber?: number;
  nextExecutionAt?: Date;
  exitReason?: SequenceExitReason;
  output?: Record<string, unknown>;
  error?: string;
}
