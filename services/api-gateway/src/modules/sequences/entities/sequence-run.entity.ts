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
import { SequenceRunStatus, SequenceExitReason } from './sequence.enums';
import { Sequence } from './sequence.entity';

/**
 * Context stored during sequence run execution
 */
export interface SequenceRunContext {
  /** Variables collected during execution */
  variables: Record<string, unknown>;
  /** History of executed steps */
  stepHistory: StepExecutionRecord[];
  /** Trigger data that started the sequence */
  triggerData?: Record<string, unknown>;
  /** Error information if failed */
  error?: {
    stepId: string;
    message: string;
    stack?: string;
    timestamp: string;
  };
  /** Exit reason details */
  exitDetails?: {
    reason: SequenceExitReason;
    stepId?: string;
    message?: string;
    timestamp: string;
  };
}

export interface StepExecutionRecord {
  stepId: string;
  stepNumber: number;
  stepType: string;
  executedAt: string;
  durationMs: number;
  result: 'success' | 'failed' | 'skipped';
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * Sequence Run Entity
 * Represents one contact going through a sequence
 */
@Entity('sequence_runs')
@Index(['tenantId', 'sequenceId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'status'])
@Index(['status', 'nextExecutionAt'])
@Index(['sequenceId', 'contactId'], { unique: false })
export class SequenceRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'sequence_id' })
  sequenceId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({ name: 'current_step_id', nullable: true })
  currentStepId: string | null;

  @Column({ name: 'current_step_number', type: 'int', default: 0 })
  currentStepNumber: number;

  @Column({
    type: 'enum',
    enum: SequenceRunStatus,
    default: SequenceRunStatus.RUNNING,
  })
  status: SequenceRunStatus;

  @Column({ type: 'jsonb', default: { variables: {}, stepHistory: [] } })
  context: SequenceRunContext;

  @Column({ name: 'next_execution_at', type: 'timestamptz', nullable: true })
  nextExecutionAt: Date | null;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string | null;

  @Column({ name: 'enrolled_by', nullable: true })
  enrolledBy: string | null;

  @Column({ name: 'enrollment_source', nullable: true })
  enrollmentSource: string | null;

  @Column({ name: 'exit_reason', type: 'enum', enum: SequenceExitReason, nullable: true })
  exitReason: SequenceExitReason | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Sequence, (sequence) => sequence.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequence_id' })
  sequence: Sequence;
}
