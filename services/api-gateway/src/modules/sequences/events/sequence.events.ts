/**
 * Sequence Events
 * NATS event subjects and event factory for sequence lifecycle
 */

import { BaseEvent } from '../../../common/events/contact.events';

// ============================================================================
// NATS Subjects
// ============================================================================

export const SEQUENCE_EVENTS = {
  // Sequence lifecycle
  SEQUENCE_CREATED: 'alumoutreach.sequences.created',
  SEQUENCE_UPDATED: 'alumoutreach.sequences.updated',
  SEQUENCE_DELETED: 'alumoutreach.sequences.deleted',
  SEQUENCE_PUBLISHED: 'alumoutreach.sequences.published',
  SEQUENCE_UNPUBLISHED: 'alumoutreach.sequences.unpublished',

  // Run lifecycle
  RUN_STARTED: 'alumoutreach.sequences.run.started',
  RUN_COMPLETED: 'alumoutreach.sequences.run.completed',
  RUN_EXITED: 'alumoutreach.sequences.run.exited',
  RUN_FAILED: 'alumoutreach.sequences.run.failed',
  RUN_RESUMED: 'alumoutreach.sequences.run.resumed',

  // Step execution
  STEP_STARTED: 'alumoutreach.sequences.step.started',
  STEP_EXECUTED: 'alumoutreach.sequences.step.executed',
  STEP_FAILED: 'alumoutreach.sequences.step.failed',
  STEP_SKIPPED: 'alumoutreach.sequences.step.skipped',

  // Enrollment
  CONTACT_ENROLLED: 'alumoutreach.sequences.contact.enrolled',
  CONTACT_EXITED: 'alumoutreach.sequences.contact.exited',
} as const;

// ============================================================================
// Event Interfaces - Extend BaseEvent for compatibility with EventBusService
// ============================================================================

export interface SequenceLifecycleEvent extends BaseEvent {
  sequenceId: string;
  sequenceName: string;
  sequenceType: string;
  userId?: string;
}

export interface SequenceRunEvent extends BaseEvent {
  runId: string;
  sequenceId: string;
  contactId: string;
  status: string;
  currentStepId?: string;
  currentStepNumber?: number;
  exitReason?: string;
  error?: string;
}

export interface SequenceStepEvent extends BaseEvent {
  runId: string;
  sequenceId: string;
  contactId: string;
  stepId: string;
  stepNumber: number;
  stepType: string;
  durationMs?: number;
  result?: string;
  error?: string;
}

export interface SequenceEnrollmentEvent extends BaseEvent {
  runId: string;
  sequenceId: string;
  contactId: string;
  enrolledBy?: string;
  enrollmentSource?: string;
  triggerData?: Record<string, unknown>;
  exitReason?: string;
}

// ============================================================================
// Event Factory
// ============================================================================

const EVENT_VERSION = '1.0';
const EVENT_SOURCE = 'sequences-module';

export class SequenceEventFactory {
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  static createSequenceCreatedEvent(
    tenantId: string,
    sequenceId: string,
    sequenceName: string,
    sequenceType: string,
    userId?: string,
    correlationId?: string,
  ): SequenceLifecycleEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.SEQUENCE_CREATED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      sequenceId,
      sequenceName,
      sequenceType,
      userId,
    };
  }

  static createSequenceUpdatedEvent(
    tenantId: string,
    sequenceId: string,
    sequenceName: string,
    sequenceType: string,
    userId?: string,
    correlationId?: string,
  ): SequenceLifecycleEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.SEQUENCE_UPDATED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      sequenceId,
      sequenceName,
      sequenceType,
      userId,
    };
  }

  static createSequenceDeletedEvent(
    tenantId: string,
    sequenceId: string,
    sequenceName: string,
    sequenceType: string,
    userId?: string,
    correlationId?: string,
  ): SequenceLifecycleEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.SEQUENCE_DELETED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      sequenceId,
      sequenceName,
      sequenceType,
      userId,
    };
  }

  static createSequencePublishedEvent(
    tenantId: string,
    sequenceId: string,
    sequenceName: string,
    sequenceType: string,
    userId?: string,
    correlationId?: string,
  ): SequenceLifecycleEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.SEQUENCE_PUBLISHED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      sequenceId,
      sequenceName,
      sequenceType,
      userId,
    };
  }

  static createSequenceUnpublishedEvent(
    tenantId: string,
    sequenceId: string,
    sequenceName: string,
    sequenceType: string,
    userId?: string,
    correlationId?: string,
  ): SequenceLifecycleEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.SEQUENCE_UNPUBLISHED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      sequenceId,
      sequenceName,
      sequenceType,
      userId,
    };
  }

  static createRunStartedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    currentStepId?: string,
    currentStepNumber?: number,
    correlationId?: string,
  ): SequenceRunEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.RUN_STARTED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      status: 'running',
      currentStepId,
      currentStepNumber,
    };
  }

  static createRunCompletedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    correlationId?: string,
  ): SequenceRunEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.RUN_COMPLETED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      status: 'completed',
    };
  }

  static createRunExitedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    exitReason: string,
    correlationId?: string,
  ): SequenceRunEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.RUN_EXITED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      status: 'exited',
      exitReason,
    };
  }

  static createRunFailedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    error: string,
    correlationId?: string,
  ): SequenceRunEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.RUN_FAILED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      status: 'failed',
      error,
    };
  }

  static createRunResumedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    currentStepId?: string,
    currentStepNumber?: number,
    correlationId?: string,
  ): SequenceRunEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.RUN_RESUMED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      status: 'running',
      currentStepId,
      currentStepNumber,
    };
  }

  static createStepStartedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    stepId: string,
    stepNumber: number,
    stepType: string,
    correlationId?: string,
  ): SequenceStepEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.STEP_STARTED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      stepId,
      stepNumber,
      stepType,
    };
  }

  static createStepExecutedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    stepId: string,
    stepNumber: number,
    stepType: string,
    durationMs: number,
    result: string,
    correlationId?: string,
    error?: string,
  ): SequenceStepEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.STEP_EXECUTED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      stepId,
      stepNumber,
      stepType,
      durationMs,
      result,
      error,
    };
  }

  static createStepFailedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    stepId: string,
    stepNumber: number,
    stepType: string,
    error: string,
    correlationId?: string,
  ): SequenceStepEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.STEP_FAILED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      stepId,
      stepNumber,
      stepType,
      error,
    };
  }

  static createContactEnrolledEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    enrolledBy?: string,
    enrollmentSource?: string,
    triggerData?: Record<string, unknown>,
    correlationId?: string,
  ): SequenceEnrollmentEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.CONTACT_ENROLLED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      enrolledBy,
      enrollmentSource,
      triggerData,
    };
  }

  static createContactExitedEvent(
    tenantId: string,
    runId: string,
    sequenceId: string,
    contactId: string,
    exitReason: string,
    correlationId?: string,
  ): SequenceEnrollmentEvent {
    return {
      eventId: this.generateEventId(),
      eventType: SEQUENCE_EVENTS.CONTACT_EXITED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      runId,
      sequenceId,
      contactId,
      exitReason,
    };
  }
}
