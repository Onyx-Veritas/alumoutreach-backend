import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowTriggerService } from './workflow-trigger.service';
import { WorkflowTriggerType } from '../entities/workflow.enums';
import { WorkflowRunStatus } from '../entities/workflow-run.entity';

interface SchedulerConfig {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  cronCheckIntervalMs: number;
}

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private delayPollTimer: NodeJS.Timeout | null = null;
  private cronCheckTimer: NodeJS.Timeout | null = null;
  private readonly config: SchedulerConfig;

  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly runRepo: WorkflowRunRepository,
    private readonly runnerService: WorkflowRunnerService,
    private readonly triggerService: WorkflowTriggerService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowSchedulerService');
    
    this.config = {
      enabled: process.env.WORKFLOW_SCHEDULER_ENABLED !== 'false',
      pollIntervalMs: parseInt(process.env.WORKFLOW_DELAY_POLL_INTERVAL_MS || '10000', 10),
      batchSize: parseInt(process.env.WORKFLOW_SCHEDULER_BATCH_SIZE || '100', 10),
      cronCheckIntervalMs: parseInt(process.env.WORKFLOW_CRON_CHECK_INTERVAL_MS || '60000', 10),
    };
  }

  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      this.start();
    } else {
      this.logger.info('Workflow scheduler is disabled');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stop();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting workflow scheduler', {
      pollIntervalMs: this.config.pollIntervalMs,
      cronCheckIntervalMs: this.config.cronCheckIntervalMs,
      batchSize: this.config.batchSize,
    });

    // Start polling for delayed runs
    this.delayPollTimer = setInterval(() => {
      this.processDelayedRuns().catch(err => {
        this.logger.error('Error processing delayed runs', (err as Error).stack);
      });
    }, this.config.pollIntervalMs);

    // Start checking for time-based triggers
    this.cronCheckTimer = setInterval(() => {
      this.processTimeBasedTriggers().catch(err => {
        this.logger.error('Error processing time-based triggers', (err as Error).stack);
      });
    }, this.config.cronCheckIntervalMs);

    // Run immediately on start
    this.processDelayedRuns().catch(err => {
      this.logger.error('Error in initial delayed runs processing', (err as Error).stack);
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logger.info('Stopping workflow scheduler');

    if (this.delayPollTimer) {
      clearInterval(this.delayPollTimer);
      this.delayPollTimer = null;
    }

    if (this.cronCheckTimer) {
      clearInterval(this.cronCheckTimer);
      this.cronCheckTimer = null;
    }
  }

  /**
   * Process delayed workflow runs that are due
   */
  private async processDelayedRuns(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = this.logger.logOperationStart('processDelayedRuns');

    try {
      // Find runs that are waiting and due
      const dueRuns = await this.runRepo.findDueRuns(this.config.batchSize);

      if (dueRuns.length === 0) {
        this.logger.debug('No delayed runs due');
        return;
      }

      this.logger.info('Processing delayed runs', { count: dueRuns.length });

      // Process runs sequentially to avoid overwhelming the system
      for (const run of dueRuns) {
        if (!this.isRunning) break;

        try {
          await this.runnerService.resumeRun(run.id, run.tenantId);
        } catch (error) {
          this.logger.error(`Failed to resume run ${run.id}`, (error as Error).stack, {
            runId: run.id,
            workflowId: run.workflowId,
          });
        }
      }

      this.logger.logOperationEnd('processDelayedRuns', startTime, {
        processed: dueRuns.length,
      });
    } catch (error) {
      this.logger.logOperationError('processDelayedRuns', error as Error);
    }
  }

  /**
   * Process time-based workflow triggers (cron-based)
   */
  private async processTimeBasedTriggers(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = this.logger.logOperationStart('processTimeBasedTriggers');

    try {
      // Get all tenants with time-based workflows
      // Note: In a real implementation, you'd have a more efficient way to do this
      // For now, we'll skip the actual cron matching and just log

      this.logger.debug('Time-based trigger check completed');
      
      // TODO: Implement actual cron matching logic
      // 1. Get all published workflows with TIME_BASED trigger type
      // 2. For each workflow, check if cron expression matches current time
      // 3. If it does, trigger the workflow for all contacts in the segment
      
      this.logger.logOperationEnd('processTimeBasedTriggers', startTime);
    } catch (error) {
      this.logger.logOperationError('processTimeBasedTriggers', error as Error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  /**
   * Manually trigger processing of delayed runs
   */
  async triggerDelayedRunsProcessing(): Promise<number> {
    const dueRuns = await this.runRepo.findDueRuns(this.config.batchSize);
    
    for (const run of dueRuns) {
      try {
        await this.runnerService.resumeRun(run.id, run.tenantId);
      } catch (error) {
        this.logger.error(`Failed to manually resume run ${run.id}`, (error as Error).stack);
      }
    }

    return dueRuns.length;
  }
}
