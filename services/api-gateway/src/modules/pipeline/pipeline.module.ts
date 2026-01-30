import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Entities
import { PipelineJob, PipelineFailure } from './entities';
import { CampaignRun } from '../campaigns/entities/campaign-run.entity';

// Repository
import { PipelineRepository } from './repositories/pipeline.repository';

// Services
import {
  PipelineProducerService,
  PipelineWorkerService,
  PipelineRetryService,
  PipelineStatusService,
  CampaignStatsService,
} from './services';

// Controller
import { PipelineController } from './controllers/pipeline.controller';

// Common services
import { EventBusService } from '../../common/services/event-bus.service';

// Queue
import { QUEUE_NAMES } from '../queue/queue.constants';
import { QueueConfigService } from '../queue/services';

@Module({
  imports: [
    TypeOrmModule.forFeature([PipelineJob, PipelineFailure, CampaignRun]),
    // Register queue for producer (will use global BullMQ config from QueueModule)
    BullModule.registerQueue({
      name: QUEUE_NAMES.PIPELINE_JOBS,
    }),
  ],
  controllers: [PipelineController],
  providers: [
    // Event Bus
    EventBusService,

    // Repository
    PipelineRepository,

    // Queue Config
    QueueConfigService,

    // Services
    PipelineProducerService,
    PipelineWorkerService,
    PipelineRetryService,
    PipelineStatusService,
    
    // Stats Service
    CampaignStatsService,
  ],
  exports: [
    // Export producer for use by CampaignDispatchService
    PipelineProducerService,
    PipelineStatusService,
    PipelineRepository,
    CampaignStatsService,
  ],
})
export class PipelineModule {}
