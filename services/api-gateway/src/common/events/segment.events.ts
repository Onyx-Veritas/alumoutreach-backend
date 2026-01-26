import { BaseEvent } from './contact.events';

// ============ Segment Event Types ============

export enum SegmentEventType {
  SEGMENT_CREATED = 'segment.created',
  SEGMENT_UPDATED = 'segment.updated',
  SEGMENT_DELETED = 'segment.deleted',
  SEGMENT_MEMBERSHIP_UPDATED = 'segment.membership.updated',
  SEGMENT_REFRESHED = 'segment.refreshed',
  SEGMENT_MEMBER_ADDED = 'segment.member.added',
  SEGMENT_MEMBER_REMOVED = 'segment.member.removed',
}

// ============ Segment Event Payloads ============

export interface SegmentCreatedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_CREATED;
  payload: {
    segmentId: string;
    name: string;
    type: string;
    ruleCount: number;
    createdBy?: string;
  };
}

export interface SegmentUpdatedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_UPDATED;
  payload: {
    segmentId: string;
    name: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy?: string;
  };
}

export interface SegmentDeletedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_DELETED;
  payload: {
    segmentId: string;
    name: string;
    memberCount: number;
    deletedBy?: string;
    hardDelete: boolean;
  };
}

export interface SegmentMembershipUpdatedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_MEMBERSHIP_UPDATED;
  payload: {
    segmentId: string;
    name: string;
    addedCount: number;
    removedCount: number;
    totalCount: number;
    batchId: string;
  };
}

export interface SegmentRefreshedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_REFRESHED;
  payload: {
    segmentId: string;
    name: string;
    previousCount: number;
    newCount: number;
    addedCount: number;
    removedCount: number;
    durationMs: number;
    batchId: string;
  };
}

export interface SegmentMemberAddedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_MEMBER_ADDED;
  payload: {
    segmentId: string;
    contactId: string;
    source: string;
    addedBy?: string;
  };
}

export interface SegmentMemberRemovedEvent extends BaseEvent {
  eventType: SegmentEventType.SEGMENT_MEMBER_REMOVED;
  payload: {
    segmentId: string;
    contactId: string;
    removedBy?: string;
  };
}

// Union type
export type SegmentEvent =
  | SegmentCreatedEvent
  | SegmentUpdatedEvent
  | SegmentDeletedEvent
  | SegmentMembershipUpdatedEvent
  | SegmentRefreshedEvent
  | SegmentMemberAddedEvent
  | SegmentMemberRemovedEvent;
