import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { ConditionOperator } from '../entities/workflow.enums';
import { WorkflowRunContext } from '../entities/workflow-run.entity';

export interface ConditionDefinition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionEvaluationResult {
  matched: boolean;
  evaluatedValue?: unknown;
  reason?: string;
}

@Injectable()
export class WorkflowConditionValidator {
  constructor(private readonly logger: AppLoggerService) {}

  evaluateCondition(
    condition: ConditionDefinition,
    context: WorkflowRunContext,
  ): ConditionEvaluationResult {
    this.logger.debug('Evaluating condition', {
      field: condition.field,
      operator: condition.operator,
    });

    const fieldValue = this.resolveFieldValue(condition.field, context);
    const matched = this.compareValues(fieldValue, condition.operator, condition.value);

    return {
      matched,
      evaluatedValue: fieldValue,
      reason: matched 
        ? `Field "${condition.field}" ${condition.operator} ${condition.value}`
        : `Field "${condition.field}" did not match: got "${fieldValue}"`,
    };
  }

  evaluateConditions(
    conditions: ConditionDefinition[],
    context: WorkflowRunContext,
    matchType: 'any' | 'all' = 'all',
  ): { matched: boolean; matchedIndex: number; results: ConditionEvaluationResult[] } {
    const results: ConditionEvaluationResult[] = [];
    let matchedIndex = -1;

    for (let i = 0; i < conditions.length; i++) {
      const result = this.evaluateCondition(conditions[i], context);
      results.push(result);
      
      if (result.matched && matchedIndex === -1) {
        matchedIndex = i;
      }

      // For 'any' match type, return on first match
      if (matchType === 'any' && result.matched) {
        return { matched: true, matchedIndex: i, results };
      }
    }

    // For 'all' match type, all must match
    const allMatched = results.every(r => r.matched);
    
    return {
      matched: matchType === 'all' ? allMatched : matchedIndex !== -1,
      matchedIndex,
      results,
    };
  }

  private resolveFieldValue(field: string, context: WorkflowRunContext): unknown {
    // Support dot notation for nested fields
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  private compareValues(
    fieldValue: unknown,
    operator: ConditionOperator,
    compareValue: unknown,
  ): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return this.normalizeValue(fieldValue) === this.normalizeValue(compareValue);

      case ConditionOperator.NOT_EQUALS:
        return this.normalizeValue(fieldValue) !== this.normalizeValue(compareValue);

      case ConditionOperator.CONTAINS:
        return this.containsCheck(fieldValue, compareValue);

      case ConditionOperator.NOT_CONTAINS:
        return !this.containsCheck(fieldValue, compareValue);

      case ConditionOperator.GREATER_THAN:
        return this.numericCompare(fieldValue, compareValue) > 0;

      case ConditionOperator.LESS_THAN:
        return this.numericCompare(fieldValue, compareValue) < 0;

      case ConditionOperator.IS_EMPTY:
        return this.isEmptyCheck(fieldValue);

      case ConditionOperator.IS_NOT_EMPTY:
        return !this.isEmptyCheck(fieldValue);

      case ConditionOperator.STARTS_WITH:
        return this.startsWithCheck(fieldValue, compareValue);

      case ConditionOperator.ENDS_WITH:
        return this.endsWithCheck(fieldValue, compareValue);

      default:
        this.logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }

  private normalizeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).toLowerCase().trim();
  }

  private containsCheck(fieldValue: unknown, searchValue: unknown): boolean {
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(item => 
        this.normalizeValue(item) === this.normalizeValue(searchValue)
      );
    }
    return this.normalizeValue(fieldValue).includes(this.normalizeValue(searchValue));
  }

  private numericCompare(fieldValue: unknown, compareValue: unknown): number {
    const numField = Number(fieldValue);
    const numCompare = Number(compareValue);

    if (isNaN(numField) || isNaN(numCompare)) {
      // Fall back to string comparison
      return this.normalizeValue(fieldValue).localeCompare(this.normalizeValue(compareValue));
    }

    return numField - numCompare;
  }

  private isEmptyCheck(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  private startsWithCheck(fieldValue: unknown, prefix: unknown): boolean {
    return this.normalizeValue(fieldValue).startsWith(this.normalizeValue(prefix));
  }

  private endsWithCheck(fieldValue: unknown, suffix: unknown): boolean {
    return this.normalizeValue(fieldValue).endsWith(this.normalizeValue(suffix));
  }
}
