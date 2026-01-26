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
import { CampaignChannel, CampaignStatus } from './campaign.enums';
import { CampaignRun } from './campaign-run.entity';
import { CampaignMessage } from './campaign-message.entity';

// Re-export enums for convenience
export { CampaignChannel, CampaignStatus } from './campaign.enums';

// ============ Campaign Entity ============

@Entity('campaigns')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'channel'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'scheduleAt'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'deletedAt'])
export class Campaign {
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
    type: 'enum',
    enum: CampaignChannel,
  })
  channel: CampaignChannel;

  @Column({ name: 'template_version_id', nullable: true })
  @Index()
  templateVersionId?: string;

  @Column({ name: 'segment_id', nullable: true })
  @Index()
  segmentId?: string;

  @Column({ name: 'schedule_at', type: 'timestamptz', nullable: true })
  scheduleAt?: Date;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  // Audience stats (cached)
  @Column({ name: 'audience_count', default: 0 })
  audienceCount: number;

  @Column({ name: 'sent_count', default: 0 })
  sentCount: number;

  @Column({ name: 'delivered_count', default: 0 })
  deliveredCount: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount: number;

  @Column({ name: 'opened_count', default: 0 })
  openedCount: number;

  @Column({ name: 'clicked_count', default: 0 })
  clickedCount: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Soft delete
  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

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
  @OneToMany(() => CampaignRun, (run) => run.campaign)
  runs?: CampaignRun[];

  @OneToMany(() => CampaignMessage, (message) => message.campaign)
  messages?: CampaignMessage[];
}
