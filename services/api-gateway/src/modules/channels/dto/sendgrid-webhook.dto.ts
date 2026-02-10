import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SendGrid Event Webhook payload
 * Reference: https://docs.sendgrid.com/for-developers/tracking-events/event
 *
 * SendGrid posts an array of event objects.
 * Each event has at minimum: email, timestamp, event, sg_message_id
 */
export interface SendGridWebhookEvent {
  /** Recipient email address */
  email: string;

  /** Unix timestamp of the event */
  timestamp: number;

  /** Event type */
  event:
    | 'processed'
    | 'dropped'
    | 'delivered'
    | 'deferred'
    | 'bounce'
    | 'open'
    | 'click'
    | 'spamreport'
    | 'unsubscribe'
    | 'group_unsubscribe'
    | 'group_resubscribe';

  /** SendGrid message ID (matches x-message-id from send response) */
  sg_message_id: string;

  /** SendGrid event ID (unique per event) */
  sg_event_id?: string;

  /** Reason for bounce/drop */
  reason?: string;

  /** Bounce type: bounce or blocked */
  type?: string;

  /** SMTP status code (e.g. "550 5.1.1") */
  status?: string;

  /** URL clicked (for click events) */
  url?: string;

  /** User agent (for open/click events) */
  useragent?: string;

  /** IP address (for open/click events) */
  ip?: string;

  /** Custom args passed during send (our metadata) */
  correlationId?: string;
  contactId?: string;
  campaignId?: string;
  jobId?: string;
  tenantId?: string;

  /** SendGrid categories */
  category?: string[];

  /** Attempt number for deferred events */
  attempt?: string;
}
