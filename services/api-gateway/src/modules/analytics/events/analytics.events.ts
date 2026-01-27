/**
 * Analytics NATS Event Subjects
 */
export const ANALYTICS_EVENTS = {
  // Ingestion output
  INGESTED: 'analytics.ingested',

  // Source events to subscribe to
  SOURCES: {
    CONTACT_CREATED: 'contact.created',
    CONTACT_UPDATED: 'contact.updated',
    MESSAGE_SENT: 'inbox.message.sent',
    MESSAGE_RECEIVED: 'inbox.message.received',
    CAMPAIGN_SENT: 'campaign.sent',
    CAMPAIGN_DELIVERED: 'campaign.delivered',
    CAMPAIGN_OPENED: 'campaign.opened',
    CAMPAIGN_CLICKED: 'campaign.clicked',
    WORKFLOW_STARTED: 'workflow.started',
    WORKFLOW_COMPLETED: 'workflow.completed',
    SEQUENCE_STEP_COMPLETED: 'sequence.step.completed',
    SEQUENCE_COMPLETED: 'sequence.completed',
    TEMPLATE_USED: 'template.used',
  },
} as const;

/**
 * All source event subjects as array for subscription
 */
export const ANALYTICS_SOURCE_SUBJECTS = Object.values(ANALYTICS_EVENTS.SOURCES);

/**
 * Analytics Ingested Event Payload
 */
export interface AnalyticsIngestedEvent {
  tenantId: string;
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  channel: string;
  timestamp: string;
  correlationId?: string;
}

/**
 * Source Event Payload (generic)
 */
export interface SourceEventPayload {
  tenantId: string;
  correlationId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Analytics Event Factory
 */
export class AnalyticsEventFactory {
  static createIngestedEvent(params: {
    tenantId: string;
    eventId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    channel: string;
    timestamp: Date;
    correlationId?: string;
  }): { subject: string; payload: AnalyticsIngestedEvent } {
    return {
      subject: ANALYTICS_EVENTS.INGESTED,
      payload: {
        tenantId: params.tenantId,
        eventId: params.eventId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        channel: params.channel,
        timestamp: params.timestamp.toISOString(),
        correlationId: params.correlationId,
      },
    };
  }
}
