// ============ Pipeline Enums ============

export enum PipelineJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',       // Job is in BullMQ queue
  PROCESSING = 'processing',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD = 'dead',
  SKIPPED = 'skipped',     // Job skipped due to validation failure (invalid email, missing data, etc.)
}

/**
 * Reasons why a pipeline job was skipped
 */
export enum PipelineSkipReason {
  MISSING_EMAIL = 'missing_email',
  INVALID_EMAIL = 'invalid_email',
  MISSING_PHONE = 'missing_phone',
  INVALID_PHONE = 'invalid_phone',
  UNSUBSCRIBED = 'unsubscribed',
  CONTACT_NOT_FOUND = 'contact_not_found',
  TEMPLATE_ERROR = 'template_error',
  DUPLICATE_SEND = 'duplicate_send',
  OTHER = 'other',
}

export enum PipelineChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}
