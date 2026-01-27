import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { InboxThread } from './entities/inbox-thread.entity';
import { InboxMessage } from './entities/inbox-message.entity';
import { InboxActivity } from './entities/inbox-activity.entity';

// Repositories
import { InboxThreadRepository } from './repositories/inbox-thread.repository';
import { InboxMessageRepository } from './repositories/inbox-message.repository';
import { InboxActivityRepository } from './repositories/inbox-activity.repository';

// Services
import { InboxService } from './services/inbox.service';
import { InboxMessageService } from './services/inbox-message.service';
import { InboxDistributionService } from './services/inbox-distribution.service';
import { InboxAgentService } from './services/inbox-agent.service';
import { InboxIngestionService } from './services/inbox-ingestion.service';

// Controllers
import { InboxController } from './controllers/inbox.controller';

// Mappers & Validators
import { InboxMapper } from './mappers/inbox.mapper';
import { InboxValidators } from './validators/inbox.validators';

// Common
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InboxThread,
      InboxMessage,
      InboxActivity,
    ]),
  ],
  controllers: [InboxController],
  providers: [
    // Repositories
    InboxThreadRepository,
    InboxMessageRepository,
    InboxActivityRepository,

    // Services
    InboxService,
    InboxMessageService,
    InboxDistributionService,
    InboxAgentService,
    InboxIngestionService,

    // Mappers & Validators
    InboxMapper,
    InboxValidators,

    // Common
    AppLoggerService,
    EventBusService,
  ],
  exports: [
    InboxService,
    InboxMessageService,
    InboxDistributionService,
    InboxAgentService,
    InboxIngestionService,
    InboxThreadRepository,
    InboxMessageRepository,
    InboxActivityRepository,
  ],
})
export class InboxModule {}
