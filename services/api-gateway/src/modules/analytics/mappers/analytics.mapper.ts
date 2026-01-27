import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsEntityType,
  AnalyticsChannel,
  AnalyticsEventMetadata,
} from '../entities/analytics.schema';
import { SourceEventPayload } from '../events/analytics.events';

/**
 * Analytics Mapper
 * Maps source events to normalized analytics events
 */
@Injectable()
export class AnalyticsMapper {
  /**
   * Map a source event to an analytics event
   */
  mapSourceEvent(
    eventType: string,
    payload: SourceEventPayload,
  ): AnalyticsEvent {
    const now = new Date();
    const timestamp = payload.timestamp ? new Date(payload.timestamp as string) : now;

    return {
      id: uuidv4(),
      tenantId: payload.tenantId,
      timestamp,
      eventType,
      entityType: this.inferEntityType(eventType),
      entityId: this.extractEntityId(eventType, payload),
      channel: this.extractChannel(payload),
      metadata: this.extractMetadata(eventType, payload),
    };
  }

  /**
   * Infer entity type from event type
   */
  private inferEntityType(eventType: string): AnalyticsEntityType {
    if (eventType.startsWith('contact.')) {
      return AnalyticsEntityType.CONTACT;
    }
    if (eventType.startsWith('inbox.message')) {
      return AnalyticsEntityType.INBOX_MESSAGE;
    }
    if (eventType.startsWith('inbox.thread')) {
      return AnalyticsEntityType.INBOX_THREAD;
    }
    if (eventType.startsWith('campaign.')) {
      return AnalyticsEntityType.CAMPAIGN;
    }
    if (eventType.startsWith('workflow.')) {
      return AnalyticsEntityType.WORKFLOW_RUN;
    }
    if (eventType.startsWith('sequence.')) {
      return AnalyticsEntityType.SEQUENCE_RUN;
    }
    if (eventType.startsWith('template.')) {
      return AnalyticsEntityType.TEMPLATE;
    }
    return AnalyticsEntityType.CONTACT;
  }

  /**
   * Extract entity ID from payload
   */
  private extractEntityId(eventType: string, payload: SourceEventPayload): string {
    // Try common ID fields in order of specificity
    if (eventType.startsWith('contact.')) {
      return (payload.contactId || payload.id || '') as string;
    }
    if (eventType.startsWith('inbox.message')) {
      return (payload.messageId || payload.id || '') as string;
    }
    if (eventType.startsWith('campaign.')) {
      return (payload.campaignId || payload.id || '') as string;
    }
    if (eventType.startsWith('workflow.')) {
      return (payload.workflowRunId || payload.runId || payload.workflowId || '') as string;
    }
    if (eventType.startsWith('sequence.')) {
      return (payload.sequenceRunId || payload.runId || payload.sequenceId || '') as string;
    }
    if (eventType.startsWith('template.')) {
      return (payload.templateId || payload.id || '') as string;
    }
    return (payload.id || '') as string;
  }

  /**
   * Extract channel from payload
   */
  private extractChannel(payload: SourceEventPayload): AnalyticsChannel {
    const channel = (payload.channel || '') as string;
    const normalizedChannel = channel.toLowerCase();

    switch (normalizedChannel) {
      case 'whatsapp':
        return AnalyticsChannel.WHATSAPP;
      case 'sms':
        return AnalyticsChannel.SMS;
      case 'email':
        return AnalyticsChannel.EMAIL;
      case 'push':
        return AnalyticsChannel.PUSH;
      case 'internal':
        return AnalyticsChannel.INTERNAL;
      default:
        return AnalyticsChannel.UNKNOWN;
    }
  }

  /**
   * Extract metadata from payload
   */
  private extractMetadata(
    eventType: string,
    payload: SourceEventPayload,
  ): AnalyticsEventMetadata {
    const metadata: AnalyticsEventMetadata = {};

    // Common fields
    if (payload.contactId) metadata.contactId = payload.contactId as string;
    if (payload.campaignId) metadata.campaignId = payload.campaignId as string;
    if (payload.workflowId) metadata.workflowId = payload.workflowId as string;
    if (payload.workflowRunId) metadata.workflowRunId = payload.workflowRunId as string;
    if (payload.sequenceId) metadata.sequenceId = payload.sequenceId as string;
    if (payload.sequenceRunId) metadata.sequenceRunId = payload.sequenceRunId as string;
    if (payload.templateId) metadata.templateId = payload.templateId as string;
    if (payload.threadId) metadata.threadId = payload.threadId as string;
    if (payload.messageId) metadata.messageId = payload.messageId as string;
    if (payload.userId) metadata.userId = payload.userId as string;
    if (payload.source) metadata.source = payload.source as string;

    // Event-specific fields
    if (eventType.startsWith('inbox.message')) {
      if (payload.direction) metadata.direction = payload.direction as string;
    }

    if (eventType.startsWith('sequence.step')) {
      if (payload.stepId) metadata.stepId = payload.stepId as string;
      if (payload.stepIndex !== undefined) metadata.stepIndex = payload.stepIndex as number;
    }

    if (payload.status) metadata.status = payload.status as string;
    if (payload.errorMessage) metadata.errorMessage = payload.errorMessage as string;

    return metadata;
  }

  /**
   * Convert analytics event to ClickHouse insert params
   */
  toClickHouseParams(event: AnalyticsEvent): Record<string, unknown> {
    return {
      id: event.id,
      tenant_id: event.tenantId,
      timestamp: event.timestamp,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      channel: event.channel,
      metadata: JSON.stringify(event.metadata),
    };
  }
}
