/**
 * Queue Constants
 * Centralized configuration for BullMQ queues
 */

// ============ Queue Names ============

export const QUEUE_NAMES = {
  /** Main queue for processing pipeline messages */
  PIPELINE_JOBS: 'pipeline-jobs',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============ Job Names ============

export const JOB_NAMES = {
  /** Send a single message via channel */
  SEND_MESSAGE: 'send-message',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ============ Default Job Options ============

export const DEFAULT_JOB_OPTIONS = {
  /** Number of retry attempts */
  attempts: 3,
  /** Backoff strategy */
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 seconds
  },
  /** Keep last N completed jobs */
  removeOnComplete: {
    count: 1000,
  },
  /** Keep last N failed jobs */
  removeOnFail: {
    count: 5000,
  },
} as const;

// ============ Default Tenant Queue Config ============

export const DEFAULT_TENANT_QUEUE_CONFIG = {
  /** Job priority (1 = highest, 10 = lowest) */
  priority: 5,
  /** Delay between jobs in ms (0 = no delay) */
  delayMs: 0,
  /** Max concurrent jobs for this tenant */
  maxConcurrent: 50,
  /** Messages per second rate limit (0 = no limit) */
  rateLimitPerSecond: 100,
} as const;

// ============ Redis Connection Defaults ============

export const REDIS_DEFAULTS = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Required for BullMQ
} as const;
