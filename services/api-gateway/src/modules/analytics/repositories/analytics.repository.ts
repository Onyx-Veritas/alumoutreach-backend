import { Injectable } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import {
  AnalyticsEvent,
  ANALYTICS_EVENTS_TABLE_SQL,
  AggregatedCount,
  TimeBucketCount,
  TimeBucketDimensionCount,
} from '../entities/analytics.schema';
import { AnalyticsMapper } from '../mappers/analytics.mapper';
import { QueryTimeRange } from '../dto/analytics.dto';
import { AnalyticsValidators } from '../validators/analytics.validators';

/**
 * Analytics Repository
 * Handles ClickHouse database operations
 */
@Injectable()
export class AnalyticsRepository {
  private client: ClickHouseClient | null = null;
  private initialized = false;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly mapper: AnalyticsMapper,
    private readonly validators: AnalyticsValidators,
  ) {
    this.logger.setContext('AnalyticsRepository');
  }

  /**
   * Initialize ClickHouse connection and schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();
    this.logger.log('[START] Connecting to ClickHouse', { operation: 'initialize' });

    try {
      this.client = createClient({
        url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
        database: process.env.CLICKHOUSE_DATABASE || 'default',
      });

      // Create table if not exists
      await this.client.command({
        query: ANALYTICS_EVENTS_TABLE_SQL,
      });

      this.initialized = true;

      this.logger.log('[END] Connected to ClickHouse', {
        operation: 'initialize',
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error(
        'Failed to connect to ClickHouse',
        error instanceof Error ? error.stack : String(error),
      );
      // Don't throw - allow graceful degradation
    }
  }

  /**
   * Check if repository is ready
   */
  isReady(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Insert analytics event
   */
  async insertEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isReady()) {
      this.logger.warn('ClickHouse not ready, skipping insert');
      return;
    }

    const startTime = Date.now();
    const params = this.mapper.toClickHouseParams(event);

    try {
      await this.client!.insert({
        table: 'analytics_events',
        values: [params],
        format: 'JSONEachRow',
      });

      this.logger.debug('[QUERY] Insert analytics event', {
        operation: 'insertEvent',
        eventType: event.eventType,
        entityId: event.entityId,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error(
        'Failed to insert analytics event',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Insert multiple analytics events
   */
  async insertEvents(events: AnalyticsEvent[]): Promise<void> {
    if (!this.isReady() || events.length === 0) return;

    const startTime = Date.now();
    const values = events.map((e) => this.mapper.toClickHouseParams(e));

    try {
      await this.client!.insert({
        table: 'analytics_events',
        values,
        format: 'JSONEachRow',
      });

      this.logger.debug('[QUERY] Batch insert analytics events', {
        operation: 'insertEvents',
        count: events.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error(
        'Failed to batch insert analytics events',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Count events by type
   */
  async countByEventType(
    tenantId: string,
    timeRange: QueryTimeRange,
    eventTypes?: string[],
  ): Promise<AggregatedCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    let query = `
      SELECT event_type AS key, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
    `;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN ({event_types:Array(String)})`;
    }

    query += ` GROUP BY event_type ORDER BY count DESC`;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          event_types: eventTypes || [],
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<AggregatedCount>();

      this.logger.debug('[QUERY] Count by event type', {
        operation: 'countByEventType',
        tenantId,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data;
    } catch (error) {
      this.logger.error(
        'Failed to count by event type',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Count events by entity type
   */
  async countByEntityType(
    tenantId: string,
    timeRange: QueryTimeRange,
  ): Promise<AggregatedCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    const query = `
      SELECT entity_type AS key, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
      GROUP BY entity_type
      ORDER BY count DESC
    `;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<AggregatedCount>();

      this.logger.debug('[QUERY] Count by entity type', {
        operation: 'countByEntityType',
        tenantId,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data;
    } catch (error) {
      this.logger.error(
        'Failed to count by entity type',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Count events by channel
   */
  async countByChannel(
    tenantId: string,
    timeRange: QueryTimeRange,
    entityType?: string,
  ): Promise<AggregatedCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    let query = `
      SELECT channel AS key, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
    `;

    if (entityType) {
      query += ` AND entity_type = {entity_type:String}`;
    }

    query += ` GROUP BY channel ORDER BY count DESC`;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          entity_type: entityType || '',
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<AggregatedCount>();

      this.logger.debug('[QUERY] Count by channel', {
        operation: 'countByChannel',
        tenantId,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data;
    } catch (error) {
      this.logger.error(
        'Failed to count by channel',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Count events in time buckets
   */
  async countByTimeBucket(
    tenantId: string,
    timeRange: QueryTimeRange,
    eventTypes?: string[],
  ): Promise<TimeBucketCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    const bucketFunc = this.validators.getTimeBucketFunction(timeRange.granularity);

    let query = `
      SELECT ${bucketFunc}(timestamp) AS bucket, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
    `;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN ({event_types:Array(String)})`;
    }

    query += ` GROUP BY bucket ORDER BY bucket ASC`;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          event_types: eventTypes || [],
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<{ bucket: string; count: string }>();

      this.logger.debug('[QUERY] Count by time bucket', {
        operation: 'countByTimeBucket',
        tenantId,
        granularity: timeRange.granularity,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data.map((row) => ({
        bucket: row.bucket,
        count: parseInt(row.count, 10),
      }));
    } catch (error) {
      this.logger.error(
        'Failed to count by time bucket',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Count events in time buckets with dimension
   */
  async countByTimeBucketAndDimension(
    tenantId: string,
    timeRange: QueryTimeRange,
    dimension: 'channel' | 'event_type' | 'entity_type',
    eventTypes?: string[],
    entityType?: string,
  ): Promise<TimeBucketDimensionCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    const bucketFunc = this.validators.getTimeBucketFunction(timeRange.granularity);

    let query = `
      SELECT ${bucketFunc}(timestamp) AS bucket, ${dimension} AS dimension, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
    `;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN ({event_types:Array(String)})`;
    }

    if (entityType) {
      query += ` AND entity_type = {entity_type:String}`;
    }

    query += ` GROUP BY bucket, ${dimension} ORDER BY bucket ASC, count DESC`;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          event_types: eventTypes || [],
          entity_type: entityType || '',
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<{ bucket: string; dimension: string; count: string }>();

      this.logger.debug('[QUERY] Count by time bucket and dimension', {
        operation: 'countByTimeBucketAndDimension',
        tenantId,
        dimension,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data.map((row) => ({
        bucket: row.bucket,
        dimension: row.dimension,
        count: parseInt(row.count, 10),
      }));
    } catch (error) {
      this.logger.error(
        'Failed to count by time bucket and dimension',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Get total count for event types
   */
  async getTotalCount(
    tenantId: string,
    timeRange: QueryTimeRange,
    eventTypes?: string[],
    entityType?: string,
  ): Promise<number> {
    if (!this.isReady()) return 0;

    const startTime = Date.now();
    let query = `
      SELECT count() AS total
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
    `;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN ({event_types:Array(String)})`;
    }

    if (entityType) {
      query += ` AND entity_type = {entity_type:String}`;
    }

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          event_types: eventTypes || [],
          entity_type: entityType || '',
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<{ total: string }>();

      this.logger.debug('[QUERY] Get total count', {
        operation: 'getTotalCount',
        tenantId,
        duration: Date.now() - startTime,
      });

      return data.length > 0 ? parseInt(data[0].total, 10) : 0;
    } catch (error) {
      this.logger.error(
        'Failed to get total count',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }

  /**
   * Count by metadata field
   */
  async countByMetadataField(
    tenantId: string,
    timeRange: QueryTimeRange,
    field: string,
    eventTypes?: string[],
  ): Promise<AggregatedCount[]> {
    if (!this.isReady()) return [];

    const startTime = Date.now();
    const safeField = this.validators.sanitizeString(field);

    let query = `
      SELECT JSONExtractString(metadata, '${safeField}') AS key, count() AS count
      FROM analytics_events
      WHERE tenant_id = {tenant_id:String}
        AND timestamp >= {from:DateTime64(3)}
        AND timestamp <= {to:DateTime64(3)}
        AND JSONExtractString(metadata, '${safeField}') != ''
    `;

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN ({event_types:Array(String)})`;
    }

    query += ` GROUP BY key ORDER BY count DESC LIMIT 100`;

    try {
      const result = await this.client!.query({
        query,
        query_params: {
          tenant_id: tenantId,
          from: timeRange.from,
          to: timeRange.to,
          event_types: eventTypes || [],
        },
        format: 'JSONEachRow',
      });

      const data = await result.json<AggregatedCount>();

      this.logger.debug('[QUERY] Count by metadata field', {
        operation: 'countByMetadataField',
        tenantId,
        field,
        resultCount: data.length,
        duration: Date.now() - startTime,
      });

      return data;
    } catch (error) {
      this.logger.error(
        'Failed to count by metadata field',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.initialized = false;
    }
  }
}
