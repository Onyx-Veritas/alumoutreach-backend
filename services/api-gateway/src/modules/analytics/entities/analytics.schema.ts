/**
 * ClickHouse Analytics Schema
 * Defines the analytics_events table structure
 */

/**
 * Analytics Event Types
 */
export enum AnalyticsEventType {
  // Contact events
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',

  // Inbox events
  MESSAGE_SENT = 'inbox.message.sent',
  MESSAGE_RECEIVED = 'inbox.message.received',

  // Campaign events
  CAMPAIGN_SENT = 'campaign.sent',
  CAMPAIGN_DELIVERED = 'campaign.delivered',
  CAMPAIGN_OPENED = 'campaign.opened',
  CAMPAIGN_CLICKED = 'campaign.clicked',

  // Workflow events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',

  // Sequence events
  SEQUENCE_STEP_COMPLETED = 'sequence.step.completed',
  SEQUENCE_COMPLETED = 'sequence.completed',

  // Template events
  TEMPLATE_USED = 'template.used',
}

/**
 * Analytics Entity Types
 */
export enum AnalyticsEntityType {
  CONTACT = 'contact',
  INBOX_MESSAGE = 'inbox_message',
  INBOX_THREAD = 'inbox_thread',
  CAMPAIGN = 'campaign',
  WORKFLOW = 'workflow',
  WORKFLOW_RUN = 'workflow_run',
  SEQUENCE = 'sequence',
  SEQUENCE_RUN = 'sequence_run',
  TEMPLATE = 'template',
}

/**
 * Analytics Channel Types
 */
export enum AnalyticsChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  INTERNAL = 'internal',
  UNKNOWN = 'unknown',
}

/**
 * Analytics Event Metadata Interface
 */
export interface AnalyticsEventMetadata {
  contactId?: string;
  campaignId?: string;
  workflowId?: string;
  workflowRunId?: string;
  sequenceId?: string;
  sequenceRunId?: string;
  templateId?: string;
  threadId?: string;
  messageId?: string;
  stepId?: string;
  stepIndex?: number;
  direction?: string;
  status?: string;
  errorMessage?: string;
  userId?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Analytics Event Record
 */
export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  timestamp: Date;
  eventType: AnalyticsEventType | string;
  entityType: AnalyticsEntityType | string;
  entityId: string;
  channel: AnalyticsChannel | string;
  metadata: AnalyticsEventMetadata;
}

/**
 * ClickHouse CREATE TABLE statement for analytics_events
 */
export const ANALYTICS_EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID,
  tenant_id String,
  timestamp DateTime64(3),
  event_type LowCardinality(String),
  entity_type LowCardinality(String),
  entity_id String,
  channel LowCardinality(String),
  metadata String
)
ENGINE = MergeTree()
PARTITION BY toDate(timestamp)
ORDER BY (tenant_id, timestamp, event_type)
TTL timestamp + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;
`;

/**
 * ClickHouse INSERT statement for analytics_events
 */
export const ANALYTICS_EVENTS_INSERT_SQL = `
INSERT INTO analytics_events (id, tenant_id, timestamp, event_type, entity_type, entity_id, channel, metadata)
VALUES ({id:UUID}, {tenant_id:String}, {timestamp:DateTime64(3)}, {event_type:String}, {entity_type:String}, {entity_id:String}, {channel:String}, {metadata:String})
`;

/**
 * Aggregated count result
 */
export interface AggregatedCount {
  key: string;
  count: number;
}

/**
 * Time-bucketed count result
 */
export interface TimeBucketCount {
  bucket: string;
  count: number;
}

/**
 * Time-bucketed count with dimension
 */
export interface TimeBucketDimensionCount {
  bucket: string;
  dimension: string;
  count: number;
}
