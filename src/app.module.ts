import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContactsModule } from './modules/contacts/contacts.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { SequencesModule } from './modules/sequences/sequences.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    HealthModule,
    ContactsModule,
    TemplatesModule,
    SegmentsModule,
    CampaignsModule,
    WorkflowsModule,
    SequencesModule,
    InboxModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
