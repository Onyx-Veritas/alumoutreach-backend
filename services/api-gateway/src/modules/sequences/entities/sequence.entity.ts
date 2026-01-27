import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SequenceType } from './sequence.enums';
import { SequenceStep } from './sequence-step.entity';
import { SequenceRun } from './sequence-run.entity';

/**
 * Trigger configuration for behavioral/onboarding sequences
 */
export interface TriggerConfig {
  /** Event types that trigger enrollment */
  eventTypes?: string[];
  /** Additional conditions for triggering */
  conditions?: TriggerCondition[];
  /** Segment IDs to filter contacts */
  segmentIds?: string[];
  /** Tags required for triggering */
  requiredTags?: string[];
  /** Prevent re-enrollment if already completed */
  preventReEnrollment?: boolean;
  /** Maximum enrollments per contact */
  maxEnrollmentsPerContact?: number;
}

export interface TriggerCondition {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Sequence Entity
 * Represents a linear, step-by-step automated drip journey
 */
@Entity('sequences')
@Index(['tenantId', 'type'])
@Index(['tenantId', 'isPublished'])
@Index(['tenantId', 'createdAt'])
export class Sequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: SequenceType,
    default: SequenceType.DRIP,
  })
  type: SequenceType;

  @Column({ name: 'trigger_config', type: 'jsonb', nullable: true })
  triggerConfig: TriggerConfig | null;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // Statistics
  @Column({ name: 'total_enrollments', type: 'int', default: 0 })
  totalEnrollments: number;

  @Column({ name: 'completed_runs', type: 'int', default: 0 })
  completedRuns: number;

  @Column({ name: 'exited_runs', type: 'int', default: 0 })
  exitedRuns: number;

  @Column({ name: 'failed_runs', type: 'int', default: 0 })
  failedRuns: number;

  // Relations
  @OneToMany(() => SequenceStep, (step) => step.sequence, { cascade: true })
  steps: SequenceStep[];

  @OneToMany(() => SequenceRun, (run) => run.sequence)
  runs: SequenceRun[];
}
