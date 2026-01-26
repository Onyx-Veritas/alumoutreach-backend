import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DispatchStatus } from './campaign.enums';
import { Campaign } from './campaign.entity';
import { CampaignRun } from './campaign-run.entity';

// Re-export enum
export { DispatchStatus } from './campaign.enums';

// ============ Campaign Message Entity ============

@Entity('campaign_messages')
@Index(['campaignId', 'contactId'], { unique: true })
@Index(['campaignId', 'dispatchStatus'])
@Index(['runId', 'dispatchStatus'])
@Index(['contactId'])
@Index(['providerMessageId'])
export class CampaignMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  @Index()
  campaignId: string;

  @Column({ name: 'run_id', nullable: true })
  @Index()
  runId?: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({ name: 'template_version_id', nullable: true })
  templateVersionId?: string;

  @Column({
    type: 'enum',
    enum: DispatchStatus,
    name: 'dispatch_status',
    default: DispatchStatus.PENDING,
  })
  dispatchStatus: DispatchStatus;

  @Column({ name: 'provider_message_id', nullable: true })
  providerMessageId?: string;

  @Column({ name: 'dispatch_error', type: 'text', nullable: true })
  dispatchError?: string;

  // Rendered content (stored for audit/debugging)
  @Column({ name: 'rendered_content', type: 'jsonb', nullable: true })
  renderedContent?: Record<string, unknown>;

  // Delivery/engagement timestamps
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt?: Date;

  @Column({ name: 'clicked_at', type: 'timestamptz', nullable: true })
  clickedAt?: Date;

  @Column({ name: 'bounced_at', type: 'timestamptz', nullable: true })
  bouncedAt?: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Campaign, (campaign) => campaign.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign;

  @ManyToOne(() => CampaignRun, (run) => run.messages, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'run_id' })
  run?: CampaignRun;
}
