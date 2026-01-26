import { BaseEvent } from './contact.events';

// ============ Template Event Types ============

export enum TemplateEventType {
  TEMPLATE_CREATED = 'template.created',
  TEMPLATE_UPDATED = 'template.updated',
  TEMPLATE_DELETED = 'template.deleted',
  TEMPLATE_VERSION_CREATED = 'template.version.created',
  TEMPLATE_APPROVED = 'template.approved',
  TEMPLATE_REJECTED = 'template.rejected',
  TEMPLATE_RENDERED = 'template.rendered',
}

// ============ Template Event Payloads ============

export interface TemplateCreatedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_CREATED;
  payload: {
    templateId: string;
    name: string;
    channel: string;
    category: string;
    versionId: string;
    createdBy?: string;
  };
}

export interface TemplateUpdatedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_UPDATED;
  payload: {
    templateId: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy?: string;
  };
}

export interface TemplateDeletedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_DELETED;
  payload: {
    templateId: string;
    name: string;
    deletedBy?: string;
    hardDelete: boolean;
  };
}

export interface TemplateVersionCreatedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_VERSION_CREATED;
  payload: {
    templateId: string;
    versionId: string;
    versionNumber: number;
    changelog?: string;
    createdBy?: string;
  };
}

export interface TemplateApprovedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_APPROVED;
  payload: {
    templateId: string;
    name: string;
    approvedBy: string;
    notes?: string;
  };
}

export interface TemplateRejectedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_REJECTED;
  payload: {
    templateId: string;
    name: string;
    rejectedBy: string;
    reason: string;
  };
}

export interface TemplateRenderedEvent extends BaseEvent {
  eventType: TemplateEventType.TEMPLATE_RENDERED;
  payload: {
    templateId: string;
    versionId: string;
    channel: string;
    renderTimeMs: number;
    variablesUsed: number;
    missingVariables: number;
  };
}

// Union type
export type TemplateEvent =
  | TemplateCreatedEvent
  | TemplateUpdatedEvent
  | TemplateDeletedEvent
  | TemplateVersionCreatedEvent
  | TemplateApprovedEvent
  | TemplateRejectedEvent
  | TemplateRenderedEvent;
