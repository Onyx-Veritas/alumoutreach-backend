import { Injectable, Logger } from '@nestjs/common';
import { ContactGenerator, GeneratedContact } from '../generators/contact.generator';
import { SegmentGenerator, GeneratedSegment } from '../generators/segment.generator';
import { CampaignGenerator, GeneratedCampaign } from '../generators/campaign.generator';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { SegmentsService } from '../../modules/segments/services/segments.service';
import { CampaignsService } from '../../modules/campaigns/services/campaigns.service';
import { SYSTEM_USER_ID } from '../../common/constants/system';

export interface ScenarioResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: Record<string, unknown>;
  errors?: string[];
}

export interface CampaignBasicResult extends ScenarioResult {
  summary: {
    contactsCreated: number;
    segmentId: string;
    segmentName: string;
    campaignId: string;
    campaignName: string;
    targetAudience: number;
  };
}

@Injectable()
export class CampaignBasicScenario {
  private readonly logger = new Logger(CampaignBasicScenario.name);

  constructor(
    private readonly contactGenerator: ContactGenerator,
    private readonly segmentGenerator: SegmentGenerator,
    private readonly campaignGenerator: CampaignGenerator,
    private readonly contactsService: ContactsService,
    private readonly segmentsService: SegmentsService,
    private readonly campaignsService: CampaignsService,
  ) {}

  /**
   * Run the basic campaign scenario:
   * 1. Create N contacts
   * 2. Create a segment
   * 3. Add contacts to segment
   * 4. Create a campaign targeting the segment
   */
  async run(tenantId: string, options: {
    contactCount?: number;
    correlationId?: string;
  } = {}): Promise<CampaignBasicResult> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `scenario-${Date.now()}`;
    const contactCount = options.contactCount || 25;
    const errors: string[] = [];

    this.logger.log(`Starting campaign-basic scenario`, { tenantId, contactCount, correlationId });

    let contactsCreated = 0;
    let segmentId = '';
    let segmentName = '';
    let campaignId = '';
    let campaignName = '';

    try {
      // Step 1: Generate and create contacts
      this.logger.debug('Step 1: Generating contacts...');
      const generatedContacts = this.contactGenerator.generate({
        count: contactCount,
        tenantId,
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
          errors.push(`Failed to create contact ${contactData.email}: ${error.message}`);
        }
      }

      this.logger.debug(`Created ${contactsCreated} contacts`);

      // Step 2: Create a static segment
      this.logger.debug('Step 2: Creating segment...');
      const segmentData = this.segmentGenerator.generate({
        count: 1,
        tenantId,
        types: ['static'],
      })[0];

      const segment = await this.segmentsService.create(
        {
          name: `Campaign Test Segment - ${Date.now()}`,
          description: segmentData.description,
          type: 'static',
          tags: segmentData.tags,
        } as any,
        SYSTEM_USER_ID,
        tenantId,
      );
      segmentId = segment.id;
      segmentName = segment.name;

      this.logger.debug(`Created segment: ${segmentId}`);

      // Step 3: Add contacts to segment
      this.logger.debug('Step 3: Adding contacts to segment...');
      try {
        await this.segmentsService.addMembers(
          segmentId,
          { contactIds },
          SYSTEM_USER_ID,
          tenantId,
        );
      } catch (error) {
        errors.push(`Failed to add contacts to segment: ${(error as Error).message}`);
      }

      // Step 4: Create a campaign targeting the segment
      this.logger.debug('Step 4: Creating campaign...');
      const campaignData = this.campaignGenerator.generate({
        count: 1,
        tenantId,
        channels: ['email'],
        statuses: ['draft'],
      })[0];

      const campaign = await this.campaignsService.create(
        tenantId,
        {
          name: `Test Campaign - ${Date.now()}`,
          description: campaignData.description,
          channel: 'email',
          segmentId,
          subject: campaignData.subject,
          previewText: campaignData.previewText,
        } as any,
        SYSTEM_USER_ID,
        correlationId,
      );
      campaignId = campaign.id;
      campaignName = campaign.name;

      this.logger.debug(`Created campaign: ${campaignId}`);

    } catch (error) {
      this.logger.error('Scenario failed', error);
      errors.push(`Scenario error: ${error.message}`);
    }

    const duration = Date.now() - startTime;

    return {
      scenario: 'campaign-basic',
      success: errors.length === 0,
      duration,
      summary: {
        contactsCreated,
        segmentId,
        segmentName,
        campaignId,
        campaignName,
        targetAudience: contactsCreated,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
