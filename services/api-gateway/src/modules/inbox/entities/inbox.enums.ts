/**
 * Inbox Enums
 * Channel types, message directions, thread statuses, activity types
 */

export enum InboxChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  INTERNAL = 'internal',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  SYSTEM = 'system',
}

export enum ThreadStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  PENDING = 'pending',
  ESCALATED = 'escalated',
}

export enum ThreadPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ActivityType {
  ASSIGNED = 'assigned',
  STATUS_CHANGED = 'status_changed',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  NOTE_ADDED = 'note_added',
  SYSTEM_EVENT = 'system_event',
  PRIORITY_CHANGED = 'priority_changed',
  THREAD_CREATED = 'thread_created',
  THREAD_CLOSED = 'thread_closed',
  THREAD_REOPENED = 'thread_reopened',
}

export enum MessageDeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum DistributionStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_BUSY = 'least_busy',
  RANDOM = 'random',
  MANUAL = 'manual',
}
