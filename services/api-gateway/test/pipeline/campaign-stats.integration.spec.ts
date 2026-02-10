/**
 * Campaign Stats Integration Tests
 *
 * Tests atomic stat increments, campaign auto-completion, and recalculation
 * against a real PostgreSQL test database.
 */
import { DataSource, Repository } from 'typeorm';
import { PipelineJob } from '../../src/modules/pipeline/entities/pipeline-job.entity';
import { PipelineFailure } from '../../src/modules/pipeline/entities/pipeline-failure.entity';
import { PipelineJobStatus, PipelineChannel } from '../../src/modules/pipeline/entities/pipeline.enums';
import { CampaignRun, CampaignRunStatus } from '../../src/modules/campaigns/entities/campaign-run.entity';
import { Campaign, CampaignStatus } from '../../src/modules/campaigns/entities/campaign.entity';
import { CampaignStatsService } from '../../src/modules/pipeline/services/campaign-stats.listener';
import { getTestDataSource, closeTestDataSource, cleanDatabase } from '../setup/test-database';
import { createTestCampaign, createTestCampaignRun, createTestJob, TEST_TENANT_ID } from '../setup/test-helpers';

describe('CampaignStatsService (Integration)', () => {
  let dataSource: DataSource;
  let runRepo: Repository<CampaignRun>;
  let campaignRepo: Repository<Campaign>;
  let jobRepo: Repository<PipelineJob>;
  let statsService: CampaignStatsService;

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    runRepo = dataSource.getRepository(CampaignRun);
    campaignRepo = dataSource.getRepository(Campaign);
    jobRepo = dataSource.getRepository(PipelineJob);

    statsService = new CampaignStatsService(
      runRepo,
      campaignRepo,
      jobRepo,
      mockEventBus as any,
    );
  });

  afterAll(async () => {
    await closeTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    jest.clearAllMocks();
  });

  // ============ incrementSent ============

  describe('incrementSent', () => {
    it('increments sentCount and processedCount by 1', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 5,
      });

      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.sentCount).toBe(1);
      expect(updated!.processedCount).toBe(1);
    });

    it('calling 3 times results in sentCount=3, processedCount=3', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 5,
      });

      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');
      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-2');
      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-3');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.sentCount).toBe(3);
      expect(updated!.processedCount).toBe(3);
    });
  });

  // ============ incrementFailed ============

  describe('incrementFailed', () => {
    it('increments failedCount and processedCount by 1', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 5,
      });

      await statsService.incrementFailed(run.id, TEST_TENANT_ID, 'corr-1');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.failedCount).toBe(1);
      expect(updated!.processedCount).toBe(1);
    });
  });

  // ============ incrementSkipped ============

  describe('incrementSkipped', () => {
    it('increments skippedCount (column, not JSONB) and processedCount by 1', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 5,
      });

      await statsService.incrementSkipped(run.id, TEST_TENANT_ID, 'corr-1');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.skippedCount).toBe(1);
      expect(updated!.processedCount).toBe(1);
    });
  });

  // ============ Auto-completion ============

  describe('auto-completion', () => {
    it('marks run COMPLETED when processedCount reaches totalRecipients and sentCount > 0', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 2,
      });

      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');
      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-2');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.status).toBe(CampaignRunStatus.COMPLETED);
      expect(updated!.completedAt).toBeInstanceOf(Date);
    });

    it('marks run FAILED when processedCount reaches totalRecipients and sentCount = 0', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 2,
      });

      await statsService.incrementFailed(run.id, TEST_TENANT_ID, 'corr-1');
      await statsService.incrementFailed(run.id, TEST_TENANT_ID, 'corr-2');

      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.status).toBe(CampaignRunStatus.FAILED);
    });

    it('auto-updates parent Campaign status to COMPLETED', async () => {
      const campaign = await createTestCampaign(campaignRepo, {
        status: CampaignStatus.RUNNING,
      });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');

      const updatedCampaign = await campaignRepo.findOne({ where: { id: campaign.id } });
      expect(updatedCampaign!.status).toBe(CampaignStatus.COMPLETED);
    });

    it('auto-updates parent Campaign status to FAILED when run fails', async () => {
      const campaign = await createTestCampaign(campaignRepo, {
        status: CampaignStatus.RUNNING,
      });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      await statsService.incrementFailed(run.id, TEST_TENANT_ID, 'corr-1');

      const updatedCampaign = await campaignRepo.findOne({ where: { id: campaign.id } });
      expect(updatedCampaign!.status).toBe(CampaignStatus.FAILED);
    });

    it('already-completed run is not double-completed', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      // First completion
      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');

      // Manually verify it's completed
      const completed = await runRepo.findOne({ where: { id: run.id } });
      expect(completed!.status).toBe(CampaignRunStatus.COMPLETED);

      // Clear mock to detect new calls
      mockEventBus.publish.mockClear();

      // Additional increment shouldn't re-trigger completion
      // (processedCount is now 2 but totalRecipients is 1 — still >= total,
      //  but already completed, so the guard should return early)
      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-2');

      // Should not have published another completion event
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('publishes CAMPAIGN_RUN_COMPLETED event', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      await statsService.incrementSent(run.id, TEST_TENANT_ID, 'corr-1');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.stringContaining('campaign_run.completed'),
        expect.objectContaining({
          payload: expect.objectContaining({
            campaignRunId: run.id,
            campaignId: campaign.id,
            sentCount: 1,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  // ============ recalculateStats ============

  describe('recalculateStats', () => {
    it('counts jobs by status and updates run accordingly', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 0, // Will be recalculated
      });

      // Create jobs in various terminal states
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.SENT });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.SENT });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.DEAD });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.SKIPPED });

      const stats = await statsService.recalculateStats(run.id);

      expect(stats.sentCount).toBe(2);
      expect(stats.failedCount).toBe(1); // DEAD counts as failed
      expect(stats.skippedCount).toBe(1);
      expect(stats.totalRecipients).toBe(4);

      // Verify the run was updated in DB
      const updated = await runRepo.findOne({ where: { id: run.id } });
      expect(updated!.sentCount).toBe(2);
      expect(updated!.failedCount).toBe(1);
      expect(updated!.skippedCount).toBe(1);
      expect(updated!.processedCount).toBe(4); // sent + failed + skipped
    });

    it('handles mix of SENT, DELIVERED, FAILED, DEAD, SKIPPED', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 0,
      });

      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.SENT });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.DELIVERED });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.FAILED });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.DEAD });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.SKIPPED });
      await createTestJob(jobRepo, { campaignRunId: run.id, status: PipelineJobStatus.PENDING });

      const stats = await statsService.recalculateStats(run.id);

      // SENT + DELIVERED both count as sent
      expect(stats.sentCount).toBe(2);
      // FAILED + DEAD both count as failed
      expect(stats.failedCount).toBe(2);
      expect(stats.skippedCount).toBe(1);
      // PENDING counts as pending (not processed)
      expect(stats.pendingCount).toBe(1);
      expect(stats.totalRecipients).toBe(6);
    });
  });
});
