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
import { TemplateVersion } from './template-version.entity';

// ============ Template Usage Stats Entity ============

@Entity('template_usage_stats')
@Index(['templateVersionId'])
@Index(['tenantId', 'templateVersionId'])
@Index(['tenantId', 'date'])
export class TemplateUsageStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'template_id' })
  @Index()
  templateId: string;

  @Column({ name: 'template_version_id' })
  templateVersionId: string;

  @Column({ type: 'date' })
  date: Date;

  // Delivery metrics
  @Column({ name: 'sent_count', default: 0 })
  sentCount: number;

  @Column({ name: 'delivered_count', default: 0 })
  deliveredCount: number;

  @Column({ name: 'failed_count', default: 0 })
  failedCount: number;

  @Column({ name: 'bounced_count', default: 0 })
  bouncedCount: number;

  // Engagement metrics
  @Column({ name: 'opened_count', default: 0 })
  openedCount: number;

  @Column({ name: 'clicked_count', default: 0 })
  clickedCount: number;

  @Column({ name: 'replied_count', default: 0 })
  repliedCount: number;

  @Column({ name: 'unsubscribed_count', default: 0 })
  unsubscribedCount: number;

  @Column({ name: 'complained_count', default: 0 })
  complainedCount: number;

  // Calculated rates (stored for fast querying)
  @Column({ name: 'delivery_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  deliveryRate: number;

  @Column({ name: 'open_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  openRate: number;

  @Column({ name: 'click_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  clickRate: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => TemplateVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion: TemplateVersion;
}
