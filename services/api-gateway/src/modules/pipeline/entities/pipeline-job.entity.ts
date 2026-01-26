import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PipelineJobStatus, PipelineChannel } from './pipeline.enums';

// Re-export enums for convenience
export { PipelineJobStatus, PipelineChannel } from './pipeline.enums';

// ============ PipelineJob Entity ============

@Entity('pipeline_jobs')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'campaignId'])
@Index(['tenantId', 'campaignRunId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'nextAttemptAt'])
@Index(['status', 'nextAttemptAt']) // For worker acquisition
export class PipelineJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'campaign_id' })
  @Index()
  campaignId: string;

  @Column({ name: 'campaign_run_id' })
  @Index()
  campaignRunId: string;

  @Column({ name: 'contact_id' })
  @Index()
  contactId: string;

  @Column({ name: 'template_version_id', nullable: true })
  templateVersionId?: string;

  @Column({
    type: 'enum',
    enum: PipelineChannel,
  })
  channel: PipelineChannel;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: PipelineJobStatus,
    default: PipelineJobStatus.PENDING,
  })
  status: PipelineJobStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'provider_message_id', nullable: true })
  providerMessageId?: string;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
