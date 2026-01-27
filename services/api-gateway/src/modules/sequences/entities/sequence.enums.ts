/**
 * Sequence Engine Enums
 * Defines all enumeration types for the Sequence module
 */

/**
 * Type of sequence determining trigger behavior
 */
export enum SequenceType {
  /** Linear drip sequence - manual enrollment */
  DRIP = 'drip',
  /** Triggered on contact creation */
  ONBOARDING = 'onboarding',
  /** Triggered by specific events */
  BEHAVIORAL = 'behavioral',
}

/**
 * Step types within a sequence
 */
export enum SequenceStepType {
  /** Send a message using a template */
  SEND_MESSAGE = 'send_message',
  /** Wait for a specified duration */
  DELAY = 'delay',
  /** Evaluate conditions and branch */
  CONDITION = 'condition',
  /** Terminal step - ends the sequence */
  END = 'end',
}

/**
 * Status of a sequence run
 */
export enum SequenceRunStatus {
  /** Currently executing */
  RUNNING = 'running',
  /** Successfully completed all steps */
  COMPLETED = 'completed',
  /** Exited early due to condition or manual exit */
  EXITED = 'exited',
  /** Failed due to error */
  FAILED = 'failed',
  /** Paused - waiting for next execution */
  WAITING = 'waiting',
}

/**
 * Delay unit for delay steps
 */
export enum DelayUnit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
  WEEKS = 'weeks',
}

/**
 * Condition operators for evaluation
 */
export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUALS = 'greater_than_or_equals',
  LESS_THAN_OR_EQUALS = 'less_than_or_equals',
  IS_SET = 'is_set',
  IS_NOT_SET = 'is_not_set',
  IN_SEGMENT = 'in_segment',
  NOT_IN_SEGMENT = 'not_in_segment',
}

/**
 * Message channel for sending
 */
export enum MessageChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
}

/**
 * Trigger event types for behavioral sequences
 */
export enum TriggerEventType {
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  MESSAGE_DELIVERED = 'message.delivered',
  MESSAGE_READ = 'message.read',
  CAMPAIGN_SENT = 'campaign.sent',
  TAG_ADDED = 'tag.added',
  TAG_REMOVED = 'tag.removed',
  SEGMENT_ENTERED = 'segment.entered',
  SEGMENT_EXITED = 'segment.exited',
  CUSTOM_EVENT = 'custom.event',
}

/**
 * Exit reason for sequence runs
 */
export enum SequenceExitReason {
  /** Completed all steps normally */
  COMPLETED = 'completed',
  /** Manual exit via API */
  MANUAL_EXIT = 'manual_exit',
  /** Condition evaluated to exit */
  CONDITION_EXIT = 'condition_exit',
  /** Trigger-based exit */
  TRIGGER_EXIT = 'trigger_exit',
  /** Contact unsubscribed */
  UNSUBSCRIBED = 'unsubscribed',
  /** Contact deleted */
  CONTACT_DELETED = 'contact_deleted',
  /** Execution error */
  ERROR = 'error',
}
