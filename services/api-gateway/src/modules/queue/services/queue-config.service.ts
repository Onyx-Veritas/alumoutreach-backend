import { Injectable } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TenantQueueConfig } from '../interfaces';
import { DEFAULT_TENANT_QUEUE_CONFIG, DEFAULT_JOB_OPTIONS } from '../queue.constants';

/**
 * Service for managing per-tenant queue configuration
 * Resolves rate limits, priorities, and job options
 */
@Injectable()
export class QueueConfigService {
  private readonly logger: AppLoggerService;

  // In-memory cache of tenant configs
  // TODO: Load from database/cache in production
  private readonly tenantConfigs = new Map<string, TenantQueueConfig>();

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('QueueConfigService');
  }

  /**
   * Get queue configuration for a tenant
   * Returns default config if tenant-specific config not found
   */
  async getTenantConfig(tenantId: string): Promise<TenantQueueConfig> {
    // Check cache first
    const cached = this.tenantConfigs.get(tenantId);
    if (cached) {
      return cached;
    }

    // TODO: Load from database
    // For now, return defaults
    const config: TenantQueueConfig = {
      ...DEFAULT_TENANT_QUEUE_CONFIG,
    };

    // Cache for future use
    this.tenantConfigs.set(tenantId, config);

    this.logger.debug('Loaded tenant queue config', {
      tenantId,
      config,
    });

    return config;
  }

  /**
   * Set custom configuration for a tenant
   */
  async setTenantConfig(
    tenantId: string,
    config: Partial<TenantQueueConfig>,
  ): Promise<TenantQueueConfig> {
    const current = await this.getTenantConfig(tenantId);
    const updated: TenantQueueConfig = {
      ...current,
      ...config,
    };

    this.tenantConfigs.set(tenantId, updated);

    this.logger.info('Updated tenant queue config', {
      tenantId,
      config: updated,
    });

    return updated;
  }

  /**
   * Convert tenant config to BullMQ job options
   */
  getJobOptions(config: TenantQueueConfig): JobsOptions {
    return {
      ...DEFAULT_JOB_OPTIONS,
      priority: config.priority,
      // Note: Per-job delay is calculated during enqueue based on rate limit
    };
  }

  /**
   * Calculate delay for a job based on position in batch and rate limit
   * @param position - Position in batch (0-indexed)
   * @param config - Tenant config
   * @returns Delay in milliseconds
   */
  calculateJobDelay(position: number, config: TenantQueueConfig): number {
    if (config.rateLimitPerSecond <= 0) {
      return config.delayMs;
    }

    // Calculate delay to spread jobs across time
    const intervalMs = Math.ceil(1000 / config.rateLimitPerSecond);
    return position * intervalMs + config.delayMs;
  }

  /**
   * Clear cached config for a tenant
   */
  clearTenantConfig(tenantId: string): void {
    this.tenantConfigs.delete(tenantId);
  }

  /**
   * Clear all cached configs
   */
  clearAllConfigs(): void {
    this.tenantConfigs.clear();
  }
}
