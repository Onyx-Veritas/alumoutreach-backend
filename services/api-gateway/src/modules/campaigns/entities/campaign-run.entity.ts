import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CampaignRunStatus } from './campaign.enums';
import { Campaign } from './campaign.entity';
import { CampaignMessage } from './campaign-message.entity';

// Re-export enum
export { CampaignRunStatus } from './campaign.enums';

// ============ Campaign Run Entity ============

@Entity('campaign_runs')
@Index(['campaignId', 'status'])
@Index(['campaignId', 'startedAt'])
export class CampaignRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  @Index()
  campaignId: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: CampaignRunStatus,
    default: CampaignRunStatus.PENDING,
  })
  status: CampaignRunStatus;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  // Run statistics
  @Column({ name: 'total_recipients', default: 0 })
  totalRecipients: number;

  @Column({ name: 'processed_count', default: 0 })
  processedCount: number;

  @Column({ name: 'sent_count', default: 0 })
  sentCount: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount: number;

  // Metadata for additional run info
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Error info if run failed
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Campaign, (campaign) => campaign.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign;

  @OneToMany(() => CampaignMessage, (message) => message.run)
  messages?: CampaignMessage[];
}
