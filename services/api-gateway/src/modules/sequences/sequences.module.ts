import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Sequence } from './entities/sequence.entity';
import { SequenceStep } from './entities/sequence-step.entity';
import { SequenceRun } from './entities/sequence-run.entity';

// Repositories
import { SequenceRepository } from './repositories/sequence.repository';
import { SequenceRunRepository } from './repositories/sequence-run.repository';

// Services
import { SequencesService } from './services/sequences.service';
import { SequenceExecutorService } from './services/sequence-executor.service';
import { SequenceSchedulerService } from './services/sequence-scheduler.service';

// Controller
import { SequencesController } from './controllers/sequences.controller';

// Mappers & Validators
import { SequenceMapper } from './mappers/sequence.mapper';
import { SequenceValidators } from './validators/sequence.validators';

// Common
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sequence, SequenceStep, SequenceRun]),
  ],
  controllers: [SequencesController],
  providers: [
    // Repositories
    SequenceRepository,
    SequenceRunRepository,

    // Services
    SequencesService,
    SequenceExecutorService,
    SequenceSchedulerService,

    // Mappers & Validators
    SequenceMapper,
    SequenceValidators,

    // Common
    AppLoggerService,
    EventBusService,
  ],
  exports: [
    SequencesService,
    SequenceExecutorService,
    SequenceRunRepository,
  ],
})
export class SequencesModule {}
