import { Module, Logger, OnModuleInit } from '@nestjs/common';

// DEBUG: Log when this file is loaded
console.log('=== DEV MODULE FILE LOADED ===');

// Guards
import { DevOnlyGuard } from './guards/dev-only.guard';

// Generators
import { ContactGenerator } from './generators/contact.generator';
import { SegmentGenerator } from './generators/segment.generator';
import { CampaignGenerator } from './generators/campaign.generator';
import { TemplateGenerator } from './generators/template.generator';
import { SequenceGenerator } from './generators/sequence.generator';

// Scenarios
import { CampaignBasicScenario } from './scenarios/campaign-basic.scenario';
import { InboxFlowScenario } from './scenarios/inbox-flow.scenario';
import { WorkflowTriggerScenario } from './scenarios/workflow-trigger.scenario';
import { CampaignExecutionScenario } from './scenarios/campaign-execution.scenario';
import { SequenceEnrollmentScenario } from './scenarios/sequence-enrollment.scenario';
import { PartialFailureScenario } from './scenarios/partial-failure.scenario';

// Reset
import { ResetService } from './reset/reset.service';

// Queue Monitor
import { QueueMonitorService } from './services/queue-monitor.service';
import { DevLogsService } from './services/dev-logs.service';
import { DemoSeedService } from './services/demo-seed.service';
import { QueueController } from './controllers/queue.controller';

// Main service & controller
import { DevService } from './dev.service';
import { DevController } from './dev.controller';

// Feature modules we depend on
import { ContactsModule } from '../modules/contacts/contacts.module';
import { SegmentsModule } from '../modules/segments/segments.module';
import { CampaignsModule } from '../modules/campaigns/campaigns.module';
import { InboxModule } from '../modules/inbox/inbox.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';
import { TemplatesModule } from '../modules/templates/templates.module';
import { SequencesModule } from '../modules/sequences/sequences.module';
import { QueueModule } from '../modules/queue/queue.module';
import { PipelineModule } from '../modules/pipeline/pipeline.module';

/**
 * DevModule - Development Playground for testing and debugging
 * 
 * This module provides:
 * - Data generators for contacts, segments, campaigns
 * - Scenario runners for end-to-end flow testing
 * - Reset utilities for cleaning up test data
 * 
 * SAFETY:
 * - All routes are protected by DevOnlyGuard
 * - Disabled in production (NODE_ENV === 'production')
 * - Requires DEV_PLAYGROUND_ENABLED=true in non-dev environments
 */
@Module({
  imports: [
    // Import feature modules to access their services
    ContactsModule,
    SegmentsModule,
    CampaignsModule,
    InboxModule,
    WorkflowsModule,
    TemplatesModule,
    SequencesModule,
    QueueModule,
    PipelineModule,
  ],
  controllers: [DevController, QueueController],
  providers: [
    // Guard
    DevOnlyGuard,
    
    // Generators
    ContactGenerator,
    SegmentGenerator,
    CampaignGenerator,
    TemplateGenerator,
    SequenceGenerator,
    
    // Scenarios
    CampaignBasicScenario,
    InboxFlowScenario,
    WorkflowTriggerScenario,
    CampaignExecutionScenario,
    SequenceEnrollmentScenario,
    PartialFailureScenario,
    
    // Reset
    ResetService,
    
    // Queue Monitor
    QueueMonitorService,
    
    // Logs
    DevLogsService,
    
    // Demo Seed
    DemoSeedService,
    
    // Main service
    DevService,
  ],
  exports: [DevService],
})
export class DevModule implements OnModuleInit {
  private readonly logger = new Logger(DevModule.name);

  onModuleInit() {
    // Log startup status
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('⚠️  DevModule loaded in PRODUCTION - all routes will be blocked');
    } else {
      this.logger.log('✅ Dev Playground module initialized');
      this.logger.log('📚 API available at /api/dev/*');
      this.logger.log('🔒 Protected by DevOnlyGuard');
    }
  }
}
