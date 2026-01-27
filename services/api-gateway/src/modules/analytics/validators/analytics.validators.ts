import { Injectable } from '@nestjs/common';
import {
  AnalyticsQueryDto,
  TimeGranularity,
  QueryTimeRange,
} from '../dto/analytics.dto';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Analytics Validators
 * Validates query parameters and data
 */
@Injectable()
export class AnalyticsValidators {
  /**
   * Validate analytics query parameters
   */
  validateQuery(dto: AnalyticsQueryDto): ValidationResult {
    const errors: string[] = [];

    if (dto.from && dto.to) {
      const from = new Date(dto.from);
      const to = new Date(dto.to);

      if (from > to) {
        errors.push('from date must be before to date');
      }

      // Maximum query range: 1 year
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
      if (to.getTime() - from.getTime() > maxRangeMs) {
        errors.push('query range cannot exceed 1 year');
      }
    }

    if (dto.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: dto.timezone });
      } catch {
        errors.push(`invalid timezone: ${dto.timezone}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse and normalize time range from query
   */
  parseTimeRange(dto: AnalyticsQueryDto): QueryTimeRange {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return {
      from: dto.from ? new Date(dto.from) : defaultFrom,
      to: dto.to ? new Date(dto.to) : now,
      timezone: dto.timezone || 'UTC',
      granularity: dto.granularity || TimeGranularity.DAY,
    };
  }

  /**
   * Validate tenant ID is present
   */
  validateTenantId(tenantId: string | undefined): ValidationResult {
    if (!tenantId) {
      return {
        valid: false,
        errors: ['tenantId is required'],
      };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Get ClickHouse time bucket function based on granularity
   */
  getTimeBucketFunction(granularity: TimeGranularity): string {
    switch (granularity) {
      case TimeGranularity.HOUR:
        return 'toStartOfHour';
      case TimeGranularity.DAY:
        return 'toStartOfDay';
      case TimeGranularity.WEEK:
        return 'toStartOfWeek';
      case TimeGranularity.MONTH:
        return 'toStartOfMonth';
      default:
        return 'toStartOfDay';
    }
  }

  /**
   * Sanitize string for SQL (prevent injection)
   */
  sanitizeString(value: string): string {
    // Remove or escape dangerous characters
    return value.replace(/['";\\]/g, '');
  }

  /**
   * Validate UUID format
   */
  isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
