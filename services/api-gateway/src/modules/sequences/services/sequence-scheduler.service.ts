 import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SequenceRunRepository } from '../repositories/sequence-run.repository';
import { SequenceExecutorService } from './sequence-executor.service';
import { SequenceRunStatus } from '../entities/sequence.enums';
import { SEQUENCE_EVENTS, SequenceEventFactory } from '../events/sequence.events';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';

const POLL_INTERVAL_MS = 10000; // 10 seconds
const BATCH_SIZE = 100;
const CONCURRENCY_LIMIT = 10;

/**
 * Sequence Scheduler Service
 * Background worker that polls for due runs and executes them
 */
@Injectable()
export class SequenceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private isProcessing = false;
  private isShuttingDown = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly runRepo: SequenceRunRepository,
    private readonly executor: SequenceExecutorService,
    private readonly logger: AppLoggerService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger.setContext('SequenceSchedulerService');
  }

  async onModuleInit(): Promise<void> {
    this.logger.info('Sequence Scheduler initialized, starting poll interval');
    this.startPolling();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.stopPolling();
    this.logger.info('Sequence Scheduler shutting down');
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Start the polling interval
   */
  private startPolling(): void {
    if (this.pollInterval) {
      return;
    }
    this.pollInterval = setInterval(() => {
      void this.pollDueRuns();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop the polling interval
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Poll for due runs
   */
  async pollDueRuns(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;
    const startTime = this.logger.logOperationStart('poll due runs');

    try {
      // Find runs that are due for execution
      const dueRuns = await this.runRepo.findDueRuns(BATCH_SIZE);

      if (dueRuns.length === 0) {
        this.logger.debug('No due runs found');
        this.isProcessing = false;
        return;
      }

      this.logger.info(`Found ${dueRuns.length} due runs to process`);

      // Process runs in parallel with concurrency limit
      const chunks = this.chunkArray(dueRuns, CONCURRENCY_LIMIT);

      for (const chunk of chunks) {
        if (this.isShuttingDown) {
          this.logger.warn('Scheduler shutting down, stopping processing');
          break;
        }

        await Promise.all(
          chunk.map(async (run) => {
            try {
              // Publish run resumed event
              const event = SequenceEventFactory.createRunResumedEvent(
                run.tenantId,
                run.id,
                run.sequenceId,
                run.contactId,
                run.currentStepId || undefined,
                run.currentStepNumber,
                run.correlationId || undefined,
              );
              await this.eventBus.publish(SEQUENCE_EVENTS.RUN_RESUMED, event, {
                tenantId: run.tenantId,
                correlationId: run.correlationId || undefined,
              });

              // Execute the run
              await this.executor.executeRun(run);
            } catch (error) {
              this.logger.logOperationError('process run', error as Error, {
                runId: run.id,
                contactId: run.contactId,
              });
            }
          }),
        );
      }

      this.logger.logOperationEnd('poll due runs', startTime, { processed: dueRuns.length });
    } catch (error) {
      this.logger.logOperationError('poll due runs', error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger execution for a specific run (for testing/debugging)
   */
  async triggerRunExecution(tenantId: string, runId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('manual run trigger', { runId });

    try {
      const run = await this.runRepo.findById(tenantId, runId);
      if (!run) {
        throw new Error(`Run not found: ${runId}`);
      }

      if (run.status !== SequenceRunStatus.RUNNING && run.status !== SequenceRunStatus.WAITING) {
        throw new Error(`Run is not in executable state: ${run.status}`);
      }

      await this.executor.executeRun(run);
      this.logger.logOperationEnd('manual run trigger', startTime);
    } catch (error) {
      this.logger.logOperationError('manual run trigger', error as Error);
      throw error;
    }
  }

  /**
   * Get scheduler health status
   */
  getStatus(): SchedulerStatus {
    return {
      isProcessing: this.isProcessing,
      isShuttingDown: this.isShuttingDown,
      isPolling: this.pollInterval !== null,
      pollIntervalMs: POLL_INTERVAL_MS,
    };
  }

  /**
   * Split array into chunks for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

interface SchedulerStatus {
  isProcessing: boolean;
  isShuttingDown: boolean;
  isPolling: boolean;
  pollIntervalMs: number;
}
