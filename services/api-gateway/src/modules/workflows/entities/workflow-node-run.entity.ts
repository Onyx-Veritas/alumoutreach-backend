import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowNodeRunStatus, WorkflowNodeType } from './workflow.enums';
import { WorkflowRun } from './workflow-run.entity';

// Re-export enums for convenience
export { WorkflowNodeRunStatus, WorkflowNodeType } from './workflow.enums';

// ============ Node Run Result ============

export interface NodeRunResult {
  success: boolean;
  output?: unknown;
  error?: string;
  nextNodeId?: string;
  metadata?: Record<string, unknown>;
}

// ============ WorkflowNodeRun Entity ============

@Entity('workflow_node_runs')
@Index(['tenantId', 'runId'])
@Index(['runId', 'nodeId'])
@Index(['tenantId', 'executedAt'])
export class WorkflowNodeRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'run_id' })
  @Index()
  runId: string;

  @Column({ name: 'node_id' })
  nodeId: string;

  @Column({
    name: 'node_type',
    type: 'enum',
    enum: WorkflowNodeType,
  })
  nodeType: WorkflowNodeType;

  @Column({
    type: 'enum',
    enum: WorkflowNodeRunStatus,
    default: WorkflowNodeRunStatus.PENDING,
  })
  status: WorkflowNodeRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  result?: NodeRunResult;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs?: number;

  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => WorkflowRun, run => run.nodeRuns)
  @JoinColumn({ name: 'run_id' })
  run?: WorkflowRun;
}
