/**
 * Custom errors for queue processing
 */

/**
 * Base error for queue processing
 */
export class QueueProcessingError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = true,
    public readonly code: string = 'QUEUE_PROCESSING_ERROR',
  ) {
    super(message);
    this.name = 'QueueProcessingError';
  }
}

/**
 * Error when recipient is invalid for the channel
 */
export class InvalidRecipientError extends QueueProcessingError {
  constructor(message: string) {
    super(message, false, 'INVALID_RECIPIENT');
    this.name = 'InvalidRecipientError';
  }
}

/**
 * Error when template is not found
 */
export class TemplateNotFoundError extends QueueProcessingError {
  constructor(templateVersionId: string) {
    super(`Template version not found: ${templateVersionId}`, false, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}

/**
 * Error when contact is not found
 */
export class ContactNotFoundError extends QueueProcessingError {
  constructor(contactId: string) {
    super(`Contact not found: ${contactId}`, false, 'CONTACT_NOT_FOUND');
    this.name = 'ContactNotFoundError';
  }
}

/**
 * Error when pipeline job is not found
 */
export class PipelineJobNotFoundError extends QueueProcessingError {
  constructor(jobId: string) {
    super(`Pipeline job not found: ${jobId}`, false, 'PIPELINE_JOB_NOT_FOUND');
    this.name = 'PipelineJobNotFoundError';
  }
}

/**
 * Error when message send fails
 */
export class SendFailedError extends QueueProcessingError {
  constructor(message: string, retryable: boolean = true) {
    super(message, retryable, 'SEND_FAILED');
    this.name = 'SendFailedError';
  }
}

/**
 * Error when channel is not supported
 */
export class ChannelNotSupportedError extends QueueProcessingError {
  constructor(channel: string) {
    super(`Channel not supported: ${channel}`, false, 'CHANNEL_NOT_SUPPORTED');
    this.name = 'ChannelNotSupportedError';
  }
}
