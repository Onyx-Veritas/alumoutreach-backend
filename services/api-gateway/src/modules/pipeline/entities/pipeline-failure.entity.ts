import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PipelineJobStatus } from './pipeline.enums';

// ============ PipelineFailure Entity ============

@Entity('pipeline_failures')
@Index(['tenantId', 'jobId'])
@Index(['tenantId', 'createdAt'])
export class PipelineFailure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'job_id' })
  @Index()
  jobId: string;

  @Column({ name: 'campaign_id', nullable: true })
  campaignId?: string;

  @Column({ name: 'contact_id', nullable: true })
  contactId?: string;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage: string;

  @Column({
    name: 'last_status',
    type: 'enum',
    enum: PipelineJobStatus,
  })
  lastStatus: PipelineJobStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
