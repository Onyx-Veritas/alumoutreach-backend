import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { InboxMessageService } from './inbox-message.service';
import { InboxDistributionService } from './inbox-distribution.service';
import { InboxChannel, DistributionStrategy } from '../entities/inbox.enums';
import { InboundMessageDto } from '../dto/inbox.dto';
import { InboxValidators } from '../validators/inbox.validators';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface InboundMessageEvent {
  tenantId: string;
  externalMessageId: string;
  channel: InboxChannel;
  from: string; // phone number or email
  to?: string;
  content: string;
  mediaUrl?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface ContactLookupResult {
  contactId: string;
  tenantId: string;
}

export interface InboundProcessResult {
  success: boolean;
  threadId?: string;
  messageId?: string;
  threadCreated?: boolean;
  error?: string;
}

@Injectable()
export class InboxIngestionService {
  private readonly validators: InboxValidators;
  // Agent pool for auto-distribution (would typically come from settings)
  private availableAgents: Map<string, string[]> = new Map();
  // Contact lookup function (injected by dependent module)
  private contactLookupFn: ((tenantId: string, channel: InboxChannel, identifier: string) => Promise<ContactLookupResult | null>) | null = null;

  constructor(
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
    @Inject(forwardRef(() => InboxMessageService))
    private readonly messageService: InboxMessageService,
    private readonly distributionService: InboxDistributionService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('InboxIngestionService');
    this.validators = new InboxValidators();
  }

  /**
   * Register a contact lookup function
   */
  setContactLookupFn(fn: (tenantId: string, channel: InboxChannel, identifier: string) => Promise<ContactLookupResult | null>): void {
    this.contactLookupFn = fn;
  }

  /**
   * Handle inbound message from any channel
   * This method is called by external message handlers (WhatsApp, SMS, Email services)
   */
  async handleInboundMessage(event: InboundMessageEvent): Promise<InboundProcessResult> {
    const startTime = this.logger.logOperationStart('handle inbound message', {
      channel: event.channel,
      from: event.from,
      externalMessageId: event.externalMessageId,
    });

    try {
      // Validate inbound message
      const dto: InboundMessageDto = {
        tenantId: event.tenantId,
        channel: event.channel,
        senderIdentifier: event.from,
        content: event.content,
        externalMessageId: event.externalMessageId,
        mediaUrl: event.mediaUrl,
      };

      const validation = this.validators.validateInboundMessage(dto);
      if (!validation.valid) {
        this.logger.warn('Invalid inbound message', { errors: validation.errors });
        return { success: false, error: validation.errors.join(', ') };
      }

      // Check for duplicate message
      if (event.externalMessageId) {
        const isDuplicate = await this.messageService.isDuplicateMessage(
          event.tenantId,
          event.externalMessageId,
        );

        if (isDuplicate) {
          this.logger.debug('Duplicate message detected, skipping', { externalMessageId: event.externalMessageId });
          return { success: false, error: 'Duplicate message' };
        }
      }

      // Lookup contact by phone/email
      const contact = await this.lookupContact(event.tenantId, event.channel, event.from);

      if (!contact) {
        this.logger.warn('Contact not found for inbound message', {
          channel: event.channel,
          from: event.from,
        });
        return { success: false, error: 'Contact not found' };
      }

      // Find or create thread
      const { thread, created } = await this.inboxService.findOrCreateThread(
        event.tenantId,
        contact.contactId,
        event.channel,
        {
          source: `inbound_${event.channel}`,
          firstMessageAt: event.timestamp || new Date(),
        },
        event.correlationId,
      );

      // Record the message
      const message = await this.messageService.recordInboundMessage(
        event.tenantId,
        thread.id,
        contact.contactId,
        event.channel,
        event.content,
        {
          externalMessageId: event.externalMessageId,
        },
        event.correlationId,
      );

      // Auto-assign thread if configured and newly created
      if (created) {
        const agents = this.getAvailableAgentsForTenant(event.tenantId);
        if (agents.length > 0) {
          await this.distributionService.autoAssignThread(
            event.tenantId,
            thread.id,
            agents,
            DistributionStrategy.LEAST_BUSY,
            undefined,
            event.correlationId,
          );
        }
      }

      this.logger.logOperationEnd('handle inbound message', startTime, {
        threadId: thread.id,
        messageId: message.id,
        threadCreated: created,
      });

      return {
        success: true,
        threadId: thread.id,
        messageId: message.id,
        threadCreated: created,
      };
    } catch (error) {
      this.logger.error('Failed to process inbound message', (error as Error).message, {
        channel: event.channel,
        from: event.from,
      });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Lookup contact by phone or email
   */
  private async lookupContact(
    tenantId: string,
    channel: InboxChannel,
    identifier: string,
  ): Promise<ContactLookupResult | null> {
    if (this.contactLookupFn) {
      try {
        return await this.contactLookupFn(tenantId, channel, identifier);
      } catch (error) {
        this.logger.debug('Contact lookup failed', { identifier, error: (error as Error).message });
        return null;
      }
    }

    // Default: no lookup function registered
    this.logger.warn('No contact lookup function registered');
    return null;
  }

  /**
   * Set available agents for a tenant (for auto-distribution)
   */
  setAvailableAgents(tenantId: string, agentIds: string[]): void {
    this.availableAgents.set(tenantId, agentIds);
    this.logger.debug('Updated available agents', { tenantId, count: agentIds.length });
  }

  /**
   * Get available agents for a tenant
   */
  getAvailableAgentsForTenant(tenantId: string): string[] {
    return this.availableAgents.get(tenantId) || [];
  }

  /**
   * Process batch of inbound messages
   */
  async handleBatchInboundMessages(events: InboundMessageEvent[]): Promise<{ processed: number; failed: number }> {
    const startTime = this.logger.logOperationStart('handle batch inbound messages', {
      count: events.length,
    });

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      const result = await this.handleInboundMessage(event);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    this.logger.logOperationEnd('handle batch inbound messages', startTime, {
      processed,
      failed,
    });

    return { processed, failed };
  }
}
