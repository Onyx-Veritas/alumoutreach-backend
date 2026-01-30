import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS, REDIS_DEFAULTS } from './queue.constants';
import { QueueConfigService } from './services';
import { MessageProcessor } from './processors';
import { ContactsModule } from '../contacts/contacts.module';
import { TemplatesModule } from '../templates/templates.module';
import { ChannelsModule } from '../channels/channels.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { EventBusService } from '../../common/services/event-bus.service';

/**
 * Queue Module
 * 
 * Provides BullMQ-based job queue infrastructure.
 * Marked as Global so queue can be injected anywhere without importing.
 * 
 * Responsibilities:
 * - Redis connection management
 * - Queue registration and configuration
 * - Per-tenant rate limiting configuration
 * - Message processing via BullMQ workers
 */
@Global()
@Module({
  imports: [
    // Configure BullMQ with Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', REDIS_DEFAULTS.host),
          port: configService.get<number>('REDIS_PORT', REDIS_DEFAULTS.port),
          password: configService.get('REDIS_PASSWORD'),
          maxRetriesPerRequest: REDIS_DEFAULTS.maxRetriesPerRequest,
        },
      }),
      inject: [ConfigService],
    }),

    // Register the pipeline jobs queue
    BullModule.registerQueue({
      name: QUEUE_NAMES.PIPELINE_JOBS,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),

    // Required modules for message processing
    ContactsModule,
    TemplatesModule,
    ChannelsModule,
    PipelineModule,
  ],
  providers: [
    QueueConfigService,
    MessageProcessor,
    EventBusService,
  ],
  exports: [
    BullModule,
    QueueConfigService,
  ],
})
export class QueueModule {}
