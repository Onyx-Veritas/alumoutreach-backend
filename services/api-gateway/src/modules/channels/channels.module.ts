import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ContactsModule } from '../contacts/contacts.module';
import {
  EmailSenderAdapter,
  SmsSenderAdapter,
  WhatsAppSenderAdapter,
  PushSenderAdapter,
} from './adapters';
import { ChannelSenderRegistry } from './channel-sender.registry';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookProcessorService } from './services/webhook-processor.service';

/**
 * Channels Module
 *
 * Provides unified channel sender abstraction via adapters,
 * and webhook receivers for delivery event processing.
 *
 * Usage:
 * ```typescript
 * const sender = channelRegistry.getSender(PipelineChannel.EMAIL);
 * const result = await sender.send(recipient, content, metadata);
 * ```
 */
@Module({
  imports: [
    CampaignsModule,
    PipelineModule,
    ContactsModule,
  ],
  controllers: [
    WebhookController,
  ],
  providers: [
    // Adapters
    EmailSenderAdapter,
    SmsSenderAdapter,
    WhatsAppSenderAdapter,
    PushSenderAdapter,

    // Registry
    ChannelSenderRegistry,

    // Webhook processing
    WebhookProcessorService,
  ],
  exports: [
    ChannelSenderRegistry,
  ],
})
export class ChannelsModule {}
