import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { AnalyticsMapper } from '../mappers/analytics.mapper';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_SOURCE_SUBJECTS,
  SourceEventPayload,
} from '../events/analytics.events';
import { AnalyticsEvent } from '../entities/analytics.schema';

/**
 * Analytics Sync Service
 * Ingests NATS events and normalizes into ClickHouse
 */
@Injectable()
export class AnalyticsSyncService implements OnModuleInit, OnModuleDestroy {
  private eventBuffer: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly eventBus: EventBusService,
    private readonly repository: AnalyticsRepository,
    private readonly mapper: AnalyticsMapper,
  ) {
    this.logger.setContext('AnalyticsSyncService');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AnalyticsSyncService initializing');

    // Start flush interval
    this.flushInterval = setInterval(() => {
      this.flushBuffer().catch((err) => {
        this.logger.error(
          'Error flushing buffer',
          err instanceof Error ? err.stack : String(err),
        );
      });
    }, this.FLUSH_INTERVAL_MS);

    this.logger.log(
      `AnalyticsSyncService initialized, ready to ingest ${ANALYTICS_SOURCE_SUBJECTS.length} event types`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    // Stop flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining events
    await this.flushBuffer();

    this.logger.log('AnalyticsSyncService destroyed');
  }

  /**
   * Ingest a single event (called by other services or event handlers)
   */
  async ingestEvent(
    eventType: string,
    payload: SourceEventPayload,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate required fields
      if (!payload.tenantId) {
        this.logger.warn('Skipping event without tenantId', { eventType });
        return;
      }

      // Map to analytics event
      const analyticsEvent = this.mapper.mapSourceEvent(eventType, payload);

      // Add to buffer
      this.eventBuffer.push(analyticsEvent);

      this.logger.debug('[EVENT] Ingested analytics event', {
        eventType,
        entityId: analyticsEvent.entityId,
        tenantId: analyticsEvent.tenantId,
        bufferSize: this.eventBuffer.length,
      });

      // Flush if buffer is full
      if (this.eventBuffer.length >= this.BUFFER_SIZE) {
        await this.flushBuffer();
      }

      // Publish ingested event
      await this.eventBus.publish(ANALYTICS_EVENTS.INGESTED, {
        tenantId: analyticsEvent.tenantId,
        eventId: analyticsEvent.id,
        eventType: analyticsEvent.eventType,
        entityType: analyticsEvent.entityType,
        entityId: analyticsEvent.entityId,
        channel: analyticsEvent.channel,
        timestamp: analyticsEvent.timestamp.toISOString(),
        correlationId: payload.correlationId,
        version: '1.0',
        source: 'analytics-sync',
      });

      this.logger.debug('[PUBLISH] analytics.ingested', {
        eventId: analyticsEvent.id,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error(
        'Failed to ingest event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Ingest multiple events
   */
  async ingestEvents(
    events: Array<{ eventType: string; payload: SourceEventPayload }>,
  ): Promise<void> {
    for (const event of events) {
      await this.ingestEvent(event.eventType, event.payload);
    }
  }

  /**
   * Flush buffered events to ClickHouse
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const startTime = Date.now();
    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    this.logger.log('[START] Flushing analytics buffer', { count: eventsToFlush.length });

    try {
      await this.repository.insertEvents(eventsToFlush);

      this.logger.log('[END] Flushed analytics buffer', {
        count: eventsToFlush.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Put events back in buffer for retry
      this.eventBuffer = [...eventsToFlush, ...this.eventBuffer];

      this.logger.error(
        'Failed to flush analytics buffer',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Force flush (for testing or shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flushBuffer();
  }
}
