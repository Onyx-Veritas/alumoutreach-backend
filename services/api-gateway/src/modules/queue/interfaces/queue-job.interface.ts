import { PipelineChannel, PipelineSkipReason } from '../../pipeline/entities';

/**
 * Data structure for pipeline job in BullMQ
 * Contains only IDs and references - full data fetched during processing
 */
export interface PipelineJobData {
  /** Pipeline job ID in database */
  jobId: string;

  /** Tenant ID for multi-tenancy */
  tenantId: string;

  /** Correlation ID for request tracing */
  correlationId: string;

  /** Campaign ID */
  campaignId: string;

  /** Campaign run ID */
  campaignRunId: string;

  /** Contact ID to send to */
  contactId: string;

  /** Channel type (email, sms, whatsapp, push) */
  channel: PipelineChannel;

  /** Template version ID for rendering */
  templateVersionId: string;
}

/**
 * Result of job execution
 */
export interface JobExecutionResult {
  /** Whether the send was successful */
  success: boolean;

  /** External provider message ID */
  providerMessageId?: string;

  /** When the message was sent */
  sentAt?: Date;

  /** Error message if failed */
  error?: string;

  /** Whether the job was skipped (not retried) */
  skipped?: boolean;

  /** Reason for skipping */
  skipReason?: PipelineSkipReason;
}

/**
 * Per-tenant queue configuration
 * Controls rate limiting and priority
 */
export interface TenantQueueConfig {
  /** Job priority (1 = highest, 10 = lowest) */
  priority: number;

  /** Delay between jobs in ms */
  delayMs: number;

  /** Max concurrent jobs for this tenant */
  maxConcurrent: number;

  /** Messages per second rate limit */
  rateLimitPerSecond: number;
}

/**
 * Result of batch enqueue operation
 */
export interface EnqueueResult {
  /** Total jobs created */
  totalJobs: number;

  /** Jobs successfully enqueued */
  enqueuedJobs: number;

  /** Jobs skipped (e.g., missing recipient) */
  skippedJobs: number;
}
