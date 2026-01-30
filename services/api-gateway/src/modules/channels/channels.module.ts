import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import {
  EmailSenderAdapter,
  SmsSenderAdapter,
  WhatsAppSenderAdapter,
  PushSenderAdapter,
} from './adapters';
import { ChannelSenderRegistry } from './channel-sender.registry';

/**
 * Channels Module
 * 
 * Provides unified channel sender abstraction via adapters.
 * Wraps existing sender services from CampaignsModule.
 * 
 * Usage:
 * ```typescript
 * const sender = channelRegistry.getSender(PipelineChannel.EMAIL);
 * const result = await sender.send(recipient, content, metadata);
 * ```
 */
@Module({
  imports: [
    // Import CampaignsModule to access existing sender services
    CampaignsModule,
  ],
  providers: [
    // Adapters
    EmailSenderAdapter,
    SmsSenderAdapter,
    WhatsAppSenderAdapter,
    PushSenderAdapter,

    // Registry
    ChannelSenderRegistry,
  ],
  exports: [
    ChannelSenderRegistry,
  ],
})
export class ChannelsModule {}
