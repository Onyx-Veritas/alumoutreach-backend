import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Campaign } from './entities/campaign.entity';
import { CampaignRun } from './entities/campaign-run.entity';
import { CampaignMessage } from './entities/campaign-message.entity';

// Controller
import { CampaignsController } from './controllers/campaigns.controller';

// Services
import { CampaignsService } from './services/campaigns.service';
import { CampaignDispatchService } from './services/campaign-dispatch.service';
import { EmailSenderService } from './services/senders/email.sender';
import { SmsSenderService } from './services/senders/sms.sender';
import { WhatsAppSenderService } from './services/senders/whatsapp.sender';
import { PushSenderService } from './services/senders/push.sender';

// Repository
import { CampaignRepository } from './repositories/campaign.repository';

// Common Services
import { EventBusService } from '../../common/services/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignRun, CampaignMessage]),
  ],
  controllers: [CampaignsController],
  providers: [
    // Core Services
    CampaignsService,
    CampaignDispatchService,
    
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
    CampaignRepository,
  ],
})
export class CampaignsModule {}
