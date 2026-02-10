/**
 * Pipeline Flow Integration Tests
 *
 * End-to-end tests that simulate the full campaign execution lifecycle
 * by exercising repository and stats service methods in sequence.
 * Verifies final state consistency across pipeline jobs, campaign runs,
 * and parent campaigns.
 *
 * This is the highest-value test suite — it catches compounding errors
 * that individually correct components might produce in combination.
 */
import { DataSource, Repository } from 'typeorm';
import { PipelineJob } from '../../src/modules/pipeline/entities/pipeline-job.entity';
import { PipelineFailure } from '../../src/modules/pipeline/entities/pipeline-failure.entity';
import { PipelineJobStatus, PipelineSkipReason, PipelineChannel } from '../../src/modules/pipeline/entities/pipeline.enums';
import { CampaignRun, CampaignRunStatus } from '../../src/modules/campaigns/entities/campaign-run.entity';
import { Campaign, CampaignStatus } from '../../src/modules/campaigns/entities/campaign.entity';
import { PipelineRepository } from '../../src/modules/pipeline/repositories/pipeline.repository';
import { CampaignStatsService } from '../../src/modules/pipeline/services/campaign-stats.listener';
import { getTestDataSource, closeTestDataSource, cleanDatabase } from '../setup/test-database';
import { createTestCampaign, createTestCampaignRun, createTestJob, TEST_TENANT_ID } from '../setup/test-helpers';

describe('Pipeline Flow - End to End (Integration)', () => {
  let dataSource: DataSource;
  let jobRepo: Repository<PipelineJob>;
  let failureRepo: Repository<PipelineFailure>;
  let runRepo: Repository<CampaignRun>;
  let campaignRepo: Repository<Campaign>;
  let pipelineRepository: PipelineRepository;
  let statsService: CampaignStatsService;

  const mockEventBus = { publish: jest.fn() };
  const CORR_ID = 'test-correlation';

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    jobRepo = dataSource.getRepository(PipelineJob);
    failureRepo = dataSource.getRepository(PipelineFailure);
    runRepo = dataSource.getRepository(CampaignRun);
    campaignRepo = dataSource.getRepository(Campaign);

    pipelineRepository = new PipelineRepository(jobRepo, failureRepo);
    statsService = new CampaignStatsService(runRepo, campaignRepo, jobRepo, mockEventBus as any);
  });

  afterAll(async () => {
    await closeTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    jest.clearAllMocks();
  });

  // ============ Happy Path ============

  describe('happy path: all contacts send successfully', () => {
    it('3 PENDING jobs → all SENT → CampaignRun COMPLETED, Campaign COMPLETED', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 3,
      });

      // Create 3 PENDING jobs
      const jobs = await Promise.all([
        createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id }),
        createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id }),
        createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id }),
      ]);

      // Simulate pipeline processing for each job
      for (const job of jobs) {
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
        await pipelineRepository.markJobSent(job.id, `provider-${job.id}`);
        await statsService.incrementSent(run.id, TEST_TENANT_ID, CORR_ID);
      }

      // Verify all jobs in SENT status
      for (const job of jobs) {
        const updated = await jobRepo.findOne({ where: { id: job.id } });
        expect(updated!.status).toBe(PipelineJobStatus.SENT);
        expect(updated!.providerMessageId).toBe(`provider-${job.id}`);
      }

      // Verify CampaignRun
      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.sentCount).toBe(3);
      expect(updatedRun!.processedCount).toBe(3);
      expect(updatedRun!.failedCount).toBe(0);
      expect(updatedRun!.skippedCount).toBe(0);
      expect(updatedRun!.status).toBe(CampaignRunStatus.COMPLETED);

      // Verify parent Campaign
      const updatedCampaign = await campaignRepo.findOne({ where: { id: campaign.id } });
      expect(updatedCampaign!.status).toBe(CampaignStatus.COMPLETED);
    });
  });

  // ============ Partial Failure ============

  describe('partial failure: mixed sent/skipped/failed', () => {
    it('2 sent + 2 skipped(missing_email) + 1 skipped(invalid_email) → COMPLETED with correct counts', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 5,
      });

      // 2 successful sends
      for (let i = 0; i < 2; i++) {
        const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
        await pipelineRepository.markJobSent(job.id);
        await statsService.incrementSent(run.id, TEST_TENANT_ID, CORR_ID);
      }

      // 2 skipped: missing email
      for (let i = 0; i < 2; i++) {
        const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
        await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
        await pipelineRepository.markJobSkipped(job.id, PipelineSkipReason.MISSING_EMAIL, 'No email');
        await statsService.incrementSkipped(run.id, TEST_TENANT_ID, CORR_ID);
      }

      // 1 skipped: invalid email
      const invalidJob = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
      await pipelineRepository.transitionJobState(invalidJob.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(invalidJob.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobSkipped(invalidJob.id, PipelineSkipReason.INVALID_EMAIL, 'Bad format');
      await statsService.incrementSkipped(run.id, TEST_TENANT_ID, CORR_ID);

      // Verify CampaignRun
      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.sentCount).toBe(2);
      expect(updatedRun!.skippedCount).toBe(3);
      expect(updatedRun!.failedCount).toBe(0);
      expect(updatedRun!.processedCount).toBe(5);
      expect(updatedRun!.status).toBe(CampaignRunStatus.COMPLETED);

      // Verify recalculateStats matches incremental counts
      const recalc = await statsService.recalculateStats(run.id);
      expect(recalc.sentCount).toBe(2);
      expect(recalc.skippedCount).toBe(3);
    });
  });

  // ============ Retry Flow ============

  describe('retry flow: retryable error → eventual success', () => {
    it('job fails attempt 1, succeeds on attempt 2', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });

      // Attempt 1: PENDING → QUEUED → PROCESSING → FAILED
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobFailed(job.id, 'SMTP timeout');

      // Retry: FAILED → RETRYING
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.RETRYING, { retryCount: 1 });

      // Attempt 2: RETRYING → PROCESSING → SENT
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobSent(job.id, 'msg-retry');
      await statsService.incrementSent(run.id, TEST_TENANT_ID, CORR_ID);

      // Verify final state
      const updatedJob = await jobRepo.findOne({ where: { id: job.id } });
      expect(updatedJob!.status).toBe(PipelineJobStatus.SENT);
      expect(updatedJob!.retryCount).toBe(1);

      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.sentCount).toBe(1);
      expect(updatedRun!.status).toBe(CampaignRunStatus.COMPLETED);
    });
  });

  // ============ Retry Exhaustion ============

  describe('retry exhaustion: retryable error → dead', () => {
    it('job fails 3 attempts then dies', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });

      // Attempt 1
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobFailed(job.id, 'Attempt 1 failed');
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.RETRYING, { retryCount: 1 });

      // Attempt 2
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobFailed(job.id, 'Attempt 2 failed');
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.RETRYING, { retryCount: 2 });

      // Attempt 3 — final failure
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobDead(job.id, 'Attempt 3 — max retries exhausted');
      await statsService.incrementFailed(run.id, TEST_TENANT_ID, CORR_ID);

      // Record failure
      await pipelineRepository.recordFailure({
        tenantId: TEST_TENANT_ID,
        jobId: job.id,
        campaignId: campaign.id,
        errorMessage: 'Max retries exhausted',
        lastStatus: PipelineJobStatus.PROCESSING,
        retryCount: 3,
      });

      // Verify final state
      const updatedJob = await jobRepo.findOne({ where: { id: job.id } });
      expect(updatedJob!.status).toBe(PipelineJobStatus.DEAD);

      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.failedCount).toBe(1);
      expect(updatedRun!.status).toBe(CampaignRunStatus.FAILED); // No sends → FAILED

      // Verify PipelineFailure record exists
      const failures = await dataSource.getRepository(PipelineFailure).find({
        where: { jobId: job.id },
      });
      expect(failures).toHaveLength(1);
      expect(failures[0].errorMessage).toBe('Max retries exhausted');
    });
  });

  // ============ Non-Retryable Error ============

  describe('non-retryable error: immediate terminal failure', () => {
    it('PROCESSING → FAILED → DEAD (no RETRYING step), failedCount incremented once', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 1,
      });

      const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });

      // Process and hit non-retryable error
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);

      // Non-retryable: handleError marks FAILED, then onFailed marks DEAD
      await pipelineRepository.markJobFailed(job.id, 'Invalid recipient');
      await pipelineRepository.markJobDead(job.id, 'Invalid recipient');

      // Stats incremented exactly once (only in onFailed)
      await statsService.incrementFailed(run.id, TEST_TENANT_ID, CORR_ID);

      // Verify transitions happened correctly
      const updatedJob = await jobRepo.findOne({ where: { id: job.id } });
      expect(updatedJob!.status).toBe(PipelineJobStatus.DEAD);

      // Verify stats
      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.failedCount).toBe(1);
      expect(updatedRun!.processedCount).toBe(1);
      expect(updatedRun!.sentCount).toBe(0);
    });
  });

  // ============ Manual Retry ============

  describe('manual retry: resurrect dead job', () => {
    it('DEAD → PENDING via state machine', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, { campaignId: campaign.id });

      const job = await createTestJob(jobRepo, {
        campaignId: campaign.id,
        campaignRunId: run.id,
        status: PipelineJobStatus.DEAD,
        errorMessage: 'Previous failure',
      });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.PENDING,
      );

      expect(updated.status).toBe(PipelineJobStatus.PENDING);
    });

    it('FAILED → PENDING via state machine', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, { campaignId: campaign.id });

      const job = await createTestJob(jobRepo, {
        campaignId: campaign.id,
        campaignRunId: run.id,
        status: PipelineJobStatus.FAILED,
      });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.PENDING,
      );

      expect(updated.status).toBe(PipelineJobStatus.PENDING);
    });
  });

  // ============ Idempotency ============

  describe('idempotency: stats counted once per terminal state', () => {
    it('3 jobs (1 sent, 1 skipped, 1 dead) → correct final counts, no double-counting', async () => {
      const campaign = await createTestCampaign(campaignRepo, { status: CampaignStatus.RUNNING });
      const run = await createTestCampaignRun(runRepo, {
        campaignId: campaign.id,
        totalRecipients: 3,
      });

      // Job 1: successful send
      const job1 = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
      await pipelineRepository.transitionJobState(job1.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job1.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobSent(job1.id);
      await statsService.incrementSent(run.id, TEST_TENANT_ID, CORR_ID);

      // Job 2: skipped
      const job2 = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
      await pipelineRepository.transitionJobState(job2.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job2.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobSkipped(job2.id, PipelineSkipReason.MISSING_EMAIL);
      await statsService.incrementSkipped(run.id, TEST_TENANT_ID, CORR_ID);

      // Job 3: dead (non-retryable)
      const job3 = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });
      await pipelineRepository.transitionJobState(job3.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job3.id, PipelineJobStatus.PROCESSING);
      await pipelineRepository.markJobFailed(job3.id, 'Invalid recipient');
      await pipelineRepository.markJobDead(job3.id, 'Invalid recipient');
      await statsService.incrementFailed(run.id, TEST_TENANT_ID, CORR_ID);

      // Verify final counts
      const updatedRun = await runRepo.findOne({ where: { id: run.id } });
      expect(updatedRun!.sentCount).toBe(1);
      expect(updatedRun!.skippedCount).toBe(1);
      expect(updatedRun!.failedCount).toBe(1);
      expect(updatedRun!.processedCount).toBe(3);
      expect(updatedRun!.status).toBe(CampaignRunStatus.COMPLETED);

      // Verify via recalculateStats
      const recalc = await statsService.recalculateStats(run.id);
      expect(recalc.sentCount).toBe(1);
      expect(recalc.skippedCount).toBe(1);
      expect(recalc.failedCount).toBe(1); // DEAD counts as failed in recalculate

      // Parent campaign should be completed
      const updatedCampaign = await campaignRepo.findOne({ where: { id: campaign.id } });
      expect(updatedCampaign!.status).toBe(CampaignStatus.COMPLETED);
    });
  });

  // ============ State Machine Enforcement Under Load ============

  describe('state machine enforcement', () => {
    it('rejects invalid transitions during flow', async () => {
      const campaign = await createTestCampaign(campaignRepo);
      const run = await createTestCampaignRun(runRepo, { campaignId: campaign.id });
      const job = await createTestJob(jobRepo, { campaignId: campaign.id, campaignRunId: run.id });

      // Valid: PENDING → QUEUED → PROCESSING
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);

      // Invalid: PROCESSING → DELIVERED (must go through SENT first)
      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.DELIVERED),
      ).rejects.toThrow('Invalid state transition');

      // Valid: PROCESSING → SENT → DELIVERED
      await pipelineRepository.markJobSent(job.id);
      await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.DELIVERED);

      const final = await jobRepo.findOne({ where: { id: job.id } });
      expect(final!.status).toBe(PipelineJobStatus.DELIVERED);

      // Terminal: DELIVERED → anything should fail
      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.FAILED),
      ).rejects.toThrow('Invalid state transition');
    });
  });
});
