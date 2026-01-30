import { PipelineJobData, JobExecutionResult } from './queue-job.interface';

/**
 * Interface for job executor implementations
 * Allows swapping execution engine (BullMQ, custom, etc.)
 */
export interface IJobExecutor {
  /**
   * Execute a single job
   * @param jobData - The job data from queue
   * @param attemptNumber - Current attempt number (1-based)
   * @returns Execution result
   */
  execute(jobData: PipelineJobData, attemptNumber: number): Promise<JobExecutionResult>;
}

/**
 * Injection token for job executor
 */
export const JOB_EXECUTOR = Symbol('JOB_EXECUTOR');
