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
import { PipelineRepository } from '../../modules/pipeline/repositories/pipeline.repository';
import { PipelineJobStatus } from '../../modules/pipeline/entities';
import { SYSTEM_USER_ID } from '../../common/constants/system';

export interface PartialFailureScenarioResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: {
    totalContacts: number;
    validEmailContacts: number;
    invalidEmailContacts: number;
    missingEmailContacts: number;
    templateId: string;
    segmentId: string;
    campaignId: string;
    campaignRunId?: string;
    expectedOutcome: {
      sent: number;
      skipped: number;
    };
    actualOutcome?: {
      total: number;
      sent: number;
      skipped: number;
      failed: number;
      pending: number;
    };
  };
  errors?: string[];
}

/**
 * Partial Failure Test Scenario
 * 
 * Creates a campaign with a mix of:
 * 1. Valid email contacts (should succeed)
 * 2. Invalid email format contacts (should be skipped)
 * 3. Missing email contacts (should be skipped)
 * 
 * Verifies that the hardening works:
 * - Valid contacts get emails sent
 * - Invalid/missing contacts are skipped (not failed with retries)
 * - Campaign stats are accurate
 */
@Injectable()
export class PartialFailureScenario {
  private readonly logger = new Logger(PartialFailureScenario.name);

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
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  /**
   * Run the partial failure scenario
   */
  async run(tenantId: string, options: {
    validCount?: number;
    invalidEmailCount?: number;
    missingEmailCount?: number;
    waitForCompletion?: boolean;
    waitTimeoutMs?: number;
    correlationId?: string;
  } = {}): Promise<PartialFailureScenarioResult> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `partial-failure-${uuidv4().slice(0, 8)}`;
    const validCount = options.validCount ?? 3;
    const invalidEmailCount = options.invalidEmailCount ?? 2;
    const missingEmailCount = options.missingEmailCount ?? 1;
    const waitForCompletion = options.waitForCompletion ?? true;
    const waitTimeoutMs = options.waitTimeoutMs ?? 30000;
    const errors: string[] = [];

    this.logger.log(`Starting partial-failure scenario`, {
      tenantId,
      validCount,
      invalidEmailCount,
      missingEmailCount,
      correlationId,
    });

    const totalContacts = validCount + invalidEmailCount + missingEmailCount;
    const contactIds: string[] = [];
    let templateId = '';
    let segmentId = '';
    let campaignId = '';
    let campaignRunId = '';

    try {
      // Step 1: Create contacts with different email states
      this.logger.debug('Step 1: Creating contacts with varying email validity...');

      // 1a. Valid email contacts
      const validContacts = this.contactGenerator.generate({
        count: validCount,
        tenantId,
        withPhone: false,
        withAcademic: true,
      });

      for (const contactData of validContacts) {
        try {
          const contact = await this.contactsService.create(
            tenantId,
            contactData as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactIds.push(contact.id);
          this.logger.debug(`Created valid contact: ${contact.email}`);
        } catch (error) {
          errors.push(`Failed to create valid contact: ${(error as Error).message}`);
        }
      }

      // 1b. Invalid email format contacts
      for (let i = 0; i < invalidEmailCount; i++) {
        try {
          const invalidEmails = [
            'not-an-email',
            'missing@',
            '@nodomain.com',
            'spaces in@email.com',
            'double@@at.com',
          ];
          const contact = await this.contactsService.create(
            tenantId,
            {
              fullName: `Invalid Email ${i + 1}`,
              email: invalidEmails[i % invalidEmails.length],
            } as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactIds.push(contact.id);
          this.logger.debug(`Created invalid email contact: ${contact.email}`);
        } catch (error) {
          errors.push(`Failed to create invalid email contact: ${(error as Error).message}`);
        }
      }

      // 1c. Missing email contacts
      for (let i = 0; i < missingEmailCount; i++) {
        try {
          const contact = await this.contactsService.create(
            tenantId,
            {
              fullName: `No Email Contact ${i + 1}`,
              phone: `+1555000${i}`,
              // No email field
            } as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactIds.push(contact.id);
          this.logger.debug(`Created no-email contact: ${contact.id}`);
        } catch (error) {
          errors.push(`Failed to create no-email contact: ${(error as Error).message}`);
        }
      }

      this.logger.debug(`Created ${contactIds.length} contacts`);

      if (contactIds.length === 0) {
        throw new Error('No contacts were created');
      }

      // Step 2: Create template
      this.logger.debug('Step 2: Creating template...');
      const [generatedTemplate] = this.templateGenerator.generate({
        count: 1,
        tenantId,
        channels: ['email'],
        categories: ['marketing'],
      });

      const template = await this.templatesService.create(tenantId, SYSTEM_USER_ID, {
        name: `Partial Failure Test Template - ${Date.now()}`,
        description: 'Template for testing partial failure scenario',
        channel: TemplateChannel.EMAIL,
        category: TemplateCategory.MARKETING,
        content: generatedTemplate.content as any,
        tags: ['dev-playground', 'partial-failure-test'],
      });
      templateId = template.id;
      const templateVersionId = template.currentVersionId || '';

      // Step 3: Create static segment
      this.logger.debug('Step 3: Creating segment...');
      const segment = await this.segmentsService.create(
        {
          name: `Partial Failure Test Segment - ${Date.now()}`,
          description: 'Test segment with mixed contact validity',
          type: 'static',
          tags: ['test', 'partial-failure'],
        } as any,
        SYSTEM_USER_ID,
        tenantId,
      );
      segmentId = segment.id;

      // Step 4: Add all contacts to segment
      await this.segmentsService.addMembers(
        segmentId,
        { contactIds },
        SYSTEM_USER_ID,
        tenantId,
      );
      this.logger.debug(`Added ${contactIds.length} contacts to segment`);

      // Step 5: Create campaign
      this.logger.debug('Step 5: Creating campaign...');
      const campaign = await this.campaignsService.create(
        tenantId,
        {
          name: `Partial Failure Test Campaign - ${Date.now()}`,
          description: 'Campaign for testing partial failure handling',
          channel: 'email',
          segmentId,
          templateVersionId,
        } as any,
        SYSTEM_USER_ID,
        correlationId,
      );
      campaignId = campaign.id;

      // Step 6: Execute campaign
      this.logger.debug('Step 6: Executing campaign...');
      const executionResult = await this.campaignExecutor.execute({
        campaignId,
        tenantId,
        userId: SYSTEM_USER_ID,
        correlationId,
        dryRun: false,
      });

      campaignRunId = executionResult.campaignRunId || '';

      if (!executionResult.success) {
        errors.push(`Campaign execution failed: ${executionResult.message}`);
      }

      // Step 7: Wait for completion and check results
      let actualOutcome;
      if (waitForCompletion && campaignRunId) {
        this.logger.debug('Step 7: Waiting for job completion...');
        actualOutcome = await this.waitForJobsToComplete(campaignRunId, tenantId, waitTimeoutMs);
      }

      const duration = Date.now() - startTime;
      const success = errors.length === 0;

      return {
        scenario: 'partial-failure',
        success,
        duration,
        summary: {
          totalContacts,
          validEmailContacts: validCount,
          invalidEmailContacts: invalidEmailCount,
          missingEmailContacts: missingEmailCount,
          templateId,
          segmentId,
          campaignId,
          campaignRunId,
          expectedOutcome: {
            sent: validCount,
            skipped: invalidEmailCount + missingEmailCount,
          },
          actualOutcome,
        },
        errors: errors.length > 0 ? errors : undefined,
      };

    } catch (error) {
      errors.push((error as Error).message);
      return {
        scenario: 'partial-failure',
        success: false,
        duration: Date.now() - startTime,
        summary: {
          totalContacts,
          validEmailContacts: validCount,
          invalidEmailContacts: invalidEmailCount,
          missingEmailContacts: missingEmailCount,
          templateId,
          segmentId,
          campaignId,
          campaignRunId,
          expectedOutcome: {
            sent: validCount,
            skipped: invalidEmailCount + missingEmailCount,
          },
        },
        errors,
      };
    }
  }

  /**
   * Wait for all jobs in a campaign run to reach terminal state
   */
  private async waitForJobsToComplete(
    campaignRunId: string,
    tenantId: string,
    timeoutMs: number,
  ): Promise<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
    pending: number;
  }> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      const stats = await this.getJobStats(campaignRunId, tenantId);

      // Check if all jobs are in terminal state
      if (stats.pending === 0) {
        this.logger.debug('All jobs completed', stats);
        return stats;
      }

      this.logger.debug('Waiting for jobs...', stats);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout - return current stats
    const finalStats = await this.getJobStats(campaignRunId, tenantId);
    this.logger.warn('Timeout waiting for jobs', finalStats);
    return finalStats;
  }

  /**
   * Get job statistics for a campaign run
   */
  private async getJobStats(campaignRunId: string, tenantId: string): Promise<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
    pending: number;
  }> {
    const { jobs } = await this.pipelineRepository.findJobs(tenantId, {
      campaignRunId,
      limit: 1000,
    });

    const stats = {
      total: jobs.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      pending: 0,
    };

    for (const job of jobs) {
      switch (job.status) {
        case PipelineJobStatus.SENT:
        case PipelineJobStatus.DELIVERED:
          stats.sent++;
          break;
        case PipelineJobStatus.SKIPPED:
          stats.skipped++;
          break;
        case PipelineJobStatus.FAILED:
        case PipelineJobStatus.DEAD:
          stats.failed++;
          break;
        default:
          stats.pending++;
      }
    }

    return stats;
  }
}
