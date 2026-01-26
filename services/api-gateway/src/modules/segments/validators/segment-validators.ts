import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import {
  SegmentType,
  SegmentRules,
  SegmentRule,
  SegmentRuleGroup,
} from '../entities/segment.entity';
import { CreateSegmentDto, UpdateSegmentDto } from '../dto/segment.dto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class SegmentValidatorService {
  private readonly logger: AppLoggerService;

  private readonly validOperators = new Set([
    'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
    'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between',
    'is_null', 'is_not_null', 'has_tag', 'has_any_tag', 'has_all_tags',
    'has_attribute', 'has_event', 'event_count_gte', 'event_count_lte',
  ]);

  private readonly validContactFields = new Set([
    'email', 'primaryEmail', 'phone', 'firstName', 'lastName', 'fullName',
    'status', 'source', 'createdAt', 'updatedAt', 'lastActivityAt',
  ]);

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentValidatorService');
  }

  /**
   * Validate a segment creation request
   */
  validateCreate(dto: CreateSegmentDto): ValidationResult {
    const startTime = this.logger.logOperationStart('validate create segment');

    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!dto.name || dto.name.trim().length === 0) {
      errors.push('Segment name is required');
    } else if (dto.name.length > 255) {
      errors.push('Segment name must be 255 characters or less');
    }

    // Type-specific validation
    if (dto.type === SegmentType.DYNAMIC) {
      if (!dto.rules) {
        errors.push('Dynamic segments require rules');
      } else {
        const rulesValidation = this.validateRules(dto.rules);
        errors.push(...rulesValidation.errors);
        warnings.push(...rulesValidation.warnings);
      }
    }

    if (dto.type === SegmentType.EVENT_DRIVEN) {
      if (!dto.eventConfig) {
        errors.push('Event-driven segments require eventConfig');
      } else {
        if (!dto.eventConfig.eventType) {
          errors.push('eventConfig.eventType is required');
        }
      }
    }

    // Refresh interval validation
    if (dto.refreshIntervalMinutes !== undefined) {
      if (dto.refreshIntervalMinutes < 1) {
        errors.push('Refresh interval must be at least 1 minute');
      }
      if (dto.refreshIntervalMinutes > 10080) {
        errors.push('Refresh interval cannot exceed 10080 minutes (1 week)');
      }
    }

    // Color validation
    if (dto.color && !/^#[0-9A-Fa-f]{6}$/.test(dto.color)) {
      errors.push('Color must be a valid hex color (e.g., #FF5500)');
    }

    this.logger.logOperationEnd('validate create segment', startTime, {
      isValid: errors.length === 0,
      errorCount: errors.length,
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a segment update request
   */
  validateUpdate(dto: UpdateSegmentDto, existingType: SegmentType): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation if provided
    if (dto.name !== undefined) {
      if (dto.name.trim().length === 0) {
        errors.push('Segment name cannot be empty');
      } else if (dto.name.length > 255) {
        errors.push('Segment name must be 255 characters or less');
      }
    }

    // Rules validation if provided
    if (dto.rules) {
      const rulesValidation = this.validateRules(dto.rules);
      errors.push(...rulesValidation.errors);
      warnings.push(...rulesValidation.warnings);
    }

    // Cannot change type
    if (dto.type && dto.type !== existingType) {
      warnings.push('Changing segment type may affect existing members');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate segment rules structure
   */
  validateRules(rules: SegmentRules): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rules.logic || !['AND', 'OR'].includes(rules.logic)) {
      errors.push('Top-level logic must be AND or OR');
    }

    if (!rules.groups || !Array.isArray(rules.groups)) {
      errors.push('Rules must have a groups array');
      return { isValid: false, errors, warnings };
    }

    if (rules.groups.length === 0) {
      errors.push('Rules must have at least one group');
      return { isValid: false, errors, warnings };
    }

    // Validate each group/rule
    for (let i = 0; i < rules.groups.length; i++) {
      const item = rules.groups[i];
      const itemErrors = this.validateRuleOrGroup(item, `groups[${i}]`);
      errors.push(...itemErrors);
    }

    // Warnings for complexity
    const ruleCount = this.countRules(rules);
    if (ruleCount > 20) {
      warnings.push(`Complex segment with ${ruleCount} rules may have slower performance`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Count total rules in a segment
   */
  countRules(rules: SegmentRules): number {
    let count = 0;
    
    const countInGroup = (items: Array<SegmentRule | SegmentRuleGroup>) => {
      for (const item of items) {
        if (this.isRuleGroup(item)) {
          countInGroup(item.rules);
        } else {
          count++;
        }
      }
    };

    countInGroup(rules.groups);
    return count;
  }

  // ============ Private Methods ============

  private validateRuleOrGroup(item: SegmentRule | SegmentRuleGroup, path: string): string[] {
    const errors: string[] = [];

    if (this.isRuleGroup(item)) {
      // Validate group
      if (!['AND', 'OR'].includes(item.logic)) {
        errors.push(`${path}: Invalid logic operator`);
      }

      if (!item.rules || item.rules.length === 0) {
        errors.push(`${path}: Group must have at least one rule`);
      } else {
        for (let i = 0; i < item.rules.length; i++) {
          errors.push(...this.validateRuleOrGroup(item.rules[i], `${path}.rules[${i}]`));
        }
      }
    } else {
      // Validate single rule
      errors.push(...this.validateSingleRule(item, path));
    }

    return errors;
  }

  private validateSingleRule(rule: SegmentRule, path: string): string[] {
    const errors: string[] = [];

    // Field validation
    if (!rule.field) {
      errors.push(`${path}: Rule must have a field`);
    } else {
      const fieldValid = this.validateField(rule.field);
      if (!fieldValid) {
        errors.push(`${path}: Invalid field "${rule.field}"`);
      }
    }

    // Operator validation
    if (!rule.operator) {
      errors.push(`${path}: Rule must have an operator`);
    } else if (!this.validOperators.has(rule.operator)) {
      errors.push(`${path}: Invalid operator "${rule.operator}"`);
    }

    // Value validation based on operator
    if (rule.operator) {
      const valueErrors = this.validateValue(rule, path);
      errors.push(...valueErrors);
    }

    return errors;
  }

  private validateField(field: string): boolean {
    // Standard contact fields
    if (this.validContactFields.has(field)) {
      return true;
    }

    // Tags field
    if (field === 'tags') {
      return true;
    }

    // Attribute fields (attributes.*)
    if (field.startsWith('attributes.') && field.length > 11) {
      return true;
    }

    // Timeline/event fields (timeline.* or events.*)
    if ((field.startsWith('timeline.') || field.startsWith('events.')) && field.length > 9) {
      return true;
    }

    // Channel fields (channel.*)
    if (field.startsWith('channel.') && field.length > 8) {
      return true;
    }

    return false;
  }

  private validateValue(rule: SegmentRule, path: string): string[] {
    const errors: string[] = [];
    const { operator, value } = rule;

    // Operators that don't need a value
    if (operator === 'is_null' || operator === 'is_not_null' || operator === 'has_attribute') {
      return errors;
    }

    // Value required for most operators
    if (value === undefined || value === null) {
      errors.push(`${path}: Value is required for operator "${operator}"`);
      return errors;
    }

    // Array operators
    if (['in', 'not_in', 'has_any_tag', 'has_all_tags'].includes(operator)) {
      if (!Array.isArray(value)) {
        errors.push(`${path}: Operator "${operator}" requires an array value`);
      } else if (value.length === 0) {
        errors.push(`${path}: Array value cannot be empty`);
      }
    }

    // Between operator
    if (operator === 'between') {
      if (!Array.isArray(value) || value.length !== 2) {
        errors.push(`${path}: Operator "between" requires an array of exactly 2 values`);
      }
    }

    // Numeric operators
    if (['gt', 'gte', 'lt', 'lte', 'event_count_gte', 'event_count_lte'].includes(operator)) {
      if (typeof value !== 'number' && isNaN(Number(value))) {
        errors.push(`${path}: Operator "${operator}" requires a numeric value`);
      }
    }

    return errors;
  }

  private isRuleGroup(item: SegmentRule | SegmentRuleGroup): item is SegmentRuleGroup {
    return 'logic' in item && 'rules' in item;
  }
}
