import { Injectable, Logger } from '@nestjs/common';
import { DevService } from '../dev.service';
import { DevLogsService } from './dev-logs.service';

export interface DemoPreset {
  id: string;
  name: string;
  description: string;
  config: {
    contacts?: number;
    segments?: number;
    campaigns?: number;
    templates?: number;
    sequences?: number;
    includeWorkflows?: boolean;
    includeInbox?: boolean;
  };
}

export interface SeedResult {
  preset: string;
  success: boolean;
  duration: number;
  summary: {
    contacts: number;
    segments: number;
    campaigns: number;
    templates: number;
    sequences: number;
    workflows?: number;
    inbox?: number;
  };
  errors?: string[];
}

// Predefined demo presets
export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'minimal',
    name: 'Minimal Setup',
    description: 'Basic setup with a few contacts, one segment, and one campaign',
    config: {
      contacts: 10,
      segments: 1,
      campaigns: 1,
      templates: 2,
      sequences: 0,
      includeWorkflows: false,
      includeInbox: false,
    },
  },
  {
    id: 'small-team',
    name: 'Small Team',
    description: 'Typical setup for a small organization with moderate data',
    config: {
      contacts: 50,
      segments: 5,
      campaigns: 3,
      templates: 10,
      sequences: 2,
      includeWorkflows: true,
      includeInbox: true,
    },
  },
  {
    id: 'full-demo',
    name: 'Full Demo',
    description: 'Comprehensive demo with all features populated',
    config: {
      contacts: 100,
      segments: 10,
      campaigns: 5,
      templates: 20,
      sequences: 5,
      includeWorkflows: true,
      includeInbox: true,
    },
  },
  {
    id: 'campaign-focus',
    name: 'Campaign Focus',
    description: 'Heavy on campaigns and templates for campaign testing',
    config: {
      contacts: 75,
      segments: 8,
      campaigns: 10,
      templates: 30,
      sequences: 0,
      includeWorkflows: false,
      includeInbox: false,
    },
  },
  {
    id: 'automation-focus',
    name: 'Automation Focus',
    description: 'Heavy on sequences and workflows for automation testing',
    config: {
      contacts: 50,
      segments: 5,
      campaigns: 2,
      templates: 15,
      sequences: 10,
      includeWorkflows: true,
      includeInbox: false,
    },
  },
];

/**
 * Service for seeding demo data using predefined presets
 */
@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly devService: DevService,
    private readonly devLogsService: DevLogsService,
  ) {}

  /**
   * Get all available presets
   */
  getPresets(): DemoPreset[] {
    return DEMO_PRESETS;
  }

  /**
   * Get a specific preset by ID
   */
  getPreset(presetId: string): DemoPreset | undefined {
    return DEMO_PRESETS.find((p) => p.id === presetId);
  }

  /**
   * Seed data using a preset
   */
  async seedWithPreset(
    tenantId: string,
    presetId: string,
    correlationId: string,
    resetFirst: boolean = false,
  ): Promise<SeedResult> {
    const startTime = Date.now();
    const preset = this.getPreset(presetId);

    if (!preset) {
      return {
        preset: presetId,
        success: false,
        duration: 0,
        summary: {
          contacts: 0,
          segments: 0,
          campaigns: 0,
          templates: 0,
          sequences: 0,
        },
        errors: [`Unknown preset: ${presetId}`],
      };
    }

    const errors: string[] = [];
    const summary = {
      contacts: 0,
      segments: 0,
      campaigns: 0,
      templates: 0,
      sequences: 0,
      workflows: 0,
      inbox: 0,
    };

    this.devLogsService.info('DemoSeedService', `Starting seed with preset: ${preset.name}`, {
      presetId,
      config: preset.config,
      resetFirst,
    });

    try {
      // Step 0: Reset if requested
      if (resetFirst) {
        this.devLogsService.info('DemoSeedService', 'Resetting existing data...');
        await this.devService.resetAll(tenantId);
        this.devLogsService.info('DemoSeedService', 'Reset complete');
      }

      // Step 1: Generate templates first (needed for campaigns)
      if (preset.config.templates && preset.config.templates > 0) {
        this.devLogsService.info('DemoSeedService', `Generating ${preset.config.templates} templates...`);
        const result = await this.devService.generateTemplates(
          tenantId,
          { count: preset.config.templates },
          correlationId,
        );
        summary.templates = result.created;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 2: Generate contacts
      if (preset.config.contacts && preset.config.contacts > 0) {
        this.devLogsService.info('DemoSeedService', `Generating ${preset.config.contacts} contacts...`);
        const result = await this.devService.generateContacts(
          tenantId,
          {
            count: preset.config.contacts,
            withAcademic: true,
            withProfessional: true,
          },
          correlationId,
        );
        summary.contacts = result.created;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 3: Generate segments
      if (preset.config.segments && preset.config.segments > 0) {
        this.devLogsService.info('DemoSeedService', `Generating ${preset.config.segments} segments...`);
        const result = await this.devService.generateSegments(
          tenantId,
          { count: preset.config.segments },
          correlationId,
        );
        summary.segments = result.created;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 4: Generate campaigns
      if (preset.config.campaigns && preset.config.campaigns > 0) {
        this.devLogsService.info('DemoSeedService', `Generating ${preset.config.campaigns} campaigns...`);
        const result = await this.devService.generateCampaigns(
          tenantId,
          { count: preset.config.campaigns },
          correlationId,
        );
        summary.campaigns = result.created;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 5: Generate sequences
      if (preset.config.sequences && preset.config.sequences > 0) {
        this.devLogsService.info('DemoSeedService', `Generating ${preset.config.sequences} sequences...`);
        const result = await this.devService.generateSequences(
          tenantId,
          { count: preset.config.sequences },
          correlationId,
        );
        summary.sequences = result.created;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 6: Run inbox scenario if included
      if (preset.config.includeInbox) {
        this.devLogsService.info('DemoSeedService', 'Running inbox flow scenario...');
        const result = await this.devService.runInboxFlowScenario(tenantId, {
          contactCount: Math.min(preset.config.contacts || 10, 20),
          messagesPerThread: 3,
          correlationId,
        });
        summary.inbox = (result.summary as any)?.threadsCreated || 0;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      // Step 7: Run workflow scenario if included
      if (preset.config.includeWorkflows) {
        this.devLogsService.info('DemoSeedService', 'Running workflow trigger scenario...');
        const result = await this.devService.runWorkflowTriggerScenario(tenantId, {
          contactCount: Math.min(preset.config.contacts || 5, 10),
          correlationId,
        });
        summary.workflows = (result.summary as any)?.workflowsCreated || 1;
        if (result.errors?.length) {
          errors.push(...result.errors);
        }
      }

      const duration = Date.now() - startTime;
      const success = errors.length === 0;

      this.devLogsService.info('DemoSeedService', `Seed complete: ${preset.name}`, {
        duration,
        success,
        summary,
        errorCount: errors.length,
      });

      return {
        preset: preset.name,
        success,
        duration,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.devLogsService.error('DemoSeedService', `Seed failed: ${error.message}`, {
        presetId,
        error: error.message,
      });

      return {
        preset: preset.name,
        success: false,
        duration,
        summary,
        errors: [...errors, error.message],
      };
    }
  }
}
