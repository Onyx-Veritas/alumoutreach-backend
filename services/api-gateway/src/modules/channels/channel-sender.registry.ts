import { Injectable } from '@nestjs/common';
import { PipelineChannel } from '../pipeline/entities';
import { IChannelSenderAdapter } from './interfaces';
import { ChannelNotSupportedError } from '../queue/errors';
import {
  EmailSenderAdapter,
  SmsSenderAdapter,
  WhatsAppSenderAdapter,
  PushSenderAdapter,
} from './adapters';

/**
 * Registry for channel sender adapters
 * Provides factory method to get the correct adapter for a channel
 */
@Injectable()
export class ChannelSenderRegistry {
  private readonly adapters = new Map<PipelineChannel, IChannelSenderAdapter>();

  constructor(
    private readonly emailAdapter: EmailSenderAdapter,
    private readonly smsAdapter: SmsSenderAdapter,
    private readonly whatsAppAdapter: WhatsAppSenderAdapter,
    private readonly pushAdapter: PushSenderAdapter,
  ) {
    this.register(this.emailAdapter);
    this.register(this.smsAdapter);
    this.register(this.whatsAppAdapter);
    this.register(this.pushAdapter);
  }

  /**
   * Register an adapter
   */
  private register(adapter: IChannelSenderAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  /**
   * Get sender adapter for a channel
   * @throws ChannelNotSupportedError if channel not found
   */
  getSender(channel: PipelineChannel): IChannelSenderAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new ChannelNotSupportedError(channel);
    }
    return adapter;
  }

  /**
   * Check if a channel is supported
   */
  hasChannel(channel: PipelineChannel): boolean {
    return this.adapters.has(channel);
  }

  /**
   * Get list of supported channels
   */
  getSupportedChannels(): PipelineChannel[] {
    return Array.from(this.adapters.keys());
  }
}
