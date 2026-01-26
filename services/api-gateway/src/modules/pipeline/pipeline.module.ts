import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { PipelineJob, PipelineFailure } from './entities';

// Repository
import { PipelineRepository } from './repositories/pipeline.repository';

// Services
import {
  PipelineProducerService,
  PipelineWorkerService,
  PipelineRetryService,
  PipelineStatusService,
} from './services';

// Controller
import { PipelineController } from './controllers/pipeline.controller';

// Common services
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PipelineJob, PipelineFailure]),
  ],
  controllers: [PipelineController],
  providers: [
    // Event Bus
    EventBusService,

    // Repository
    PipelineRepository,

    // Services
    PipelineProducerService,
    PipelineWorkerService,
    PipelineRetryService,
    PipelineStatusService,
  ],
  exports: [
    // Export producer for use by CampaignDispatchService
    PipelineProducerService,
    PipelineStatusService,
    PipelineRepository,
  ],
})
export class PipelineModule {}
