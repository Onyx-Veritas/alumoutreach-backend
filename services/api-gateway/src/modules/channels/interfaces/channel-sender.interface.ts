import { PipelineChannel } from '../../pipeline/entities';
import { SendResult } from '../../campaigns/services/senders';

/**
 * Rendered content ready for sending
 * Contains channel-agnostic fields - adapters pick what they need
 */
export interface RenderedContent {
  // Email fields
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  preheader?: string;
  fromName?: string;
  replyTo?: string;

  // WhatsApp fields
  templateName?: string;
  templateNamespace?: string;
  languageCode?: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      value: unknown;
    }>;
  }>;

  // Push fields
  title?: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, unknown>;
}

/**
 * Recipient information for sending
 */
export interface ChannelRecipient {
  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Push notification device token */
  deviceToken?: string;

  /** Recipient display name */
  name?: string;
}

/**
 * Metadata passed to sender for tracking
 */
export interface SendMetadata {
  /** Tenant ID */
  tenantId: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Contact ID */
  contactId: string;

  /** Campaign ID */
  campaignId: string;

  /** Pipeline job ID */
  jobId: string;
}

/**
 * Result of recipient validation
 */
export interface ValidationResult {
  /** Whether recipient is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * Unified interface for channel senders
 * Adapters wrap existing senders to conform to this contract
 */
export interface IChannelSenderAdapter {
  /** The channel this adapter handles */
  readonly channel: PipelineChannel;

  /**
   * Send a message to recipient
   * @param recipient - Recipient information
   * @param content - Rendered content
   * @param metadata - Tracking metadata
   * @returns Send result from underlying provider
   */
  send(
    recipient: ChannelRecipient,
    content: RenderedContent,
    metadata: SendMetadata,
  ): Promise<SendResult>;

  /**
   * Validate that recipient has required data for this channel
   * @param recipient - Recipient to validate
   * @returns Validation result
   */
  validateRecipient(recipient: ChannelRecipient): ValidationResult;
}

/**
 * Injection token for channel sender registry
 */
export const CHANNEL_SENDER_REGISTRY = Symbol('CHANNEL_SENDER_REGISTRY');
