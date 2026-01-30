import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ContactGenerator, GeneratedContact } from '../generators/contact.generator';
import { SegmentGenerator } from '../generators/segment.generator';
import { CampaignGenerator } from '../generators/campaign.generator';
import { TemplateGenerator, GeneratedTemplate } from '../generators/template.generator';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { SegmentsService } from '../../modules/segments/services/segments.service';
import { CampaignsService } from '../../modules/campaigns/services/campaigns.service';
import { CampaignExecutorService, ExecuteCampaignResult } from '../../modules/campaigns/services/campaign-executor.service';
import { TemplatesService } from '../../modules/templates/services/templates.service';
import { TemplateChannel, TemplateCategory } from '../../modules/templates/entities/template.enums';
import { SYSTEM_USER_ID } from '../../common/constants/system';

export interface ScenarioResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: Record<string, unknown>;
  errors?: string[];
}

export interface CampaignExecutionResult extends ScenarioResult {
  summary: {
    contactsCreated: number;
    templateId: string;
    templateName: string;
    templateVersionId: string;
    segmentId: string;
    segmentName: string;
    campaignId: string;
    campaignName: string;
    campaignRunId?: string;
    executionResult?: ExecuteCampaignResult;
    targetAudience: number;
  };
}

/**
 * Campaign Execution Scenario
 * 
 * This scenario creates a complete campaign execution flow using BullMQ:
 * 1. Create contacts
 * 2. Create a static segment with those contacts
 * 3. Create a campaign with a template
 * 4. Execute the campaign via CampaignExecutorService (BullMQ pipeline)
 * 
 * This is useful for testing the entire campaign execution loop including:
 * - Segment resolution
 * - Pipeline job creation
 * - BullMQ enqueueing
 * - Message processing
 */
@Injectable()
export class CampaignExecutionScenario {
  private readonly logger = new Logger(CampaignExecutionScenario.name);

  constructor(
    private readonly contactGenerator: ContactGenerator,
    private readonly segmentGenerator: SegmentGenerator,
    private readonly campaignGenerator: CampaignGenerator,
    private readonly templateGenerator: TemplateGenerator,
    private readonly contactsService: ContactsService,
    private readonly segmentsService: SegmentsService,
    private readonly campaignsService: CampaignsService,
    private readonly templatesService: TemplatesService,
    private readonly campaignExecutor: CampaignExecutorService,
  ) {}

  /**
   * Run the campaign execution scenario:
   * 1. Create N contacts
   * 2. Create a static segment
   * 3. Add contacts to segment  
   * 4. Create a campaign targeting the segment
   * 5. Execute the campaign (enqueue to BullMQ)
   */
  async run(tenantId: string, options: {
    contactCount?: number;
    channel?: 'email' | 'sms' | 'whatsapp' | 'push';
    executeImmediately?: boolean;
    correlationId?: string;
  } = {}): Promise<CampaignExecutionResult> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `campaign-exec-${uuidv4().slice(0, 8)}`;
    const contactCount = options.contactCount || 10;
    const channel = options.channel || 'email';
    const executeImmediately = options.executeImmediately ?? true;
    const errors: string[] = [];

    this.logger.log(`Starting campaign-execution scenario`, {
      tenantId,
      contactCount,
      channel,
      executeImmediately,
      correlationId,
    });

    let contactsCreated = 0;
    let templateId = '';
    let templateName = '';
    let templateVersionId = '';
    let segmentId = '';
    let segmentName = '';
    let campaignId = '';
    let campaignName = '';
    let campaignRunId = '';
    let executionResult: ExecuteCampaignResult | undefined;

    try {
      // Step 1: Generate and create contacts
      this.logger.debug('Step 1: Generating contacts...');
      const generatedContacts = this.contactGenerator.generate({
        count: contactCount,
        tenantId,
        withPhone: channel === 'sms' || channel === 'whatsapp',
        withAcademic: true,
        withProfessional: true,
      });

      const contactIds: string[] = [];
      for (const contactData of generatedContacts) {
        try {
          const contact = await this.contactsService.create(
            tenantId,
            contactData as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactIds.push(contact.id);
          contactsCreated++;
        } catch (error) {
          errors.push(`Failed to create contact ${contactData.email}: ${(error as Error).message}`);
        }
      }

      this.logger.debug(`Created ${contactsCreated} contacts`);

      if (contactsCreated === 0) {
        return {
          scenario: 'campaign-execution',
          success: false,
          duration: Date.now() - startTime,
          summary: {
            contactsCreated: 0,
            templateId: '',
            templateName: '',
            templateVersionId: '',
            segmentId: '',
            segmentName: '',
            campaignId: '',
            campaignName: '',
            targetAudience: 0,
          },
          errors: ['No contacts were created'],
        };
      }

      // Step 2: Create a template
      this.logger.debug('Step 2: Creating template...');
      const [generatedTemplate] = this.templateGenerator.generate({
        count: 1,
        tenantId,
        channels: [channel],
        categories: ['marketing'],
      });

      try {
        // Map channel string to TemplateChannel enum
        const templateChannel = TemplateChannel[channel.toUpperCase() as keyof typeof TemplateChannel];
        
        const template = await this.templatesService.create(tenantId, SYSTEM_USER_ID, {
          name: `Campaign Template - ${Date.now()}`,
          description: generatedTemplate.description || 'Auto-generated template for campaign execution test',
          channel: templateChannel,
          category: TemplateCategory.MARKETING,
          content: generatedTemplate.content as any,
          tags: generatedTemplate.tags || ['dev-playground', 'auto-generated'],
        });
        templateId = template.id;
        templateName = template.name;
        templateVersionId = template.currentVersionId || '';

        this.logger.debug(`Created template: ${templateId}, version: ${templateVersionId}`);
      } catch (error) {
        errors.push(`Failed to create template: ${(error as Error).message}`);
        // Template creation failed, return early
        return {
          scenario: 'campaign-execution',
          success: false,
          duration: Date.now() - startTime,
          summary: {
            contactsCreated,
            templateId: '',
            templateName: '',
            templateVersionId: '',
            segmentId: '',
            segmentName: '',
            campaignId: '',
            campaignName: '',
            targetAudience: contactsCreated,
          },
          errors,
        };
      }

      // Step 3: Create a static segment
      this.logger.debug('Step 3: Creating segment...');
      const segmentData = this.segmentGenerator.generate({
        count: 1,
        tenantId,
        types: ['static'],
      })[0];

      const segment = await this.segmentsService.create(
        {
          name: `Execution Test Segment - ${Date.now()}`,
          description: segmentData.description || 'Test segment for campaign execution',
          type: 'static',
          tags: segmentData.tags || [],
        } as any,
        SYSTEM_USER_ID,
        tenantId,
      );
      segmentId = segment.id;
      segmentName = segment.name;

      this.logger.debug(`Created segment: ${segmentId}`);

      // Step 4: Add contacts to segment
      this.logger.debug('Step 4: Adding contacts to segment...');
      try {
        await this.segmentsService.addMembers(
          segmentId,
          { contactIds },
          SYSTEM_USER_ID,
          tenantId,
        );
        this.logger.debug(`Added ${contactIds.length} contacts to segment`);
      } catch (error) {
        errors.push(`Failed to add contacts to segment: ${(error as Error).message}`);
      }

      // Step 5: Create a campaign targeting the segment with the template
      this.logger.debug('Step 5: Creating campaign...');
      const campaignData = this.campaignGenerator.generate({
        count: 1,
        tenantId,
        channels: [channel],
        statuses: ['draft'],
      })[0];

      const campaign = await this.campaignsService.create(
        tenantId,
        {
          name: `Execution Test Campaign - ${Date.now()}`,
          description: campaignData.description || 'Test campaign for execution',
          channel,
          segmentId,
          templateVersionId, // Assign the template version
        } as any,
        SYSTEM_USER_ID,
        correlationId,
      );
      campaignId = campaign.id;
      campaignName = campaign.name;

      this.logger.debug(`Created campaign: ${campaignId} with template version: ${templateVersionId}`);

      // Step 6: Execute the campaign (if requested)
      if (executeImmediately) {
        this.logger.debug('Step 6: Executing campaign via BullMQ...');
        try {
          executionResult = await this.campaignExecutor.execute({
            campaignId,
            tenantId,
            userId: SYSTEM_USER_ID,
            correlationId,
            dryRun: false,
          });

          campaignRunId = executionResult.campaignRunId || '';

          if (executionResult.success) {
            this.logger.log(`Campaign execution started`, {
              campaignId,
              campaignRunId,
              totalRecipients: executionResult.totalRecipients,
              enqueuedJobs: executionResult.enqueuedJobs,
            });
          } else {
            errors.push(`Campaign execution failed: ${executionResult.message}`);
          }
        } catch (error) {
          errors.push(`Failed to execute campaign: ${(error as Error).message}`);
        }
      } else {
        this.logger.debug('Step 6: Skipped execution (executeImmediately=false)');
      }

      const duration = Date.now() - startTime;
      const success = errors.length === 0;

      this.logger.log(`Scenario completed`, {
        scenario: 'campaign-execution',
        success,
        duration,
        contactsCreated,
        campaignId,
        campaignRunId,
        errorCount: errors.length,
      });

      return {
        scenario: 'campaign-execution',
        success,
        duration,
        summary: {
          contactsCreated,
          templateId,
          templateName,
          templateVersionId,
          segmentId,
          segmentName,
          campaignId,
          campaignName,
          campaignRunId,
          executionResult,
          targetAudience: contactsCreated,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Scenario failed: ${message}`, (error as Error).stack);
      errors.push(message);

      return {
        scenario: 'campaign-execution',
        success: false,
        duration: Date.now() - startTime,
        summary: {
          contactsCreated,
          templateId,
          templateName,
          templateVersionId,
          segmentId,
          segmentName,
          campaignId,
          campaignName,
          campaignRunId,
          targetAudience: contactsCreated,
        },
        errors,
      };
    }
  }
}
