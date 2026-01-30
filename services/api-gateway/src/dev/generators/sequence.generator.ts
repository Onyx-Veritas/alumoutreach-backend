import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export type SequenceType = 'drip' | 'onboarding' | 'behavioral';
export type SequenceStepType = 'send_message' | 'delay' | 'condition' | 'end';
export type DelayUnit = 'minutes' | 'hours' | 'days' | 'weeks';
export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'push';

export interface GenerateSequencesOptions {
  count: number;
  tenantId: string;
  types?: SequenceType[];
  minSteps?: number;
  maxSteps?: number;
}

export interface GeneratedSequenceStep {
  stepNumber: number;
  name: string;
  description?: string;
  stepType: SequenceStepType;
  config: Record<string, unknown>;
}

export interface GeneratedSequence {
  name: string;
  description: string;
  type: SequenceType;
  steps: GeneratedSequenceStep[];
  triggerConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SequenceGenerator {
  private readonly sequenceNameTemplates = {
    drip: [
      'Welcome Drip Series',
      'Lead Nurturing Sequence',
      'Re-engagement Campaign',
      'Newsletter Welcome',
      'Product Education Series',
      'Trial Conversion Sequence',
    ],
    onboarding: [
      'New Member Onboarding',
      'Alumni Welcome Journey',
      'Platform Introduction',
      'First Steps Guide',
      'Getting Started Series',
    ],
    behavioral: [
      'Abandoned Cart Recovery',
      'Post-Event Follow-up',
      'Milestone Celebration',
      'Inactive User Re-engagement',
      'Feedback Request Series',
    ],
  };

  private readonly delayUnits: DelayUnit[] = ['hours', 'days', 'weeks'];

  private readonly channels: MessageChannel[] = ['email', 'sms', 'whatsapp', 'push'];

  /**
   * Generate a batch of sequences
   */
  generate(options: GenerateSequencesOptions): GeneratedSequence[] {
    const sequences: GeneratedSequence[] = [];
    const types = options.types || ['drip', 'onboarding', 'behavioral'];

    for (let i = 0; i < options.count; i++) {
      const type = faker.helpers.arrayElement(types);
      sequences.push(this.generateSingle(type, options, i));
    }

    return sequences;
  }

  /**
   * Generate a single sequence
   */
  private generateSingle(
    type: SequenceType,
    options: GenerateSequencesOptions,
    index: number,
  ): GeneratedSequence {
    const minSteps = options.minSteps || 3;
    const maxSteps = options.maxSteps || 7;
    const stepCount = faker.number.int({ min: minSteps, max: maxSteps });
    
    const name = this.generateName(type, index);
    const steps = this.generateSteps(stepCount);

    return {
      name,
      description: this.generateDescription(type, name),
      type,
      steps,
      triggerConfig: type !== 'drip' ? this.generateTriggerConfig(type) : undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'dev-playground',
        index,
      },
    };
  }

  /**
   * Generate sequence name
   */
  private generateName(type: SequenceType, index: number): string {
    const suffix = `_${Date.now().toString(36)}_${index}`;
    const templates = this.sequenceNameTemplates[type] || this.sequenceNameTemplates.drip;
    return faker.helpers.arrayElement(templates) + suffix;
  }

  /**
   * Generate sequence description
   */
  private generateDescription(type: SequenceType, name: string): string {
    const descriptions: Record<SequenceType, string[]> = {
      drip: [
        'Automated drip campaign to nurture leads over time',
        'Multi-step email series for ongoing engagement',
        'Scheduled content delivery sequence',
      ],
      onboarding: [
        'Welcome journey for new members',
        'Step-by-step introduction to platform features',
        'New user activation sequence',
      ],
      behavioral: [
        'Triggered sequence based on user behavior',
        'Event-driven communication flow',
        'Automated response to user actions',
      ],
    };

    return faker.helpers.arrayElement(descriptions[type] || descriptions.drip);
  }

  /**
   * Generate steps for a sequence
   */
  private generateSteps(count: number): GeneratedSequenceStep[] {
    const steps: GeneratedSequenceStep[] = [];

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const isFirst = i === 0;
      
      let stepType: SequenceStepType;
      
      if (isLast) {
        stepType = 'end';
      } else if (isFirst) {
        stepType = 'send_message';
      } else {
        // Alternate between delay, send_message, and occasionally condition
        const roll = faker.number.int({ min: 1, max: 10 });
        if (roll <= 4) {
          stepType = 'delay';
        } else if (roll <= 8) {
          stepType = 'send_message';
        } else {
          stepType = 'condition';
        }
      }

      steps.push({
        stepNumber: i + 1,
        name: this.generateStepName(stepType, i + 1),
        description: this.generateStepDescription(stepType),
        stepType,
        config: this.generateStepConfig(stepType),
      });
    }

    return steps;
  }

  /**
   * Generate step name
   */
  private generateStepName(stepType: SequenceStepType, stepNumber: number): string {
    switch (stepType) {
      case 'send_message':
        return `Send Message ${stepNumber}`;
      case 'delay':
        return `Wait Period ${stepNumber}`;
      case 'condition':
        return `Check Condition ${stepNumber}`;
      case 'end':
        return 'End Sequence';
      default:
        return `Step ${stepNumber}`;
    }
  }

  /**
   * Generate step description
   */
  private generateStepDescription(stepType: SequenceStepType): string {
    switch (stepType) {
      case 'send_message':
        return 'Send a personalized message to the contact';
      case 'delay':
        return 'Wait before proceeding to the next step';
      case 'condition':
        return 'Evaluate conditions to determine next action';
      case 'end':
        return 'Complete the sequence';
      default:
        return '';
    }
  }

  /**
   * Generate step config based on type
   */
  private generateStepConfig(stepType: SequenceStepType): Record<string, unknown> {
    switch (stepType) {
      case 'send_message':
        return this.generateSendMessageConfig();
      case 'delay':
        return this.generateDelayConfig();
      case 'condition':
        return this.generateConditionConfig();
      case 'end':
        return { exitReason: 'completed' };
      default:
        return {};
    }
  }

  /**
   * Generate send_message step config
   */
  private generateSendMessageConfig(): Record<string, unknown> {
    const channel = faker.helpers.arrayElement(this.channels);
    
    return {
      channel,
      templateId: faker.string.uuid(), // In real usage, this would be a real template ID
      templatePlaceholder: true, // Flag to indicate this needs real template
      subject: channel === 'email' ? faker.lorem.sentence() : undefined,
      fallbackChannel: channel === 'email' ? 'sms' : undefined,
    };
  }

  /**
   * Generate delay step config
   */
  private generateDelayConfig(): Record<string, unknown> {
    const unit = faker.helpers.arrayElement(this.delayUnits);
    let duration: number;

    switch (unit) {
      case 'hours':
        duration = faker.number.int({ min: 1, max: 24 });
        break;
      case 'days':
        duration = faker.number.int({ min: 1, max: 7 });
        break;
      case 'weeks':
        duration = faker.number.int({ min: 1, max: 4 });
        break;
      default:
        duration = faker.number.int({ min: 30, max: 120 });
    }

    return {
      duration,
      unit,
    };
  }

  /**
   * Generate condition step config
   */
  private generateConditionConfig(): Record<string, unknown> {
    const conditions = [
      { field: 'contact.hasOpened', operator: 'equals', value: true },
      { field: 'contact.hasClicked', operator: 'equals', value: true },
      { field: 'contact.status', operator: 'equals', value: 'active' },
      { field: 'contact.tagIds', operator: 'contains', value: 'engaged' },
    ];

    return {
      operator: 'and',
      conditions: [faker.helpers.arrayElement(conditions)],
      trueNextStepOffset: 1,
      falseNextStepOffset: 2,
    };
  }

  /**
   * Generate trigger config for non-drip sequences
   */
  private generateTriggerConfig(type: SequenceType): Record<string, unknown> {
    switch (type) {
      case 'onboarding':
        return {
          eventTypes: ['contact_created'],
          preventReEnrollment: true,
        };
      case 'behavioral':
        return {
          eventTypes: ['tag_added', 'segment_joined', 'email_opened'],
          conditions: [
            { field: 'contact.status', operator: 'equals', value: 'active' },
          ],
          preventReEnrollment: false,
          maxEnrollments: 3,
        };
      default:
        return {};
    }
  }
}
