import { CampaignChannel, CampaignStatus, CampaignRunStatus, DispatchStatus } from '../entities/campaign.enums';

// ============ Campaign Event Types ============

export enum CampaignEventType {
  // Campaign lifecycle events
  CAMPAIGN_CREATED = 'campaign.created',
  CAMPAIGN_UPDATED = 'campaign.updated',
  CAMPAIGN_DELETED = 'campaign.deleted',
  CAMPAIGN_SCHEDULED = 'campaign.scheduled',
  CAMPAIGN_CANCELLED = 'campaign.cancelled',

  // Campaign run events
  CAMPAIGN_RUN_STARTED = 'campaign.run.started',
  CAMPAIGN_RUN_COMPLETED = 'campaign.run.completed',
  CAMPAIGN_RUN_FAILED = 'campaign.run.failed',

  // Message events
  CAMPAIGN_MESSAGE_SENT = 'campaign.message.sent',
  CAMPAIGN_MESSAGE_FAILED = 'campaign.message.failed',
  CAMPAIGN_MESSAGE_DELIVERED = 'campaign.message.delivered',
  CAMPAIGN_MESSAGE_OPENED = 'campaign.message.opened',
  CAMPAIGN_MESSAGE_CLICKED = 'campaign.message.clicked',
  CAMPAIGN_MESSAGE_BOUNCED = 'campaign.message.bounced',
}

// ============ Base Event Interface ============

export interface BaseCampaignEvent {
  eventId: string;
  eventType: CampaignEventType;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  version: string;
  source: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

// ============ Campaign Lifecycle Events ============

export interface CampaignCreatedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_CREATED;
  payload: {
    campaignId: string;
    name: string;
    channel: CampaignChannel;
    segmentId?: string;
    templateVersionId?: string;
    createdBy: string;
  };
}

export interface CampaignUpdatedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_UPDATED;
  payload: {
    campaignId: string;
    name: string;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy: string;
  };
}

export interface CampaignDeletedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_DELETED;
  payload: {
    campaignId: string;
    name: string;
    deletedBy: string;
    hardDelete: boolean;
  };
}

export interface CampaignScheduledEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_SCHEDULED;
  payload: {
    campaignId: string;
    name: string;
    channel: CampaignChannel;
    scheduleAt: string;
    audienceCount: number;
    scheduledBy: string;
  };
}

export interface CampaignCancelledEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_CANCELLED;
  payload: {
    campaignId: string;
    name: string;
    previousStatus: CampaignStatus;
    cancelledBy: string;
    reason?: string;
  };
}

// ============ Campaign Run Events ============

export interface CampaignRunStartedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_RUN_STARTED;
  payload: {
    campaignId: string;
    runId: string;
    totalRecipients: number;
    channel: CampaignChannel;
  };
}

export interface CampaignRunCompletedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_RUN_COMPLETED;
  payload: {
    campaignId: string;
    runId: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    durationMs: number;
  };
}

export interface CampaignRunFailedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_RUN_FAILED;
  payload: {
    campaignId: string;
    runId: string;
    error: string;
    processedCount: number;
    failedCount: number;
  };
}

// ============ Message Events ============

export interface CampaignMessageSentEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_SENT;
  payload: {
    campaignId: string;
    runId?: string;
    messageId: string;
    contactId: string;
    channel: CampaignChannel;
    providerMessageId: string;
  };
}

export interface CampaignMessageFailedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_FAILED;
  payload: {
    campaignId: string;
    runId?: string;
    messageId: string;
    contactId: string;
    channel: CampaignChannel;
    error: string;
  };
}

export interface CampaignMessageDeliveredEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_DELIVERED;
  payload: {
    campaignId: string;
    messageId: string;
    contactId: string;
    providerMessageId: string;
    deliveredAt: string;
  };
}

export interface CampaignMessageOpenedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_OPENED;
  payload: {
    campaignId: string;
    messageId: string;
    contactId: string;
    openedAt: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface CampaignMessageClickedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_CLICKED;
  payload: {
    campaignId: string;
    messageId: string;
    contactId: string;
    clickedAt: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface CampaignMessageBouncedEvent extends BaseCampaignEvent {
  eventType: CampaignEventType.CAMPAIGN_MESSAGE_BOUNCED;
  payload: {
    campaignId: string;
    messageId: string;
    contactId: string;
    providerMessageId?: string;
    bounceType: 'hard' | 'soft';
    bounceReason: string;
    bouncedAt: string;
  };
}

// ============ Union Type ============

export type CampaignEvent =
  | CampaignCreatedEvent
  | CampaignUpdatedEvent
  | CampaignDeletedEvent
  | CampaignScheduledEvent
  | CampaignCancelledEvent
  | CampaignRunStartedEvent
  | CampaignRunCompletedEvent
  | CampaignRunFailedEvent
  | CampaignMessageSentEvent
  | CampaignMessageFailedEvent
  | CampaignMessageDeliveredEvent
  | CampaignMessageOpenedEvent
  | CampaignMessageClickedEvent
  | CampaignMessageBouncedEvent;

// ============ NATS Subject Constants ============

export const CAMPAIGN_SUBJECT_PREFIX = 'alumoutreach.campaigns';

export const CampaignSubjects = {
  CREATED: `${CAMPAIGN_SUBJECT_PREFIX}.created`,
  UPDATED: `${CAMPAIGN_SUBJECT_PREFIX}.updated`,
  DELETED: `${CAMPAIGN_SUBJECT_PREFIX}.deleted`,
  SCHEDULED: `${CAMPAIGN_SUBJECT_PREFIX}.scheduled`,
  CANCELLED: `${CAMPAIGN_SUBJECT_PREFIX}.cancelled`,
  RUN_STARTED: `${CAMPAIGN_SUBJECT_PREFIX}.run.started`,
  RUN_COMPLETED: `${CAMPAIGN_SUBJECT_PREFIX}.run.completed`,
  RUN_FAILED: `${CAMPAIGN_SUBJECT_PREFIX}.run.failed`,
  MESSAGE_SENT: `${CAMPAIGN_SUBJECT_PREFIX}.message.sent`,
  MESSAGE_FAILED: `${CAMPAIGN_SUBJECT_PREFIX}.message.failed`,
  MESSAGE_DELIVERED: `${CAMPAIGN_SUBJECT_PREFIX}.message.delivered`,
  MESSAGE_OPENED: `${CAMPAIGN_SUBJECT_PREFIX}.message.opened`,
  MESSAGE_CLICKED: `${CAMPAIGN_SUBJECT_PREFIX}.message.clicked`,
  MESSAGE_BOUNCED: `${CAMPAIGN_SUBJECT_PREFIX}.message.bounced`,
} as const;
