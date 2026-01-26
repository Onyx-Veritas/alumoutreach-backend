// Contact Events
export const CONTACT_EVENTS = {
  CREATED: 'contact.created',
  UPDATED: 'contact.updated',
  DELETED: 'contact.deleted',
  MERGED: 'contact.merged',
  TAG_ADDED: 'contact.tag.added',
  TAG_REMOVED: 'contact.tag.removed',
  SEGMENT_JOINED: 'contact.segment.joined',
  SEGMENT_LEFT: 'contact.segment.left',
} as const;

// Message Events
export const MESSAGE_EVENTS = {
  SENT: 'message.sent',
  DELIVERED: 'message.delivered',
  READ: 'message.read',
  FAILED: 'message.failed',
  BOUNCED: 'message.bounced',
  CLICKED: 'message.clicked',
  UNSUBSCRIBED: 'message.unsubscribed',
  RECEIVED: 'message.received',
} as const;

// Campaign Events
export const CAMPAIGN_EVENTS = {
  CREATED: 'campaign.created',
  STARTED: 'campaign.started',
  PAUSED: 'campaign.paused',
  RESUMED: 'campaign.resumed',
  COMPLETED: 'campaign.completed',
  FAILED: 'campaign.failed',
} as const;

// Workflow Events
export const WORKFLOW_EVENTS = {
  STARTED: 'workflow.started',
  NODE_EXECUTED: 'workflow.node.executed',
  NODE_FAILED: 'workflow.node.failed',
  COMPLETED: 'workflow.completed',
  FAILED: 'workflow.failed',
} as const;

// Sequence Events
export const SEQUENCE_EVENTS = {
  ENROLLED: 'sequence.enrolled',
  STEP_EXECUTED: 'sequence.step.executed',
  STEP_FAILED: 'sequence.step.failed',
  COMPLETED: 'sequence.completed',
  EXITED: 'sequence.exited',
} as const;

// Conversation Events
export const CONVERSATION_EVENTS = {
  CREATED: 'conversation.created',
  ASSIGNED: 'conversation.assigned',
  RESOLVED: 'conversation.resolved',
  ESCALATED: 'conversation.escalated',
  MESSAGE_RECEIVED: 'conversation.message.received',
  MESSAGE_SENT: 'conversation.message.sent',
} as const;

export const ALL_EVENTS = {
  ...CONTACT_EVENTS,
  ...MESSAGE_EVENTS,
  ...CAMPAIGN_EVENTS,
  ...WORKFLOW_EVENTS,
  ...SEQUENCE_EVENTS,
  ...CONVERSATION_EVENTS,
} as const;
