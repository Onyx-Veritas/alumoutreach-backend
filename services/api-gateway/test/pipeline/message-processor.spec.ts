/**
 * Message Processor Unit Tests
 *
 * Tests error handling, skip logic, and BullMQ event handlers
 * using mocked dependencies. No database required.
 */
import { UnrecoverableError, Job } from 'bullmq';
import { PipelineJobStatus, PipelineSkipReason, PipelineChannel } from '../../src/modules/pipeline/entities/pipeline.enums';
import { MessageProcessor } from '../../src/modules/queue/processors/message.processor';
import { PipelineJobData, JobExecutionResult } from '../../src/modules/queue/interfaces';
import {
  InvalidRecipientError,
  TemplateNotFoundError,
  ContactNotFoundError,
  PipelineJobNotFoundError,
  SendFailedError,
} from '../../src/modules/queue/errors';

// ============ Mock Factories ============

function createMockPipelineRepository() {
  return {
    findJobById: jest.fn(),
    transitionJobState: jest.fn(),
    markJobSent: jest.fn(),
    markJobFailed: jest.fn(),
    markJobSkipped: jest.fn(),
    markJobDead: jest.fn(),
    scheduleRetry: jest.fn(),
    recordFailure: jest.fn(),
  };
}

function createMockContactRepository() {
  return {
    findById: jest.fn(),
  };
}

function createMockTemplateService() {
  return {
    renderForPipeline: jest.fn(),
  };
}

function createMockChannelRegistry() {
  return {
    getSender: jest.fn(),
  };
}

function createMockEventBus() {
  return {
    publish: jest.fn(),
  };
}

function createMockCampaignStatsService() {
  return {
    incrementSent: jest.fn(),
    incrementFailed: jest.fn(),
    incrementSkipped: jest.fn(),
  };
}

function createJobData(overrides: Partial<PipelineJobData> = {}): PipelineJobData {
  return {
    jobId: 'job-001',
    tenantId: 'tenant-001',
    correlationId: 'corr-001',
    campaignId: 'campaign-001',
    campaignRunId: 'run-001',
    contactId: 'contact-001',
    channel: PipelineChannel.EMAIL,
    templateVersionId: 'tpl-v1',
    ...overrides,
  };
}

function createMockBullJob(
  data: PipelineJobData,
  overrides: Partial<Job<PipelineJobData>> = {},
): Job<PipelineJobData> {
  return {
    data,
    id: data.jobId,
    attemptsMade: 1,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job<PipelineJobData>;
}

function createProcessor(mocks: {
  pipelineRepository: ReturnType<typeof createMockPipelineRepository>;
  contactRepository: ReturnType<typeof createMockContactRepository>;
  templateService: ReturnType<typeof createMockTemplateService>;
  channelRegistry: ReturnType<typeof createMockChannelRegistry>;
  eventBus: ReturnType<typeof createMockEventBus>;
  campaignStatsService: ReturnType<typeof createMockCampaignStatsService>;
}): MessageProcessor {
  // Use Object.create to avoid calling the WorkerHost constructor (which needs BullMQ)
  const processor = Object.create(MessageProcessor.prototype);
  // Assign private properties that the constructor would set
  (processor as any).pipelineRepository = mocks.pipelineRepository;
  (processor as any).contactRepository = mocks.contactRepository;
  (processor as any).pipelineTemplateService = mocks.templateService;
  (processor as any).channelRegistry = mocks.channelRegistry;
  (processor as any).eventBus = mocks.eventBus;
  (processor as any).campaignStatsService = mocks.campaignStatsService;
  // Create a minimal logger
  (processor as any).logger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    setContext: jest.fn(),
    logOperationStart: jest.fn(() => Date.now()),
    logOperationEnd: jest.fn(),
  };
  return processor;
}

// ============ Tests ============

describe('MessageProcessor', () => {
  let mocks: {
    pipelineRepository: ReturnType<typeof createMockPipelineRepository>;
    contactRepository: ReturnType<typeof createMockContactRepository>;
    templateService: ReturnType<typeof createMockTemplateService>;
    channelRegistry: ReturnType<typeof createMockChannelRegistry>;
    eventBus: ReturnType<typeof createMockEventBus>;
    campaignStatsService: ReturnType<typeof createMockCampaignStatsService>;
  };
  let processor: MessageProcessor;

  beforeEach(() => {
    mocks = {
      pipelineRepository: createMockPipelineRepository(),
      contactRepository: createMockContactRepository(),
      templateService: createMockTemplateService(),
      channelRegistry: createMockChannelRegistry(),
      eventBus: createMockEventBus(),
      campaignStatsService: createMockCampaignStatsService(),
    };
    processor = createProcessor(mocks);
  });

  // ============ handleError (tested via execute) ============

  describe('handleError (non-retryable errors)', () => {
    it('InvalidRecipientError → marks FAILED, throws UnrecoverableError', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        status: PipelineJobStatus.PROCESSING,
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      mocks.contactRepository.findById.mockResolvedValue({
        id: 'contact-001',
        email: 'test@example.com',
        attributes: [],
      });
      mocks.templateService.renderForPipeline.mockResolvedValue({ content: {} });

      const mockSender = {
        validateRecipient: jest.fn().mockReturnValue({ valid: false, error: 'Bad recipient' }),
        send: jest.fn(),
      };
      mocks.channelRegistry.getSender.mockReturnValue(mockSender);

      // InvalidRecipientError is thrown when validateRecipient returns {valid: false}
      // The processor catches it in handleError and throws UnrecoverableError
      await expect(processor.execute(jobData, 1)).rejects.toThrow(UnrecoverableError);

      expect(mocks.pipelineRepository.markJobFailed).toHaveBeenCalledWith('job-001', expect.any(String));
    });

    it('PipelineJobNotFoundError → does NOT call markJobFailed, throws UnrecoverableError', async () => {
      const jobData = createJobData();

      mocks.pipelineRepository.findJobById.mockResolvedValue(null); // Job not found

      await expect(processor.execute(jobData, 1)).rejects.toThrow(UnrecoverableError);

      expect(mocks.pipelineRepository.markJobFailed).not.toHaveBeenCalled();
    });

    it('SendFailedError → re-throws original error (BullMQ will retry)', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        status: PipelineJobStatus.PROCESSING,
        payload: {},
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      mocks.contactRepository.findById.mockResolvedValue({
        id: 'contact-001',
        email: 'test@example.com',
        attributes: [],
      });
      mocks.templateService.renderForPipeline.mockResolvedValue({ content: {} });

      const mockSender = {
        validateRecipient: jest.fn().mockReturnValue({ valid: true }),
        send: jest.fn().mockResolvedValue({ success: false, error: 'SMTP timeout' }),
      };
      mocks.channelRegistry.getSender.mockReturnValue(mockSender);

      // SendFailedError is a retryable error — should be re-thrown directly, not wrapped
      await expect(processor.execute(jobData, 1)).rejects.toThrow(SendFailedError);

      // Should NOT mark as failed (BullMQ handles retry logic)
      expect(mocks.pipelineRepository.markJobFailed).not.toHaveBeenCalled();
    });
  });

  // ============ Skip handling ============

  describe('process - skip handling', () => {
    it('missing email → marks SKIPPED with MISSING_EMAIL, increments skippedCount', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        status: PipelineJobStatus.PROCESSING,
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      // Contact with no email
      mocks.contactRepository.findById.mockResolvedValue({
        id: 'contact-001',
        email: null,
        attributes: [],
      });

      const result = await processor.execute(jobData, 1);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe(PipelineSkipReason.MISSING_EMAIL);
      expect(mocks.pipelineRepository.markJobSkipped).toHaveBeenCalledWith(
        'job-001',
        PipelineSkipReason.MISSING_EMAIL,
        expect.any(String),
      );
      expect(mocks.campaignStatsService.incrementSkipped).toHaveBeenCalledWith('run-001', 'tenant-001', 'corr-001');
      // Skip should NOT increment failed
      expect(mocks.campaignStatsService.incrementFailed).not.toHaveBeenCalled();
    });

    it('invalid email format → marks SKIPPED with INVALID_EMAIL', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        status: PipelineJobStatus.PROCESSING,
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      mocks.contactRepository.findById.mockResolvedValue({
        id: 'contact-001',
        email: 'not-an-email',
        attributes: [],
      });

      const result = await processor.execute(jobData, 1);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe(PipelineSkipReason.INVALID_EMAIL);
      expect(mocks.pipelineRepository.markJobSkipped).toHaveBeenCalledWith(
        'job-001',
        PipelineSkipReason.INVALID_EMAIL,
        expect.any(String),
      );
    });

    it('contact not found → marks SKIPPED with CONTACT_NOT_FOUND', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        status: PipelineJobStatus.PROCESSING,
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      mocks.contactRepository.findById.mockResolvedValue(null); // Contact not found

      const result = await processor.execute(jobData, 1);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe(PipelineSkipReason.CONTACT_NOT_FOUND);
    });
  });

  // ============ onFailed ============

  describe('onFailed', () => {
    it('UnrecoverableError → isLastAttempt=true, calls markJobDead + incrementFailed once', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, { attemptsMade: 1 }); // Only 1 of 3 attempts
      const error = new UnrecoverableError('Non-retryable failure');

      await processor.onFailed(bullJob, error);

      expect(mocks.pipelineRepository.markJobDead).toHaveBeenCalledWith('job-001', 'Non-retryable failure');
      expect(mocks.campaignStatsService.incrementFailed).toHaveBeenCalledTimes(1);
      expect(mocks.campaignStatsService.incrementFailed).toHaveBeenCalledWith('run-001', 'tenant-001', 'corr-001');
    });

    it('error.name=UnrecoverableError → isLastAttempt=true (deserialization case)', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, { attemptsMade: 1 });
      // Simulate deserialized error where instanceof doesn't work
      const error = new Error('Deserialized failure');
      error.name = 'UnrecoverableError';

      await processor.onFailed(bullJob, error);

      expect(mocks.pipelineRepository.markJobDead).toHaveBeenCalled();
      expect(mocks.campaignStatsService.incrementFailed).toHaveBeenCalledTimes(1);
    });

    it('last attempt (attemptsMade >= maxAttempts) → calls markJobDead + incrementFailed', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, {
        attemptsMade: 3, // matches maxAttempts
        opts: { attempts: 3 } as any,
      });
      const error = new Error('Retryable but exhausted');

      await processor.onFailed(bullJob, error);

      expect(mocks.pipelineRepository.markJobDead).toHaveBeenCalledWith('job-001', 'Retryable but exhausted');
      expect(mocks.campaignStatsService.incrementFailed).toHaveBeenCalledTimes(1);
    });

    it('non-last attempt → calls transitionJobState(RETRYING), does NOT call incrementFailed', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, {
        attemptsMade: 1, // 1 of 3
        opts: { attempts: 3 } as any,
      });
      const error = new Error('Retryable failure');

      await processor.onFailed(bullJob, error);

      expect(mocks.pipelineRepository.transitionJobState).toHaveBeenCalledWith(
        'job-001',
        PipelineJobStatus.RETRYING,
        { retryCount: 1 },
      );
      expect(mocks.pipelineRepository.markJobDead).not.toHaveBeenCalled();
      expect(mocks.campaignStatsService.incrementFailed).not.toHaveBeenCalled();
    });

    it('publishes JOB_DEAD event on last attempt', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, { attemptsMade: 3, opts: { attempts: 3 } as any });
      const error = new Error('Final failure');

      await processor.onFailed(bullJob, error);

      expect(mocks.eventBus.publish).toHaveBeenCalledWith(
        expect.stringContaining('dead'),
        expect.objectContaining({
          eventType: expect.stringContaining('dead'),
        }),
        expect.any(Object),
      );
    });

    it('publishes JOB_RETRYING event on non-last attempt', async () => {
      const jobData = createJobData();
      const bullJob = createMockBullJob(jobData, { attemptsMade: 1, opts: { attempts: 3 } as any });
      const error = new Error('Will retry');

      await processor.onFailed(bullJob, error);

      expect(mocks.eventBus.publish).toHaveBeenCalledWith(
        expect.stringContaining('retrying'),
        expect.objectContaining({
          eventType: expect.stringContaining('retrying'),
        }),
        expect.any(Object),
      );
    });
  });

  // ============ Success path ============

  describe('execute - success path', () => {
    it('successful send → marks SENT, increments sentCount, returns success', async () => {
      const jobData = createJobData();
      const mockJob = {
        id: 'job-001',
        campaignId: 'campaign-001',
        campaignRunId: 'run-001',
        contactId: 'contact-001',
        status: PipelineJobStatus.PROCESSING,
        payload: {},
      };

      mocks.pipelineRepository.findJobById.mockResolvedValue(mockJob);
      mocks.pipelineRepository.transitionJobState.mockResolvedValue({ ...mockJob, status: PipelineJobStatus.PROCESSING });
      mocks.contactRepository.findById.mockResolvedValue({
        id: 'contact-001',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        attributes: [],
      });
      mocks.templateService.renderForPipeline.mockResolvedValue({
        content: { subject: 'Hello', htmlBody: '<p>Hi</p>' },
      });

      const mockSender = {
        validateRecipient: jest.fn().mockReturnValue({ valid: true }),
        send: jest.fn().mockResolvedValue({ success: true, providerMessageId: 'msg-abc' }),
      };
      mocks.channelRegistry.getSender.mockReturnValue(mockSender);

      const result = await processor.execute(jobData, 1);

      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBe('msg-abc');
      expect(mocks.pipelineRepository.markJobSent).toHaveBeenCalledWith('job-001', 'msg-abc');
      expect(mocks.campaignStatsService.incrementSent).toHaveBeenCalledWith('run-001', 'tenant-001', 'corr-001');
    });
  });
});
