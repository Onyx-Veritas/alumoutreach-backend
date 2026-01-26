import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { SegmentRepository } from '../repositories/segment.repository';
import { Segment } from '../entities/segment.entity';
import { SegmentEventType } from '../../../common/events/segment.events';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface RefreshJobResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
  batchId: string;
}

export interface SegmentRefreshResult {
  segmentId: string;
  success: boolean;
  previousCount?: number;
  newCount?: number;
  addedCount?: number;
  removedCount?: number;
  durationMs?: number;
  error?: string;
}

@Injectable()
export class SegmentRefreshJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLoggerService;
  private isRunning = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly segmentRepository: SegmentRepository,
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentRefreshJobService');
  }

  onModuleInit(): void {
    this.startRefreshTimer();
  }

  onModuleDestroy(): void {
    this.stopRefreshTimer();
  }

  private startRefreshTimer(): void {
    this.logger.log('Starting segment refresh timer', { intervalMs: REFRESH_INTERVAL_MS });
    this.refreshTimer = setInterval(() => {
      this.handleSegmentRefresh().catch((err) => {
        this.logger.error('Unhandled error in segment refresh', (err as Error).stack, {
          errorMessage: (err as Error).message,
        });
      });
    }, REFRESH_INTERVAL_MS);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      this.logger.log('Stopped segment refresh timer');
    }
  }

  /**
   * Scheduled job to refresh dynamic segments
   * Runs every 5 minutes to check for segments needing refresh
   */
  async handleSegmentRefresh(): Promise<void> {
    // Prevent overlapping runs
    if (this.isRunning) {
      this.logger.warn('Segment refresh job already running, skipping this run');
      return;
    }

    this.isRunning = true;
    const batchId = uuidv4();
    const startTime = this.logger.logOperationStart('segment refresh job', { batchId });

    try {
      const result = await this.refreshDueSegments(batchId);

      this.logger.logOperationEnd('segment refresh job', startTime, {
        batchId,
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        durationMs: result.durationMs,
      });
    } catch (error) {
      this.logger.error('Segment refresh job failed', (error as Error).stack, {
        batchId,
        errorMessage: (error as Error).message,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for refreshing all due segments
   */
  async refreshDueSegments(batchId?: string): Promise<RefreshJobResult> {
    const startTime = Date.now();
    const effectiveBatchId = batchId || uuidv4();

    this.logger.log('Starting segment refresh cycle', { batchId: effectiveBatchId });

    // Find segments needing refresh
    const segmentsToRefresh = await this.segmentRepository.findSegmentsNeedingRefresh();

    if (segmentsToRefresh.length === 0) {
      this.logger.log('No segments need refresh', { batchId: effectiveBatchId });
      return {
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        durationMs: Date.now() - startTime,
        batchId: effectiveBatchId,
      };
    }

    this.logger.log(`Found ${segmentsToRefresh.length} segments to refresh`, {
      batchId: effectiveBatchId,
      segmentIds: segmentsToRefresh.map(s => s.id),
    });

    // Process segments sequentially to avoid overloading the database
    const results: SegmentRefreshResult[] = [];
    for (const segment of segmentsToRefresh) {
      const result = await this.refreshSegment(segment, effectiveBatchId);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      processedCount: results.length,
      successCount,
      failureCount,
      durationMs: Date.now() - startTime,
      batchId: effectiveBatchId,
    };
  }

  /**
   * Refresh a single segment
   */
  async refreshSegment(segment: Segment, batchId: string): Promise<SegmentRefreshResult> {
    const startTime = this.logger.logOperationStart('refresh segment', {
      segmentId: segment.id,
      segmentName: segment.name,
      batchId,
    });

    try {
      if (!segment.rules) {
        this.logger.warn('Segment has no rules, skipping', {
          segmentId: segment.id,
          batchId,
        });
        return {
          segmentId: segment.id,
          success: false,
          error: 'Segment has no rules',
        };
      }

      // Recompute membership
      const result = await this.segmentRepository.recomputeMembers(
        segment.tenantId,
        segment.id,
        segment.rules,
        batchId,
      );

      // Update next refresh time
      if (segment.refreshIntervalMinutes) {
        await this.segmentRepository.updateNextRefreshTime(
          segment.tenantId,
          segment.id,
          segment.refreshIntervalMinutes,
        );
      }

      // Publish refresh event
      await this.publishRefreshEvent(segment, result, batchId);

      this.logger.logOperationEnd('refresh segment', startTime, {
        segmentId: segment.id,
        previousCount: result.previousCount,
        newCount: result.newCount,
        addedCount: result.addedCount,
        removedCount: result.removedCount,
      });

      return {
        segmentId: segment.id,
        success: true,
        previousCount: result.previousCount,
        newCount: result.newCount,
        addedCount: result.addedCount,
        removedCount: result.removedCount,
        durationMs: result.durationMs,
      };
    } catch (error) {
      this.logger.error('Failed to refresh segment', (error as Error).stack, {
        segmentId: segment.id,
        batchId,
        errorMessage: (error as Error).message,
      });

      return {
        segmentId: segment.id,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Manually trigger refresh for a specific segment
   */
  async triggerRefresh(tenantId: string, segmentId: string): Promise<SegmentRefreshResult> {
    const batchId = uuidv4();
    this.logger.log('Manually triggering segment refresh', { tenantId, segmentId, batchId });

    const segment = await this.segmentRepository.findById(tenantId, segmentId);
    if (!segment) {
      return {
        segmentId,
        success: false,
        error: 'Segment not found',
      };
    }

    return this.refreshSegment(segment, batchId);
  }

  // ============ Event Publishing ============

  private async publishRefreshEvent(
    segment: Segment,
    result: {
      previousCount: number;
      newCount: number;
      addedCount: number;
      removedCount: number;
      durationMs: number;
      batchId: string;
    },
    batchId: string,
  ): Promise<void> {
    try {
      const payload = {
        eventId: uuidv4(),
        eventType: SegmentEventType.SEGMENT_REFRESHED,
        timestamp: new Date().toISOString(),
        tenantId: segment.tenantId,
        payload: {
          segmentId: segment.id,
          name: segment.name,
          previousCount: result.previousCount,
          newCount: result.newCount,
          addedCount: result.addedCount,
          removedCount: result.removedCount,
          durationMs: result.durationMs,
          batchId,
        },
      };

      await this.natsClient.emit(SegmentEventType.SEGMENT_REFRESHED, payload).toPromise();

      this.logger.debug('Published segment refresh event', {
        segmentId: segment.id,
        batchId,
      });
    } catch (error) {
      this.logger.error('Failed to publish segment refresh event', (error as Error).stack, {
        segmentId: segment.id,
        batchId,
        errorMessage: (error as Error).message,
      });
    }
  }
}
