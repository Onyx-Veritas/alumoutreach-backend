import { PipelineJobStatus, PipelineChannel } from '../entities/pipeline.enums';

// ============ Pipeline Event Types ============

export enum PipelineEventType {
  // Job lifecycle events
  JOB_CREATED = 'pipeline.job.created',
  JOB_STARTED = 'pipeline.job.started',
  JOB_SENT = 'pipeline.job.sent',
  JOB_DELIVERED = 'pipeline.job.delivered',
  JOB_FAILED = 'pipeline.job.failed',
  JOB_RETRYING = 'pipeline.job.retrying',
  JOB_DEAD = 'pipeline.job.dead',

  // Batch events
  BATCH_CREATED = 'pipeline.batch.created',
  BATCH_COMPLETED = 'pipeline.batch.completed',
}

// ============ NATS Subjects ============

export const PipelineSubjects = {
  JOB_CREATED: 'alumoutreach.pipeline.job.created',
  JOB_STARTED: 'alumoutreach.pipeline.job.started',
  JOB_SENT: 'alumoutreach.pipeline.job.sent',
  JOB_DELIVERED: 'alumoutreach.pipeline.job.delivered',
  JOB_FAILED: 'alumoutreach.pipeline.job.failed',
  JOB_RETRYING: 'alumoutreach.pipeline.job.retrying',
  JOB_DEAD: 'alumoutreach.pipeline.job.dead',
  BATCH_CREATED: 'alumoutreach.pipeline.batch.created',
  BATCH_COMPLETED: 'alumoutreach.pipeline.batch.completed',
} as const;

// ============ Base Event Interface ============

export interface BasePipelineEvent {
  eventId: string;
  eventType: PipelineEventType;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  version: string;
  source: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

// ============ Job Events ============

export interface PipelineJobCreatedEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_CREATED;
  payload: {
    jobId: string;
    campaignId: string;
    campaignRunId: string;
    contactId: string;
    channel: PipelineChannel;
    templateVersionId?: string;
  };
}

export interface PipelineJobStartedEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_STARTED;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
  };
}

export interface PipelineJobSentEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_SENT;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
    providerMessageId?: string;
    sentAt: string;
  };
}

export interface PipelineJobDeliveredEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_DELIVERED;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
    deliveredAt: string;
  };
}

export interface PipelineJobFailedEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_FAILED;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
    errorMessage: string;
    retryCount: number;
  };
}

export interface PipelineJobRetryingEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_RETRYING;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
    retryCount: number;
    nextAttemptAt: string;
  };
}

export interface PipelineJobDeadEvent extends BasePipelineEvent {
  eventType: PipelineEventType.JOB_DEAD;
  payload: {
    jobId: string;
    campaignId: string;
    contactId: string;
    channel: PipelineChannel;
    errorMessage: string;
    retryCount: number;
  };
}

// ============ Batch Events ============

export interface PipelineBatchCreatedEvent extends BasePipelineEvent {
  eventType: PipelineEventType.BATCH_CREATED;
  payload: {
    campaignId: string;
    campaignRunId: string;
    totalJobs: number;
    channel: PipelineChannel;
  };
}

export interface PipelineBatchCompletedEvent extends BasePipelineEvent {
  eventType: PipelineEventType.BATCH_COMPLETED;
  payload: {
    campaignId: string;
    campaignRunId: string;
    totalJobs: number;
    sentCount: number;
    failedCount: number;
    durationMs: number;
  };
}

// ============ Union Type ============

export type PipelineEvent =
  | PipelineJobCreatedEvent
  | PipelineJobStartedEvent
  | PipelineJobSentEvent
  | PipelineJobDeliveredEvent
  | PipelineJobFailedEvent
  | PipelineJobRetryingEvent
  | PipelineJobDeadEvent
  | PipelineBatchCreatedEvent
  | PipelineBatchCompletedEvent;
