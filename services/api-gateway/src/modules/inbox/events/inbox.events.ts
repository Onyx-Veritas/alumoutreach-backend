/**
 * Inbox Events
 * NATS event subjects and event factory for inbox lifecycle
 */

import { BaseEvent } from '../../../common/events/contact.events';

// ============================================================================
// NATS Subjects
// ============================================================================

export const INBOX_EVENTS = {
  // Thread lifecycle
  THREAD_CREATED: 'alumoutreach.inbox.thread.created',
  THREAD_UPDATED: 'alumoutreach.inbox.thread.updated',
  THREAD_ASSIGNED: 'alumoutreach.inbox.thread.assigned',
  THREAD_UNASSIGNED: 'alumoutreach.inbox.thread.unassigned',
  THREAD_STATUS_CHANGED: 'alumoutreach.inbox.thread.status_changed',
  THREAD_CLOSED: 'alumoutreach.inbox.thread.closed',
  THREAD_REOPENED: 'alumoutreach.inbox.thread.reopened',
  THREAD_ARCHIVED: 'alumoutreach.inbox.thread.archived',

  // Message lifecycle
  MESSAGE_RECEIVED: 'alumoutreach.inbox.message.received',
  MESSAGE_SENT: 'alumoutreach.inbox.message.sent',
  MESSAGE_DELIVERED: 'alumoutreach.inbox.message.delivered',
  MESSAGE_READ: 'alumoutreach.inbox.message.read',
  MESSAGE_FAILED: 'alumoutreach.inbox.message.failed',

  // Activity
  ACTIVITY_CREATED: 'alumoutreach.inbox.activity.created',

  // Distribution
  THREADS_DISTRIBUTED: 'alumoutreach.inbox.threads.distributed',

  // Inbound subjects to listen for
  WHATSAPP_INCOMING: 'alumoutreach.whatsapp.message.incoming',
  SMS_INCOMING: 'alumoutreach.sms.message.incoming',
  EMAIL_INCOMING: 'alumoutreach.email.message.incoming',
} as const;

// ============================================================================
// Event Interfaces
// ============================================================================

export interface InboxThreadEvent extends BaseEvent {
  threadId: string;
  contactId: string;
  channel: string;
  status: string;
  assignedTo?: string;
}

export interface InboxMessageEvent extends BaseEvent {
  messageId: string;
  threadId: string;
  contactId: string;
  channel: string;
  direction: string;
  content?: string;
  templateId?: string;
}

export interface InboxActivityEvent extends BaseEvent {
  activityId: string;
  threadId: string;
  activityType: string;
  createdBy?: string;
}

export interface InboxDistributionEvent extends BaseEvent {
  threadCount: number;
  agentCount: number;
  strategy: string;
  assignments: Record<string, string[]>;
}

// ============================================================================
// Event Factory
// ============================================================================

const EVENT_VERSION = '1.0';
const EVENT_SOURCE = 'inbox-module';

export class InboxEventFactory {
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  static createThreadCreatedEvent(
    tenantId: string,
    threadId: string,
    contactId: string,
    channel: string,
    correlationId?: string,
  ): InboxThreadEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.THREAD_CREATED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      threadId,
      contactId,
      channel,
      status: 'open',
    };
  }

  static createThreadAssignedEvent(
    tenantId: string,
    threadId: string,
    contactId: string,
    channel: string,
    assignedTo: string,
    correlationId?: string,
  ): InboxThreadEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.THREAD_ASSIGNED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      threadId,
      contactId,
      channel,
      status: 'open',
      assignedTo,
    };
  }

  static createThreadStatusChangedEvent(
    tenantId: string,
    threadId: string,
    contactId: string,
    channel: string,
    status: string,
    correlationId?: string,
  ): InboxThreadEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.THREAD_STATUS_CHANGED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      threadId,
      contactId,
      channel,
      status,
    };
  }

  static createMessageReceivedEvent(
    tenantId: string,
    messageId: string,
    threadId: string,
    contactId: string,
    channel: string,
    content?: string,
    correlationId?: string,
  ): InboxMessageEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.MESSAGE_RECEIVED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      messageId,
      threadId,
      contactId,
      channel,
      direction: 'inbound',
      content,
    };
  }

  static createMessageSentEvent(
    tenantId: string,
    messageId: string,
    threadId: string,
    contactId: string,
    channel: string,
    templateId?: string,
    correlationId?: string,
  ): InboxMessageEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.MESSAGE_SENT,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      messageId,
      threadId,
      contactId,
      channel,
      direction: 'outbound',
      templateId,
    };
  }

  static createMessageDeliveredEvent(
    tenantId: string,
    messageId: string,
    threadId: string,
    contactId: string,
    channel: string,
    correlationId?: string,
  ): InboxMessageEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.MESSAGE_DELIVERED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      messageId,
      threadId,
      contactId,
      channel,
      direction: 'outbound',
    };
  }

  static createMessageFailedEvent(
    tenantId: string,
    messageId: string,
    threadId: string,
    contactId: string,
    channel: string,
    error: string,
    correlationId?: string,
  ): InboxMessageEvent & { error: string } {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.MESSAGE_FAILED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      messageId,
      threadId,
      contactId,
      channel,
      direction: 'outbound',
      error,
    };
  }

  static createActivityCreatedEvent(
    tenantId: string,
    activityId: string,
    threadId: string,
    activityType: string,
    createdBy?: string,
    correlationId?: string,
  ): InboxActivityEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.ACTIVITY_CREATED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      activityId,
      threadId,
      activityType,
      createdBy,
    };
  }

  static createThreadsDistributedEvent(
    tenantId: string,
    threadCount: number,
    agentCount: number,
    strategy: string,
    assignments: Record<string, string[]>,
    correlationId?: string,
  ): InboxDistributionEvent {
    return {
      eventId: this.generateEventId(),
      eventType: INBOX_EVENTS.THREADS_DISTRIBUTED,
      timestamp: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || '',
      version: EVENT_VERSION,
      source: EVENT_SOURCE,
      threadCount,
      agentCount,
      strategy,
      assignments,
    };
  }
}
