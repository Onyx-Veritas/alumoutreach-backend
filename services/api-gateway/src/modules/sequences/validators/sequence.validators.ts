import { Injectable } from '@nestjs/common';
import { ConditionOperator, SequenceStepType, SequenceType } from '../entities/sequence.enums';
import { SequenceStep, ConditionStepConfig, ConditionRule } from '../entities/sequence-step.entity';
import { Sequence } from '../entities/sequence.entity';
import { CreateSequenceDto, CreateSequenceStepDto } from '../dto/sequence.dto';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  stepNumber?: number;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  stepNumber?: number;
}

/**
 * Sequence Validators
 * Validates sequence structure, steps, and conditions
 */
@Injectable()
export class SequenceValidators {
  /**
   * Validate a sequence for publishing
   */
  validateSequenceForPublishing(sequence: Sequence): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Must have at least one step
    if (!sequence.steps || sequence.steps.length === 0) {
      errors.push({
        code: 'NO_STEPS',
        message: 'Sequence must have at least one step',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate step numbers are sequential
    const sortedSteps = [...sequence.steps].sort((a, b) => a.stepNumber - b.stepNumber);
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].stepNumber !== i + 1) {
        errors.push({
          code: 'INVALID_STEP_SEQUENCE',
          message: `Step numbers must be sequential. Expected ${i + 1}, got ${sortedSteps[i].stepNumber}`,
          stepNumber: sortedSteps[i].stepNumber,
        });
      }
    }

    // Validate each step
    for (const step of sequence.steps) {
      const stepErrors = this.validateStep(step, sequence.steps);
      errors.push(...stepErrors);
    }

    // Must have an END step or a step that doesn't have a next step
    const hasEndStep = sequence.steps.some((s) => s.stepType === SequenceStepType.END);
    const hasTerminalStep = sequence.steps.some((s) => !s.nextStepId);
    if (!hasEndStep && !hasTerminalStep) {
      warnings.push({
        code: 'NO_TERMINAL_STEP',
        message: 'Sequence should have an END step or a step without next step',
      });
    }

    // Validate trigger config for non-DRIP sequences
    if (sequence.type !== SequenceType.DRIP) {
      if (!sequence.triggerConfig) {
        errors.push({
          code: 'MISSING_TRIGGER_CONFIG',
          message: `${sequence.type} sequences must have a trigger configuration`,
        });
      } else if (sequence.type === SequenceType.BEHAVIORAL) {
        if (!sequence.triggerConfig.eventTypes || sequence.triggerConfig.eventTypes.length === 0) {
          errors.push({
            code: 'MISSING_EVENT_TYPES',
            message: 'Behavioral sequences must specify event types in trigger configuration',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single step
   */
  validateStep(step: SequenceStep, allSteps: SequenceStep[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate step type specific configuration
    switch (step.stepType) {
      case SequenceStepType.SEND_MESSAGE:
        errors.push(...this.validateSendMessageStep(step));
        break;
      case SequenceStepType.DELAY:
        errors.push(...this.validateDelayStep(step));
        break;
      case SequenceStepType.CONDITION:
        errors.push(...this.validateConditionStep(step, allSteps));
        break;
      case SequenceStepType.END:
        // END step should not have a next step
        if (step.nextStepId) {
          errors.push({
            code: 'END_STEP_HAS_NEXT',
            message: 'END step should not have a next step',
            stepNumber: step.stepNumber,
          });
        }
        break;
    }

    // Validate next step reference if present
    if (step.nextStepId) {
      const nextStep = allSteps.find((s) => s.id === step.nextStepId);
      if (!nextStep) {
        errors.push({
          code: 'INVALID_NEXT_STEP',
          message: `Next step reference ${step.nextStepId} not found`,
          stepNumber: step.stepNumber,
        });
      }
    }

    return errors;
  }

  /**
   * Validate SEND_MESSAGE step
   */
  private validateSendMessageStep(step: SequenceStep): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = step.config as { templateId?: string; channel?: string };

    if (!config.templateId) {
      errors.push({
        code: 'MISSING_TEMPLATE_ID',
        message: 'SEND_MESSAGE step must have a templateId',
        stepNumber: step.stepNumber,
      });
    }

    if (!config.channel) {
      errors.push({
        code: 'MISSING_CHANNEL',
        message: 'SEND_MESSAGE step must have a channel',
        stepNumber: step.stepNumber,
      });
    }

    return errors;
  }

  /**
   * Validate DELAY step
   */
  private validateDelayStep(step: SequenceStep): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = step.config as { duration?: number; unit?: string };

    if (typeof config.duration !== 'number' || config.duration <= 0) {
      errors.push({
        code: 'INVALID_DELAY_DURATION',
        message: 'DELAY step must have a positive duration',
        stepNumber: step.stepNumber,
      });
    }

    if (!config.unit) {
      errors.push({
        code: 'MISSING_DELAY_UNIT',
        message: 'DELAY step must have a unit (minutes, hours, days, weeks)',
        stepNumber: step.stepNumber,
      });
    }

    return errors;
  }

  /**
   * Validate CONDITION step
   */
  private validateConditionStep(step: SequenceStep, allSteps: SequenceStep[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = step.config as ConditionStepConfig;

    if (!config.rules || config.rules.length === 0) {
      errors.push({
        code: 'MISSING_CONDITION_RULES',
        message: 'CONDITION step must have at least one rule',
        stepNumber: step.stepNumber,
      });
      return errors;
    }

    // Validate each rule
    for (let i = 0; i < config.rules.length; i++) {
      const rule = config.rules[i];
      if (!rule.field) {
        errors.push({
          code: 'MISSING_RULE_FIELD',
          message: `Rule ${i + 1} must have a field`,
          stepNumber: step.stepNumber,
        });
      }
      if (!rule.operator) {
        errors.push({
          code: 'MISSING_RULE_OPERATOR',
          message: `Rule ${i + 1} must have an operator`,
          stepNumber: step.stepNumber,
        });
      }
    }

    // Must have either branch steps or exit flags
    const hasTrueBranch = config.trueStepId || config.exitOnTrue;
    const hasFalseBranch = config.falseStepId || config.exitOnFalse;

    if (!hasTrueBranch && !hasFalseBranch) {
      errors.push({
        code: 'NO_CONDITION_OUTCOMES',
        message: 'CONDITION step must have at least one outcome (true/false step or exit)',
        stepNumber: step.stepNumber,
      });
    }

    // Validate referenced steps exist
    if (config.trueStepId) {
      const trueStep = allSteps.find((s) => s.id === config.trueStepId);
      if (!trueStep) {
        errors.push({
          code: 'INVALID_TRUE_STEP',
          message: `True step reference ${config.trueStepId} not found`,
          stepNumber: step.stepNumber,
        });
      }
    }

    if (config.falseStepId) {
      const falseStep = allSteps.find((s) => s.id === config.falseStepId);
      if (!falseStep) {
        errors.push({
          code: 'INVALID_FALSE_STEP',
          message: `False step reference ${config.falseStepId} not found`,
          stepNumber: step.stepNumber,
        });
      }
    }

    return errors;
  }

  /**
   * Validate create sequence DTO
   */
  validateCreateSequenceDto(dto: CreateSequenceDto): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!dto.name || dto.name.trim().length === 0) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Sequence name is required',
        field: 'name',
      });
    }

    if (dto.type !== SequenceType.DRIP && !dto.triggerConfig) {
      warnings.push({
        code: 'MISSING_TRIGGER_CONFIG',
        message: `${dto.type} sequences typically need trigger configuration`,
        field: 'triggerConfig',
      });
    }

    if (dto.steps) {
      dto.steps.forEach((step, index) => {
        const stepErrors = this.validateCreateStepDto(step, index + 1);
        errors.push(...stepErrors);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate create step DTO
   */
  private validateCreateStepDto(step: CreateSequenceStepDto, expectedNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (step.stepNumber !== expectedNumber) {
      errors.push({
        code: 'INVALID_STEP_NUMBER',
        message: `Expected step number ${expectedNumber}, got ${step.stepNumber}`,
        stepNumber: step.stepNumber,
      });
    }

    return errors;
  }

  /**
   * Evaluate condition rules against contact data
   */
  evaluateCondition(
    config: ConditionStepConfig,
    contactAttributes: Record<string, unknown>,
    segmentMembership: string[] = [],
    eventContext: Record<string, unknown> = {},
  ): boolean {
    if (!config.rules || config.rules.length === 0) {
      return true;
    }

    const results = config.rules.map((rule) =>
      this.evaluateRule(rule, contactAttributes, segmentMembership, eventContext),
    );

    if (config.logicalOperator === 'AND') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluate a single condition rule
   */
  private evaluateRule(
    rule: ConditionRule,
    contactAttributes: Record<string, unknown>,
    segmentMembership: string[],
    eventContext: Record<string, unknown>,
  ): boolean {
    // Handle segment-based operators
    if (rule.operator === ConditionOperator.IN_SEGMENT) {
      return rule.segmentId ? segmentMembership.includes(rule.segmentId) : false;
    }
    if (rule.operator === ConditionOperator.NOT_IN_SEGMENT) {
      return rule.segmentId ? !segmentMembership.includes(rule.segmentId) : true;
    }

    // Get value from appropriate source
    let actualValue: unknown;
    if (rule.field.startsWith('event.')) {
      actualValue = this.getNestedValue(eventContext, rule.field.replace('event.', ''));
    } else if (rule.field.startsWith('contact.')) {
      actualValue = this.getNestedValue(contactAttributes, rule.field.replace('contact.', ''));
    } else {
      actualValue = this.getNestedValue(contactAttributes, rule.field);
    }

    return this.compareValues(actualValue, rule.operator, rule.value);
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: unknown, operator: ConditionOperator, expected: unknown): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return actual === expected;
      case ConditionOperator.NOT_EQUALS:
        return actual !== expected;
      case ConditionOperator.CONTAINS:
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.toLowerCase().includes(expected.toLowerCase());
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;
      case ConditionOperator.NOT_CONTAINS:
        if (typeof actual === 'string' && typeof expected === 'string') {
          return !actual.toLowerCase().includes(expected.toLowerCase());
        }
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        return true;
      case ConditionOperator.GREATER_THAN:
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case ConditionOperator.LESS_THAN:
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case ConditionOperator.GREATER_THAN_OR_EQUALS:
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case ConditionOperator.LESS_THAN_OR_EQUALS:
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case ConditionOperator.IS_SET:
        return actual !== undefined && actual !== null && actual !== '';
      case ConditionOperator.IS_NOT_SET:
        return actual === undefined || actual === null || actual === '';
      default:
        return false;
    }
  }
}
