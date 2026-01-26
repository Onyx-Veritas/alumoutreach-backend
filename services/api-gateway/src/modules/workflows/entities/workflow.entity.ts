import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { WorkflowTriggerType } from './workflow.enums';
import { WorkflowRun } from './workflow-run.entity';

// Re-export enums for convenience
export { WorkflowTriggerType } from './workflow.enums';

// ============ Workflow Graph Types ============

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface TriggerConfig {
  // For INCOMING_MESSAGE
  channels?: string[];
  keywords?: string[];
  matchType?: 'any' | 'all' | 'exact';
  
  // For EVENT_BASED
  eventTypes?: string[];
  conditions?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  
  // For TIME_BASED
  cronExpression?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  segmentId?: string;
}

// ============ Workflow Entity ============

@Entity('workflows')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'triggerType'])
@Index(['tenantId', 'isPublished'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'deletedAt'])
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: WorkflowTriggerType,
  })
  triggerType: WorkflowTriggerType;

  @Column({ name: 'trigger_config', type: 'jsonb', nullable: true })
  triggerConfig?: TriggerConfig;

  @Column({ type: 'jsonb' })
  graph: WorkflowGraph;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @Column({ name: 'published_by', nullable: true })
  publishedBy?: string;

  // Audit fields
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  // Relations
  @OneToMany(() => WorkflowRun, run => run.workflow)
  runs?: WorkflowRun[];

  // Stats (cached)
  @Column({ name: 'total_runs', default: 0 })
  totalRuns: number;

  @Column({ name: 'successful_runs', default: 0 })
  successfulRuns: number;

  @Column({ name: 'failed_runs', default: 0 })
  failedRuns: number;
}
