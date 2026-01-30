import { Injectable, Logger } from '@nestjs/common';
import { ContactGenerator, GenerateContactsOptions, GeneratedContact } from './generators/contact.generator';
import { SegmentGenerator, GenerateSegmentsOptions, GeneratedSegment } from './generators/segment.generator';
import { CampaignGenerator, GenerateCampaignsOptions, GeneratedCampaign } from './generators/campaign.generator';
import { TemplateGenerator, GenerateTemplatesOptions, GeneratedTemplate } from './generators/template.generator';
import { SequenceGenerator, GenerateSequencesOptions, GeneratedSequence } from './generators/sequence.generator';
import { CampaignBasicScenario, CampaignBasicResult } from './scenarios/campaign-basic.scenario';
import { InboxFlowScenario, InboxFlowResult } from './scenarios/inbox-flow.scenario';
import { WorkflowTriggerScenario, WorkflowTriggerResult } from './scenarios/workflow-trigger.scenario';
import { CampaignExecutionScenario, CampaignExecutionResult } from './scenarios/campaign-execution.scenario';
import { SequenceEnrollmentScenario, SequenceEnrollmentResult } from './scenarios/sequence-enrollment.scenario';
import { PartialFailureScenario, PartialFailureScenarioResult } from './scenarios/partial-failure.scenario';
import { ResetService, ResetResult, FullResetResult } from './reset/reset.service';
import { DevLogsService, LogsQueryOptions, LogsResponse } from './services/dev-logs.service';
import { ContactsService } from '../modules/contacts/contacts.service';
import { SegmentsService } from '../modules/segments/services/segments.service';
import { CampaignsService } from '../modules/campaigns/services/campaigns.service';
import { TemplatesService } from '../modules/templates/services/templates.service';
import { SequencesService } from '../modules/sequences/services/sequences.service';
import { InboxService } from '../modules/inbox/services/inbox.service';
import { WorkflowsService } from '../modules/workflows/services/workflows.service';
import { SYSTEM_USER_ID } from '../common/constants/system';

export interface GenerateResult<T> {
  success: boolean;
  count: number;
  created: number;
  failed: number;
  duration: number;
  items: T[];
  errors?: string[];
}

export interface DashboardData {
  tenantId: string;
  counts: Record<string, number>;
  environment: string;
  devPlaygroundEnabled: boolean;
  lastUpdated: string;
}

@Injectable()
export class DevService {
  private readonly logger = new Logger(DevService.name);

  constructor(
    // Generators
    private readonly contactGenerator: ContactGenerator,
    private readonly segmentGenerator: SegmentGenerator,
    private readonly campaignGenerator: CampaignGenerator,
    private readonly templateGenerator: TemplateGenerator,
    private readonly sequenceGenerator: SequenceGenerator,
    // Scenarios
    private readonly campaignBasicScenario: CampaignBasicScenario,
    private readonly inboxFlowScenario: InboxFlowScenario,
    private readonly workflowTriggerScenario: WorkflowTriggerScenario,
    private readonly campaignExecutionScenario: CampaignExecutionScenario,
    private readonly sequenceEnrollmentScenario: SequenceEnrollmentScenario,
    private readonly partialFailureScenario: PartialFailureScenario,
    // Reset
    private readonly resetService: ResetService,
    // Logs
    private readonly devLogsService: DevLogsService,
    // Real services (for creating data)
    private readonly contactsService: ContactsService,
    private readonly segmentsService: SegmentsService,
    private readonly campaignsService: CampaignsService,
    private readonly templatesService: TemplatesService,
    private readonly sequencesService: SequencesService,
    private readonly inboxService: InboxService,
    private readonly workflowsService: WorkflowsService,
  ) {
    this.logger.log('DevService initialized - Dev Playground is enabled');
  }

  // ==================== DASHBOARD ====================

  /**
   * Get dashboard data with counts and status
   */
  async getDashboard(tenantId: string): Promise<DashboardData> {
    const counts = await this.resetService.getCounts(tenantId);

    return {
      tenantId,
      counts,
      environment: process.env.NODE_ENV || 'development',
      devPlaygroundEnabled: true,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ==================== GENERATORS ====================

  /**
   * Generate and create contacts
   */
  async generateContacts(
    tenantId: string,
    options: Partial<GenerateContactsOptions>,
    correlationId: string,
  ): Promise<GenerateResult<{ id: string; email: string; fullName: string }>> {
    const startTime = Date.now();
    const count = options.count || 10;
    const errors: string[] = [];

    this.logger.log(`Generating ${count} contacts for tenant ${tenantId}`);

    // Generate contact data
    const generatedContacts = this.contactGenerator.generate({
      count,
      tenantId,
      ...options,
    });

    // Create contacts via real service
    const items: { id: string; email: string; fullName: string }[] = [];
    let created = 0;
    let failed = 0;

    for (const contactData of generatedContacts) {
      try {
        const contact = await this.contactsService.create(
          tenantId,
          contactData as any,
          SYSTEM_USER_ID,
          correlationId,
        );
        items.push({
          id: contact.id,
          email: contact.email,
          fullName: contact.fullName,
        });
        created++;
      } catch (error) {
        failed++;
        errors.push(`Failed to create ${contactData.email}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      count,
      created,
      failed,
      duration: Date.now() - startTime,
      items,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate and create segments
   */
  async generateSegments(
    tenantId: string,
    options: Partial<GenerateSegmentsOptions>,
    correlationId: string,
  ): Promise<GenerateResult<{ id: string; name: string; type: string }>> {
    const startTime = Date.now();
    const count = options.count || 5;
    const errors: string[] = [];

    this.logger.log(`Generating ${count} segments for tenant ${tenantId}`);

    // Generate segment data
    const generatedSegments = this.segmentGenerator.generate({
      count,
      tenantId,
      ...options,
    });

    // Create segments via real service
    const items: { id: string; name: string; type: string }[] = [];
    let created = 0;
    let failed = 0;

    for (const segmentData of generatedSegments) {
      try {
        const segment = await this.segmentsService.create(
          {
            name: segmentData.name,
            description: segmentData.description,
            type: segmentData.type,
            rules: segmentData.rules,
            tags: segmentData.tags,
          } as any,
          SYSTEM_USER_ID,
          tenantId,
        );
        items.push({
          id: segment.id,
          name: segment.name,
          type: segment.type,
        });
        created++;
      } catch (error) {
        failed++;
        errors.push(`Failed to create ${segmentData.name}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      count,
      created,
      failed,
      duration: Date.now() - startTime,
      items,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate and create campaigns
   */
  async generateCampaigns(
    tenantId: string,
    options: Partial<GenerateCampaignsOptions> & { segmentId?: string },
    correlationId: string,
  ): Promise<GenerateResult<{ id: string; name: string; channel: string; status: string }>> {
    const startTime = Date.now();
    const count = options.count || 3;
    const errors: string[] = [];

    this.logger.log(`Generating ${count} campaigns for tenant ${tenantId}`);

    // Generate campaign data
    const generatedCampaigns = this.campaignGenerator.generate({
      count,
      tenantId,
      ...options,
    });

    // Create campaigns via real service
    const items: { id: string; name: string; channel: string; status: string }[] = [];
    let created = 0;
    let failed = 0;

    for (const campaignData of generatedCampaigns) {
      try {
        const campaign = await this.campaignsService.create(
          tenantId,
          {
            name: campaignData.name,
            description: campaignData.description,
            channel: campaignData.channel,
            segmentId: options.segmentId,
            subject: campaignData.subject,
            previewText: campaignData.previewText,
          } as any,
          SYSTEM_USER_ID,
          correlationId,
        );
        items.push({
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          status: campaign.status,
        });
        created++;
      } catch (error) {
        failed++;
        errors.push(`Failed to create ${campaignData.name}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      count,
      created,
      failed,
      duration: Date.now() - startTime,
      items,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate and create templates
   */
  async generateTemplates(
    tenantId: string,
    options: Partial<GenerateTemplatesOptions>,
    correlationId: string,
  ): Promise<GenerateResult<{ id: string; name: string; channel: string; category: string }>> {
    const startTime = Date.now();
    const count = options.count || 5;
    const errors: string[] = [];

    this.logger.log(`Generating ${count} templates for tenant ${tenantId}`);

    // Generate template data
    const generatedTemplates = this.templateGenerator.generate({
      count,
      tenantId,
      ...options,
    });

    // Create templates via real service
    const items: { id: string; name: string; channel: string; category: string }[] = [];
    let created = 0;
    let failed = 0;

    for (const templateData of generatedTemplates) {
      try {
        const template = await this.templatesService.create(
          tenantId,
          SYSTEM_USER_ID,
          {
            name: templateData.name,
            description: templateData.description,
            channel: templateData.channel as any,
            category: templateData.category as any,
            content: templateData.content as any,
            tags: templateData.tags,
            metadata: templateData.metadata,
          },
        );
        items.push({
          id: template.id,
          name: template.name,
          channel: template.channel,
          category: template.category,
        });
        created++;
      } catch (error) {
        failed++;
        errors.push(`Failed to create ${templateData.name}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      count,
      created,
      failed,
      duration: Date.now() - startTime,
      items,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate and create sequences
   */
  async generateSequences(
    tenantId: string,
    options: Partial<GenerateSequencesOptions>,
    correlationId: string,
  ): Promise<GenerateResult<{ id: string; name: string; type: string; stepsCount: number }>> {
    const startTime = Date.now();
    const count = options.count || 3;
    const errors: string[] = [];

    this.logger.log(`Generating ${count} sequences for tenant ${tenantId}`);

    // Generate sequence data
    const generatedSequences = this.sequenceGenerator.generate({
      count,
      tenantId,
      ...options,
    });

    // Create sequences via real service
    const items: { id: string; name: string; type: string; stepsCount: number }[] = [];
    let created = 0;
    let failed = 0;

    for (const sequenceData of generatedSequences) {
      try {
        const sequence = await this.sequencesService.create(
          tenantId,
          {
            name: sequenceData.name,
            description: sequenceData.description,
            type: sequenceData.type as any,
            triggerConfig: sequenceData.triggerConfig as any,
            steps: sequenceData.steps.map(step => ({
              stepNumber: step.stepNumber,
              name: step.name,
              description: step.description,
              stepType: step.stepType as any,
              config: step.config as any,
            })),
          },
          SYSTEM_USER_ID,
          correlationId,
        );
        items.push({
          id: sequence.id,
          name: sequence.name,
          type: sequence.type,
          stepsCount: sequence.steps?.length || sequenceData.steps.length,
        });
        created++;
      } catch (error) {
        failed++;
        errors.push(`Failed to create ${sequenceData.name}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      count,
      created,
      failed,
      duration: Date.now() - startTime,
      items,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ==================== SCENARIOS ====================

  /**
   * Run the basic campaign scenario
   */
  async runCampaignBasicScenario(
    tenantId: string,
    options: { contactCount?: number; correlationId?: string },
  ): Promise<CampaignBasicResult> {
    return this.campaignBasicScenario.run(tenantId, options);
  }

  /**
   * Run the inbox flow scenario
   */
  async runInboxFlowScenario(
    tenantId: string,
    options: {
      contactCount?: number;
      messagesPerThread?: number;
      channels?: ('email' | 'sms' | 'whatsapp')[];
      correlationId?: string;
    },
  ): Promise<InboxFlowResult> {
    return this.inboxFlowScenario.run(tenantId, options);
  }

  /**
   * Run the workflow trigger scenario
   */
  async runWorkflowTriggerScenario(
    tenantId: string,
    options: {
      contactCount?: number;
      triggerType?: 'contact_created' | 'tag_added' | 'segment_joined';
      correlationId?: string;
    },
  ): Promise<WorkflowTriggerResult> {
    return this.workflowTriggerScenario.run(tenantId, options);
  }

  /**
   * Run the campaign execution scenario (BullMQ pipeline)
   */
  async runCampaignExecutionScenario(
    tenantId: string,
    options: {
      contactCount?: number;
      channel?: 'email' | 'sms' | 'whatsapp' | 'push';
      executeImmediately?: boolean;
      correlationId?: string;
    },
  ): Promise<CampaignExecutionResult> {
    return this.campaignExecutionScenario.run(tenantId, options);
  }

  /**
   * Run the sequence enrollment scenario
   */
  async runSequenceEnrollmentScenario(
    tenantId: string,
    options: {
      contactCount?: number;
      sequenceType?: 'drip' | 'onboarding' | 'behavioral';
      enrollAll?: boolean;
      correlationId?: string;
    },
  ): Promise<SequenceEnrollmentResult> {
    return this.sequenceEnrollmentScenario.run(tenantId, options);
  }

  /**
   * Run the partial failure scenario - tests failure handling with invalid/missing emails
   */
  async runPartialFailureScenario(
    tenantId: string,
    options: {
      validCount?: number;
      invalidEmailCount?: number;
      missingEmailCount?: number;
      waitForCompletion?: boolean;
      waitTimeoutMs?: number;
      correlationId?: string;
    },
  ): Promise<PartialFailureScenarioResult> {
    return this.partialFailureScenario.run(tenantId, options);
  }

  // ==================== RESET ====================

  /**
   * Reset all data for a tenant
   */
  async resetAll(tenantId: string): Promise<FullResetResult> {
    this.logger.warn(`Resetting all data for tenant: ${tenantId}`);
    return this.resetService.resetAll(tenantId);
  }

  /**
   * Reset contacts for a tenant
   */
  async resetContacts(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting contacts for tenant: ${tenantId}`);
    return this.resetService.resetContacts(tenantId);
  }

  /**
   * Reset campaigns for a tenant
   */
  async resetCampaigns(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting campaigns for tenant: ${tenantId}`);
    return this.resetService.resetCampaigns(tenantId);
  }

  /**
   * Reset segments for a tenant
   */
  async resetSegments(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting segments for tenant: ${tenantId}`);
    return this.resetService.resetSegments(tenantId);
  }

  /**
   * Reset inbox for a tenant
   */
  async resetInbox(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting inbox for tenant: ${tenantId}`);
    return this.resetService.resetInbox(tenantId);
  }

  /**
   * Reset workflows for a tenant
   */
  async resetWorkflows(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting workflows for tenant: ${tenantId}`);
    return this.resetService.resetWorkflows(tenantId);
  }

  /**
   * Reset sequences for a tenant
   */
  async resetSequences(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting sequences for tenant: ${tenantId}`);
    return this.resetService.resetSequences(tenantId);
  }

  // ==================== EXPLORER (List All) ====================

  /**
   * List all contacts for a tenant (simplified for explorer)
   */
  async listContacts(tenantId: string, limit: number = 50) {
    const result = await this.contactsService.findAll(tenantId, { page: 1, limit }, 'dev-explorer');
    return {
      items: result.data.map((c: any) => ({
        id: c.id,
        email: c.email,
        fullName: c.fullName,
        status: c.status,
        createdAt: c.createdAt,
      })),
      total: result.meta.total,
    };
  }

  /**
   * List all segments for a tenant
   */
  async listSegments(tenantId: string, limit: number = 50) {
    const result = await this.segmentsService.findAll({ page: 1, limit }, tenantId);
    return {
      items: result.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        memberCount: s.memberCount,
        createdAt: s.createdAt,
      })),
      total: result.meta.total,
    };
  }

  /**
   * List all campaigns for a tenant
   */
  async listCampaigns(tenantId: string, limit: number = 50) {
    const result = await this.campaignsService.findAll(tenantId, { page: 1, limit }, 'dev-explorer');
    return {
      items: result.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        channel: c.channel,
        status: c.status,
        createdAt: c.createdAt,
      })),
      total: result.meta.total,
    };
  }

  /**
   * List all templates for a tenant
   */
  async listTemplates(tenantId: string, limit: number = 50) {
    const result = await this.templatesService.findAll(tenantId, { page: 1, limit });
    return {
      items: result.data.map((t: any) => ({
        id: t.id,
        name: t.name,
        channel: t.channel,
        category: t.category,
        status: t.status,
        approvalStatus: t.approvalStatus,
        createdAt: t.createdAt,
      })),
      total: result.total,
    };
  }

  /**
   * List all workflows for a tenant
   */
  async listWorkflows(tenantId: string, limit: number = 50) {
    const result = await this.workflowsService.findAll(tenantId, { page: 1, limit });
    return {
      items: result.data.map((w: any) => ({
        id: w.id,
        name: w.name,
        triggerType: w.triggerType,
        status: w.status,
        isActive: w.isActive,
        createdAt: w.createdAt,
      })),
      total: result.total,
    };
  }

  /**
   * List all sequences for a tenant
   */
  async listSequences(tenantId: string, limit: number = 50) {
    const result = await this.sequencesService.findMany(tenantId, { page: 1, limit });
    return {
      items: result.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
        stepsCount: s.stepsCount || s.steps?.length || 0,
        enrolledCount: s.enrolledCount || 0,
        createdAt: s.createdAt,
      })),
      total: result.total,
    };
  }

  /**
   * List all inbox threads for a tenant
   */
  async listInboxThreads(tenantId: string, limit: number = 50) {
    const result = await this.inboxService.listThreads(tenantId, { page: 1, limit });
    return {
      items: result.items.map((t: any) => ({
        id: t.id,
        contactId: t.contactId,
        channel: t.channel,
        status: t.status,
        priority: t.priority,
        lastMessageAt: t.lastMessageAt,
        createdAt: t.createdAt,
      })),
      total: result.total,
    };
  }

  // ==================== RESET TEMPLATES ====================

  /**
   * Reset templates for a tenant
   */
  async resetTemplates(tenantId: string): Promise<ResetResult> {
    this.logger.warn(`Resetting templates for tenant: ${tenantId}`);
    return this.resetService.resetTemplates(tenantId);
  }

  // ==================== LOGS ====================

  /**
   * Get dev playground logs
   */
  async getLogs(options: LogsQueryOptions): Promise<LogsResponse> {
    return this.devLogsService.getLogs(options);
  }

  /**
   * Get new logs since a specific log ID
   */
  async getNewLogs(afterLogId: string, limit?: number): Promise<LogsResponse> {
    return this.devLogsService.getNewLogs(afterLogId, limit);
  }

  /**
   * Get log stats
   */
  async getLogStats(): Promise<{ total: number; byLevel: Record<string, number> }> {
    return this.devLogsService.getStats();
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    this.devLogsService.clearLogs();
  }

  /**
   * Log a dev activity (public helper for scenarios/generators)
   */
  logActivity(module: string, message: string, context?: Record<string, unknown>): void {
    this.devLogsService.info(module, message, context);
  }
}
