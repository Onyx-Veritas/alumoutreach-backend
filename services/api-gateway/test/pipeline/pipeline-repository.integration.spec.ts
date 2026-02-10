/**
 * Pipeline Repository Integration Tests
 *
 * Tests state machine transitions, convenience methods, and query methods
 * against a real PostgreSQL test database.
 */
import { DataSource, Repository } from 'typeorm';
import { PipelineJob } from '../../src/modules/pipeline/entities/pipeline-job.entity';
import { PipelineFailure } from '../../src/modules/pipeline/entities/pipeline-failure.entity';
import { PipelineJobStatus, PipelineSkipReason, PipelineChannel } from '../../src/modules/pipeline/entities/pipeline.enums';
import {
  PipelineRepository,
  InvalidStateTransitionError,
} from '../../src/modules/pipeline/repositories/pipeline.repository';
import { getTestDataSource, closeTestDataSource, cleanDatabase } from '../setup/test-database';
import { createTestJob, TEST_TENANT_ID } from '../setup/test-helpers';

describe('PipelineRepository (Integration)', () => {
  let dataSource: DataSource;
  let jobRepo: Repository<PipelineJob>;
  let failureRepo: Repository<PipelineFailure>;
  let pipelineRepository: PipelineRepository;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    jobRepo = dataSource.getRepository(PipelineJob);
    failureRepo = dataSource.getRepository(PipelineFailure);
    // Manually instantiate PipelineRepository with the real repositories
    pipelineRepository = new PipelineRepository(jobRepo, failureRepo);
  });

  afterAll(async () => {
    await closeTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  // ============ transitionJobState ============

  describe('transitionJobState', () => {
    it('PENDING → QUEUED: succeeds and sets queuedAt', async () => {
      const job = await createTestJob(jobRepo);

      const updated = await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.QUEUED);

      expect(updated.status).toBe(PipelineJobStatus.QUEUED);
      expect(updated.queuedAt).toBeInstanceOf(Date);
    });

    it('QUEUED → PROCESSING: succeeds and sets processingAt', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.QUEUED });

      const updated = await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING);

      expect(updated.status).toBe(PipelineJobStatus.PROCESSING);
      expect(updated.processingAt).toBeInstanceOf(Date);
    });

    it('PROCESSING → SENT: succeeds, sets sentAt, stores providerMessageId', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.SENT,
        { providerMessageId: 'msg-123' },
      );

      expect(updated.status).toBe(PipelineJobStatus.SENT);
      expect(updated.sentAt).toBeInstanceOf(Date);
      expect(updated.providerMessageId).toBe('msg-123');
    });

    it('SENT → DELIVERED: succeeds and sets deliveredAt', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.SENT });

      const updated = await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.DELIVERED);

      expect(updated.status).toBe(PipelineJobStatus.DELIVERED);
      expect(updated.deliveredAt).toBeInstanceOf(Date);
    });

    it('PROCESSING → FAILED: succeeds, sets failedAt, stores errorMessage', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.FAILED,
        { errorMessage: 'Connection refused' },
      );

      expect(updated.status).toBe(PipelineJobStatus.FAILED);
      expect(updated.failedAt).toBeInstanceOf(Date);
      expect(updated.errorMessage).toBe('Connection refused');
    });

    it('FAILED → RETRYING: succeeds with retryCount', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.FAILED });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.RETRYING,
        { retryCount: 1 },
      );

      expect(updated.status).toBe(PipelineJobStatus.RETRYING);
      expect(updated.retryCount).toBe(1);
    });

    it('RETRYING → DEAD: succeeds and stores errorMessage', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.RETRYING });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.DEAD,
        { errorMessage: 'Max retries exhausted' },
      );

      expect(updated.status).toBe(PipelineJobStatus.DEAD);
      expect(updated.errorMessage).toBe('Max retries exhausted');
    });

    it('DEAD → PENDING: succeeds (manual retry)', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.DEAD });

      const updated = await pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PENDING);

      expect(updated.status).toBe(PipelineJobStatus.PENDING);
    });

    it('PROCESSING → SKIPPED: succeeds, stores skipReason, sets skippedAt', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.SKIPPED,
        { skipReason: PipelineSkipReason.MISSING_EMAIL, errorMessage: 'No email' },
      );

      expect(updated.status).toBe(PipelineJobStatus.SKIPPED);
      expect(updated.skippedAt).toBeInstanceOf(Date);
      expect(updated.skipReason).toBe(PipelineSkipReason.MISSING_EMAIL);
      expect(updated.errorMessage).toBe('No email');
    });

    it('PROCESSING → DEAD: succeeds (max retries exhausted during processing)', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.transitionJobState(
        job.id,
        PipelineJobStatus.DEAD,
        { errorMessage: 'Final failure' },
      );

      expect(updated.status).toBe(PipelineJobStatus.DEAD);
    });

    it('invalid transition PENDING → SENT: throws InvalidStateTransitionError', async () => {
      const job = await createTestJob(jobRepo);

      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.SENT),
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('invalid transition SENT → PROCESSING: throws InvalidStateTransitionError', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.SENT });

      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PROCESSING),
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('invalid transition DELIVERED → any: throws InvalidStateTransitionError', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.DELIVERED });

      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.FAILED),
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('invalid transition SKIPPED → any: throws InvalidStateTransitionError', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.SKIPPED });

      await expect(
        pipelineRepository.transitionJobState(job.id, PipelineJobStatus.PENDING),
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('non-existent job: throws Error', async () => {
      await expect(
        pipelineRepository.transitionJobState('non-existent-uuid', PipelineJobStatus.QUEUED),
      ).rejects.toThrow('Job not found');
    });
  });

  // ============ Convenience Methods ============

  describe('markJobSent', () => {
    it('transitions to SENT and stores providerMessageId', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobSent(job.id, 'provider-abc');

      expect(updated.status).toBe(PipelineJobStatus.SENT);
      expect(updated.providerMessageId).toBe('provider-abc');
      expect(updated.sentAt).toBeInstanceOf(Date);
    });

    it('works without providerMessageId', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobSent(job.id);

      expect(updated.status).toBe(PipelineJobStatus.SENT);
    });

    it('throws on invalid source state', async () => {
      const job = await createTestJob(jobRepo); // PENDING

      await expect(pipelineRepository.markJobSent(job.id)).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('markJobFailed', () => {
    it('transitions to FAILED and stores errorMessage', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobFailed(job.id, 'Timeout');

      expect(updated.status).toBe(PipelineJobStatus.FAILED);
      expect(updated.errorMessage).toBe('Timeout');
      expect(updated.failedAt).toBeInstanceOf(Date);
    });

    it('throws on invalid source state (DELIVERED)', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.DELIVERED });

      await expect(
        pipelineRepository.markJobFailed(job.id, 'error'),
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('markJobSkipped', () => {
    it('transitions to SKIPPED with skipReason', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobSkipped(
        job.id,
        PipelineSkipReason.INVALID_EMAIL,
        'bad format',
      );

      expect(updated.status).toBe(PipelineJobStatus.SKIPPED);
      expect(updated.skipReason).toBe(PipelineSkipReason.INVALID_EMAIL);
      expect(updated.errorMessage).toBe('bad format');
      expect(updated.skippedAt).toBeInstanceOf(Date);
    });

    it('works without errorMessage', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobSkipped(job.id, PipelineSkipReason.MISSING_EMAIL);

      expect(updated.status).toBe(PipelineJobStatus.SKIPPED);
      expect(updated.skipReason).toBe(PipelineSkipReason.MISSING_EMAIL);
    });
  });

  describe('markJobDead', () => {
    it('transitions to DEAD and stores errorMessage', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const updated = await pipelineRepository.markJobDead(job.id, 'Exhausted retries');

      expect(updated.status).toBe(PipelineJobStatus.DEAD);
      expect(updated.errorMessage).toBe('Exhausted retries');
    });

    it('also works from FAILED state', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.FAILED });

      const updated = await pipelineRepository.markJobDead(job.id, 'No more retries');

      expect(updated.status).toBe(PipelineJobStatus.DEAD);
    });

    it('also works from RETRYING state', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.RETRYING });

      const updated = await pipelineRepository.markJobDead(job.id, 'Exhausted');

      expect(updated.status).toBe(PipelineJobStatus.DEAD);
    });
  });

  // ============ scheduleRetry ============

  describe('scheduleRetry', () => {
    it('transitions to RETRYING, sets nextAttemptAt, increments retryCount', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.FAILED, retryCount: 0 });
      const nextAttempt = new Date(Date.now() + 5000);

      const updated = await pipelineRepository.scheduleRetry(job.id, nextAttempt);

      expect(updated.status).toBe(PipelineJobStatus.RETRYING);
      expect(updated.retryCount).toBe(1);
      expect(updated.nextAttemptAt).toBeInstanceOf(Date);
    });

    it('preserves retryCount when incrementRetry=false', async () => {
      const job = await createTestJob(jobRepo, { status: PipelineJobStatus.FAILED, retryCount: 2 });
      const nextAttempt = new Date(Date.now() + 5000);

      const updated = await pipelineRepository.scheduleRetry(job.id, nextAttempt, false);

      expect(updated.status).toBe(PipelineJobStatus.RETRYING);
      expect(updated.retryCount).toBe(2); // Not incremented
    });

    it('throws on invalid source state (PENDING)', async () => {
      const job = await createTestJob(jobRepo); // PENDING

      await expect(
        pipelineRepository.scheduleRetry(job.id, new Date()),
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  // ============ acquireNextJob ============

  describe('acquireNextJob', () => {
    it('returns oldest PENDING job and marks PROCESSING', async () => {
      // Create two jobs — should acquire the older one
      const older = await createTestJob(jobRepo);
      // Small delay to ensure ordering
      await new Promise(r => setTimeout(r, 10));
      const newer = await createTestJob(jobRepo);

      const acquired = await pipelineRepository.acquireNextJob();

      expect(acquired).not.toBeNull();
      expect(acquired!.id).toBe(older.id);
      expect(acquired!.status).toBe(PipelineJobStatus.PROCESSING);
    });

    it('returns null when no PENDING jobs exist', async () => {
      await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });

      const acquired = await pipelineRepository.acquireNextJob();

      expect(acquired).toBeNull();
    });

    it('skips already-processing jobs', async () => {
      await createTestJob(jobRepo, { status: PipelineJobStatus.PROCESSING });
      const pending = await createTestJob(jobRepo);

      const acquired = await pipelineRepository.acquireNextJob();

      expect(acquired).not.toBeNull();
      expect(acquired!.id).toBe(pending.id);
    });
  });

  // ============ findRetryableJobs ============

  describe('findRetryableJobs', () => {
    it('returns FAILED jobs with retryCount <= maxRetries and past nextAttemptAt', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await createTestJob(jobRepo, {
        status: PipelineJobStatus.FAILED,
        retryCount: 1,
        nextAttemptAt: pastDate,
      });

      const retryable = await pipelineRepository.findRetryableJobs(3, 100);

      expect(retryable).toHaveLength(1);
      expect(retryable[0].status).toBe(PipelineJobStatus.FAILED);
    });

    it('excludes DEAD jobs', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await createTestJob(jobRepo, {
        status: PipelineJobStatus.DEAD,
        retryCount: 1,
        nextAttemptAt: pastDate,
      });

      const retryable = await pipelineRepository.findRetryableJobs(3, 100);

      expect(retryable).toHaveLength(0);
    });

    it('excludes jobs whose nextAttemptAt is in the future', async () => {
      const futureDate = new Date(Date.now() + 60000);
      await createTestJob(jobRepo, {
        status: PipelineJobStatus.FAILED,
        retryCount: 1,
        nextAttemptAt: futureDate,
      });

      const retryable = await pipelineRepository.findRetryableJobs(3, 100);

      expect(retryable).toHaveLength(0);
    });

    it('limits results to specified batch size', async () => {
      const pastDate = new Date(Date.now() - 60000);
      for (let i = 0; i < 5; i++) {
        await createTestJob(jobRepo, {
          status: PipelineJobStatus.FAILED,
          retryCount: 0,
          nextAttemptAt: pastDate,
        });
      }

      const retryable = await pipelineRepository.findRetryableJobs(3, 2);

      expect(retryable).toHaveLength(2);
    });
  });

  // ============ recordFailure ============

  describe('recordFailure', () => {
    it('creates PipelineFailure record with correct data', async () => {
      const job = await createTestJob(jobRepo);

      const failure = await pipelineRepository.recordFailure({
        tenantId: TEST_TENANT_ID,
        jobId: job.id,
        campaignId: job.campaignId,
        contactId: job.contactId,
        errorMessage: 'SMTP timeout',
        lastStatus: PipelineJobStatus.PROCESSING,
        retryCount: 2,
      });

      expect(failure.id).toBeDefined();
      expect(failure.jobId).toBe(job.id);
      expect(failure.errorMessage).toBe('SMTP timeout');
      expect(failure.lastStatus).toBe(PipelineJobStatus.PROCESSING);
      expect(failure.retryCount).toBe(2);
      expect(failure.createdAt).toBeInstanceOf(Date);
    });
  });

  // ============ isValidTransition ============

  describe('isValidTransition', () => {
    it('returns true for valid transitions', () => {
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.PENDING, PipelineJobStatus.QUEUED)).toBe(true);
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.PROCESSING, PipelineJobStatus.SENT)).toBe(true);
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.DEAD, PipelineJobStatus.PENDING)).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.PENDING, PipelineJobStatus.SENT)).toBe(false);
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.DELIVERED, PipelineJobStatus.FAILED)).toBe(false);
      expect(pipelineRepository.isValidTransition(PipelineJobStatus.SKIPPED, PipelineJobStatus.PENDING)).toBe(false);
    });
  });
});
