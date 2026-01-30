import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { Campaign } from './entities/campaign.entity';
import { CampaignRun } from './entities/campaign-run.entity';
import { CampaignMessage } from './entities/campaign-message.entity';

// Controller
import { CampaignsController } from './controllers/campaigns.controller';

// Services
import { CampaignsService } from './services/campaigns.service';
import { CampaignDispatchService } from './services/campaign-dispatch.service';
import { CampaignExecutorService } from './services/campaign-executor.service';
import { CampaignSchedulerService } from './services/campaign-scheduler.service';
import { EmailSenderService } from './services/senders/email.sender';
import { SmsSenderService } from './services/senders/sms.sender';
import { WhatsAppSenderService } from './services/senders/whatsapp.sender';
import { PushSenderService } from './services/senders/push.sender';

// Repository
import { CampaignRepository } from './repositories/campaign.repository';

// Common Services
import { EventBusService } from '../../common/services/event-bus.service';

// Related Modules
import { SegmentsModule } from '../segments/segments.module';
import { ContactsModule } from '../contacts/contacts.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignRun, CampaignMessage]),
    ScheduleModule.forRoot(),
    forwardRef(() => SegmentsModule),
    forwardRef(() => ContactsModule),
    forwardRef(() => PipelineModule),
  ],
  controllers: [CampaignsController],
  providers: [
    // Core Services
    CampaignsService,
    CampaignDispatchService,
    CampaignExecutorService,
    CampaignSchedulerService,
    
    // Repository
    CampaignRepository,
    
    // Channel Senders
    EmailSenderService,
    SmsSenderService,
    WhatsAppSenderService,
    PushSenderService,
    
    // Common Services
    EventBusService,
  ],
  exports: [
    CampaignsService,
    CampaignDispatchService,
    CampaignExecutorService,
    CampaignSchedulerService,
    CampaignRepository,
    // Export senders for use by ChannelsModule adapters
    EmailSenderService,
    SmsSenderService,
    WhatsAppSenderService,
    PushSenderService,
  ],
})
export class CampaignsModule {}
