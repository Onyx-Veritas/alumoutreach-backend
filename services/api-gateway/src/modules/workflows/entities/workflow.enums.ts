// ============ Workflow Enums ============

export enum WorkflowTriggerType {
  INCOMING_MESSAGE = 'incoming_message',
  EVENT_BASED = 'event_based',
  TIME_BASED = 'time_based',
}

export enum WorkflowRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum WorkflowNodeType {
  START = 'start',
  SEND_MESSAGE = 'send_message',
  CONDITION = 'condition',
  DELAY = 'delay',
  UPDATE_ATTRIBUTE = 'update_attribute',
  ASSIGN_AGENT = 'assign_agent',
  END = 'end',
}

export enum WorkflowNodeRunStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum DelayUnit {
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
}

export enum TriggerEventType {
  // Message events
  MESSAGE_RECEIVED = 'message.received',
  MESSAGE_SENT = 'message.sent',
  
  // Contact events
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_TAG_ADDED = 'contact.tag.added',
  CONTACT_TAG_REMOVED = 'contact.tag.removed',
  CONTACT_CONSENT_UPDATED = 'contact.consent.updated',
  
  // Campaign events
  CAMPAIGN_SENT = 'campaign.sent',
  CAMPAIGN_OPENED = 'campaign.opened',
  CAMPAIGN_CLICKED = 'campaign.clicked',
}

export enum MessageChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}
