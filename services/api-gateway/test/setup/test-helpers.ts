/**
 * Test Helpers
 *
 * Factory functions for creating test entities with sensible defaults.
 */
import { v4 as uuidv4 } from 'uuid';
import { DataSource, Repository } from 'typeorm';
import { PipelineJob } from '../../src/modules/pipeline/entities/pipeline-job.entity';
import { PipelineJobStatus, PipelineChannel } from '../../src/modules/pipeline/entities/pipeline.enums';
import { CampaignRun, CampaignRunStatus } from '../../src/modules/campaigns/entities/campaign-run.entity';
import { Campaign } from '../../src/modules/campaigns/entities/campaign.entity';

export const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Create a PipelineJob record with sensible defaults
 */
export async function createTestJob(
  repo: Repository<PipelineJob>,
  overrides: Partial<PipelineJob> = {},
): Promise<PipelineJob> {
  const job = repo.create({
    id: uuidv4(),
    tenantId: TEST_TENANT_ID,
    campaignId: overrides.campaignId || uuidv4(),
    campaignRunId: overrides.campaignRunId || uuidv4(),
    contactId: overrides.contactId || uuidv4(),
    channel: PipelineChannel.EMAIL,
    status: PipelineJobStatus.PENDING,
    retryCount: 0,
    ...overrides,
  });
  return repo.save(job);
}

/**
 * Create a Campaign record with sensible defaults
 */
export async function createTestCampaign(
  repo: Repository<Campaign>,
  overrides: Partial<Campaign> = {},
): Promise<Campaign> {
  const campaign = repo.create({
    id: overrides.id || uuidv4(),
    tenantId: TEST_TENANT_ID,
    name: `Test Campaign ${Date.now()}`,
    channel: 'email',
    status: 'running',
    ...overrides,
  });
  return repo.save(campaign);
}

/**
 * Create a CampaignRun record with sensible defaults
 */
export async function createTestCampaignRun(
  repo: Repository<CampaignRun>,
  overrides: Partial<CampaignRun> = {},
): Promise<CampaignRun> {
  const run = repo.create({
    id: overrides.id || uuidv4(),
    tenantId: TEST_TENANT_ID,
    campaignId: overrides.campaignId || uuidv4(),
    status: CampaignRunStatus.RUNNING,
    startedAt: new Date(),
    totalRecipients: 0,
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    ...overrides,
  });
  return repo.save(run);
}
