import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SequenceStepType, DelayUnit, ConditionOperator, MessageChannel } from './sequence.enums';
import { Sequence } from './sequence.entity';

/**
 * Configuration for SEND_MESSAGE step
 */
export interface SendMessageStepConfig {
  templateId: string;
  channel: MessageChannel;
  /** Optional delay before sending */
  delaySeconds?: number;
  /** Custom variables to merge */
  variables?: Record<string, unknown>;
}

/**
 * Configuration for DELAY step
 */
export interface DelayStepConfig {
  duration: number;
  unit: DelayUnit;
}

/**
 * Configuration for CONDITION step
 */
export interface ConditionStepConfig {
  rules: ConditionRule[];
  /** Logical operator to combine rules */
  logicalOperator: 'AND' | 'OR';
  /** Step ID to go to if condition is true */
  trueStepId: string | null;
  /** Step ID to go to if condition is false */
  falseStepId: string | null;
  /** Exit sequence if condition is true */
  exitOnTrue?: boolean;
  /** Exit sequence if condition is false */
  exitOnFalse?: boolean;
}

export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  /** For segment-based conditions */
  segmentId?: string;
}

/**
 * Union type for step configuration
 */
export type StepConfig = SendMessageStepConfig | DelayStepConfig | ConditionStepConfig | Record<string, never>;

/**
 * Sequence Step Entity
 * Represents a single step in a sequence
 */
@Entity('sequence_steps')
@Index(['tenantId', 'sequenceId'])
@Index(['sequenceId', 'stepNumber'])
export class SequenceStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'sequence_id' })
  sequenceId: string;

  @Column({ name: 'step_number', type: 'int' })
  stepNumber: number;

  @Column({ length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'step_type',
    type: 'enum',
    enum: SequenceStepType,
  })
  stepType: SequenceStepType;

  @Column({ type: 'jsonb', default: {} })
  config: StepConfig;

  @Column({ name: 'next_step_id', nullable: true })
  nextStepId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Sequence, (sequence) => sequence.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequence_id' })
  sequence: Sequence;
}
