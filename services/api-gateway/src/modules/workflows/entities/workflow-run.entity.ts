import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { WorkflowRunStatus } from './workflow.enums';
import { Workflow } from './workflow.entity';
import { WorkflowNodeRun } from './workflow-node-run.entity';

// Re-export enum for convenience
export { WorkflowRunStatus } from './workflow.enums';

// ============ Workflow Run Context ============

export interface WorkflowRunContext {
  // Trigger context
  triggerEvent?: {
    type: string;
    payload: Record<string, unknown>;
    timestamp: string;
  };
  
  // Contact context
  contact?: {
    id: string;
    email?: string;
    phone?: string;
    fullName?: string;
    attributes?: Record<string, unknown>;
  };
  
  // Message context (for INCOMING_MESSAGE triggers)
  message?: {
    id: string;
    channel: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
  
  // Variables set during execution
  variables?: Record<string, unknown>;
  
  // Execution state
  lastNodeId?: string;
  lastNodeResult?: unknown;
  errors?: Array<{ nodeId: string; error: string; timestamp: string }>;
}

// ============ WorkflowRun Entity ============

@Entity('workflow_runs')
@Index(['tenantId', 'workflowId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
@Index(['status', 'nextExecutionAt']) // For scheduler
export class WorkflowRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'workflow_id' })
  @Index()
  workflowId: string;

  @Column({ name: 'contact_id', nullable: true })
  @Index()
  contactId?: string;

  @Column({
    type: 'enum',
    enum: WorkflowRunStatus,
    default: WorkflowRunStatus.PENDING,
  })
  status: WorkflowRunStatus;

  @Column({ name: 'current_node_id', nullable: true })
  currentNodeId?: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: WorkflowRunContext;

  @Column({ name: 'next_execution_at', type: 'timestamptz', nullable: true })
  nextExecutionAt?: Date;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId?: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Workflow, workflow => workflow.runs)
  @JoinColumn({ name: 'workflow_id' })
  workflow?: Workflow;

  @OneToMany(() => WorkflowNodeRun, nodeRun => nodeRun.run)
  nodeRuns?: WorkflowNodeRun[];
}
