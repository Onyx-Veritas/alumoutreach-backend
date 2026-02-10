/**
 * State Machine Unit Tests
 *
 * Validates the VALID_TRANSITIONS map that defines the pipeline job state machine.
 * Pure unit tests — no database, no infrastructure.
 */
import { PipelineJobStatus } from '../../src/modules/pipeline/entities/pipeline.enums';
import {
  VALID_TRANSITIONS,
  STATUS_TIMESTAMP_MAP,
} from '../../src/modules/pipeline/repositories/pipeline.repository';

describe('Pipeline State Machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('PENDING can transition to QUEUED, SKIPPED, FAILED', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.PENDING];
      expect(allowed).toContain(PipelineJobStatus.QUEUED);
      expect(allowed).toContain(PipelineJobStatus.SKIPPED);
      expect(allowed).toContain(PipelineJobStatus.FAILED);
    });

    it('QUEUED can transition to PROCESSING, SKIPPED, FAILED', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.QUEUED];
      expect(allowed).toContain(PipelineJobStatus.PROCESSING);
      expect(allowed).toContain(PipelineJobStatus.SKIPPED);
      expect(allowed).toContain(PipelineJobStatus.FAILED);
    });

    it('PROCESSING can transition to SENT, FAILED, SKIPPED, DEAD', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.PROCESSING];
      expect(allowed).toContain(PipelineJobStatus.SENT);
      expect(allowed).toContain(PipelineJobStatus.FAILED);
      expect(allowed).toContain(PipelineJobStatus.SKIPPED);
      expect(allowed).toContain(PipelineJobStatus.DEAD);
    });

    it('SENT can transition to DELIVERED, FAILED', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.SENT];
      expect(allowed).toContain(PipelineJobStatus.DELIVERED);
      expect(allowed).toContain(PipelineJobStatus.FAILED);
      expect(allowed).toHaveLength(2);
    });

    it('DELIVERED is terminal (no valid transitions)', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.DELIVERED];
      expect(allowed).toHaveLength(0);
    });

    it('FAILED can transition to RETRYING, DEAD, PENDING', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.FAILED];
      expect(allowed).toContain(PipelineJobStatus.RETRYING);
      expect(allowed).toContain(PipelineJobStatus.DEAD);
      expect(allowed).toContain(PipelineJobStatus.PENDING);
      expect(allowed).toHaveLength(3);
    });

    it('RETRYING can transition to QUEUED, PROCESSING, SENT, FAILED, DEAD', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.RETRYING];
      expect(allowed).toContain(PipelineJobStatus.QUEUED);
      expect(allowed).toContain(PipelineJobStatus.PROCESSING);
      expect(allowed).toContain(PipelineJobStatus.SENT);
      expect(allowed).toContain(PipelineJobStatus.FAILED);
      expect(allowed).toContain(PipelineJobStatus.DEAD);
      expect(allowed).toHaveLength(5);
    });

    it('DEAD can transition to PENDING (manual retry only)', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.DEAD];
      expect(allowed).toContain(PipelineJobStatus.PENDING);
      expect(allowed).toHaveLength(1);
    });

    it('SKIPPED is terminal (no valid transitions)', () => {
      const allowed = VALID_TRANSITIONS[PipelineJobStatus.SKIPPED];
      expect(allowed).toHaveLength(0);
    });

    it('every PipelineJobStatus has an entry in VALID_TRANSITIONS', () => {
      const allStatuses = Object.values(PipelineJobStatus);
      for (const status of allStatuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('no status can transition to itself', () => {
      const allStatuses = Object.values(PipelineJobStatus);
      for (const status of allStatuses) {
        expect(VALID_TRANSITIONS[status]).not.toContain(status);
      }
    });

    it('terminal states have empty or single-escape transition arrays', () => {
      // DELIVERED and SKIPPED are pure terminal states
      expect(VALID_TRANSITIONS[PipelineJobStatus.DELIVERED]).toHaveLength(0);
      expect(VALID_TRANSITIONS[PipelineJobStatus.SKIPPED]).toHaveLength(0);

      // DEAD is semi-terminal — allows manual retry to PENDING only
      const deadTransitions = VALID_TRANSITIONS[PipelineJobStatus.DEAD];
      expect(deadTransitions).toHaveLength(1);
      expect(deadTransitions[0]).toBe(PipelineJobStatus.PENDING);
    });

    it('all transitions form valid directed graph edges (no transitions to undefined statuses)', () => {
      const allStatuses = new Set(Object.values(PipelineJobStatus));
      for (const [from, toList] of Object.entries(VALID_TRANSITIONS)) {
        expect(allStatuses.has(from as PipelineJobStatus)).toBe(true);
        for (const to of toList) {
          expect(allStatuses.has(to)).toBe(true);
        }
      }
    });
  });

  describe('STATUS_TIMESTAMP_MAP', () => {
    it('maps QUEUED to queuedAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.QUEUED]).toBe('queuedAt');
    });

    it('maps PROCESSING to processingAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.PROCESSING]).toBe('processingAt');
    });

    it('maps SENT to sentAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.SENT]).toBe('sentAt');
    });

    it('maps DELIVERED to deliveredAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.DELIVERED]).toBe('deliveredAt');
    });

    it('maps FAILED to failedAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.FAILED]).toBe('failedAt');
    });

    it('maps SKIPPED to skippedAt', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.SKIPPED]).toBe('skippedAt');
    });

    it('does not map PENDING, RETRYING, or DEAD (no dedicated timestamps)', () => {
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.PENDING]).toBeUndefined();
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.RETRYING]).toBeUndefined();
      expect(STATUS_TIMESTAMP_MAP[PipelineJobStatus.DEAD]).toBeUndefined();
    });
  });
});
