// Event Types for Contact 360° Module
export enum ContactEventType {
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_DELETED = 'contact.deleted',
  CONTACT_MERGED = 'contact.merged',
  CONTACT_ATTRIBUTE_UPDATED = 'contact.attribute.updated',
  CONTACT_CONSENT_UPDATED = 'contact.consent.updated',
  CONTACT_TAG_ADDED = 'contact.tag.added',
  CONTACT_TAG_REMOVED = 'contact.tag.removed',
  CONTACT_IMPORTED = 'contact.imported',
  CONTACT_EXPORTED = 'contact.exported',
}

// Base Event Interface
export interface BaseEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  version: string;
  source: string;
}

// Contact Event Payloads
export interface ContactCreatedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_CREATED;
  payload: {
    contactId: string;
    fullName: string;
    email?: string;
    phone?: string;
    createdBy?: string;
  };
}

export interface ContactUpdatedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_UPDATED;
  payload: {
    contactId: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy?: string;
  };
}

export interface ContactDeletedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_DELETED;
  payload: {
    contactId: string;
    deletedBy?: string;
    hardDelete: boolean;
  };
}

export interface ContactAttributeUpdatedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_ATTRIBUTE_UPDATED;
  payload: {
    contactId: string;
    key: string;
    value: string;
    previousValue?: string;
    updatedBy?: string;
  };
}

export interface ContactConsentUpdatedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_CONSENT_UPDATED;
  payload: {
    contactId: string;
    channel: string;
    status: string;
    previousStatus?: string;
    source: string;
    updatedBy?: string;
  };
}

export interface ContactTagAddedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_TAG_ADDED;
  payload: {
    contactId: string;
    tagId: string;
    tagName: string;
    addedBy?: string;
  };
}

export interface ContactTagRemovedEvent extends BaseEvent {
  eventType: ContactEventType.CONTACT_TAG_REMOVED;
  payload: {
    contactId: string;
    tagId: string;
    tagName: string;
    removedBy?: string;
  };
}

// Union type for all contact events
export type ContactEvent =
  | ContactCreatedEvent
  | ContactUpdatedEvent
  | ContactDeletedEvent
  | ContactAttributeUpdatedEvent
  | ContactConsentUpdatedEvent
  | ContactTagAddedEvent
  | ContactTagRemovedEvent;
