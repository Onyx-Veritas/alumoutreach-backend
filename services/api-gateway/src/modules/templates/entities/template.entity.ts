import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TemplateVersion } from './template-version.entity';
import {
  TemplateChannel,
  TemplateCategory,
  ApprovalStatus,
  TemplateStatus,
} from './template.enums';

// Re-export enums for backward compatibility
export { TemplateChannel, TemplateCategory, ApprovalStatus, TemplateStatus };

// ============ Template Entity ============

@Entity('templates')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'channel'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'approvalStatus'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'deletedAt'])
export class Template {
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
    enum: TemplateChannel,
  })
  channel: TemplateChannel;

  @Column({
    type: 'enum',
    enum: TemplateCategory,
    default: TemplateCategory.MARKETING,
  })
  category: TemplateCategory;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE,
  })
  status: TemplateStatus;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    name: 'approval_status',
    default: ApprovalStatus.DRAFT,
  })
  approvalStatus: ApprovalStatus;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  @Column({ name: 'approval_notes', type: 'text', nullable: true })
  approvalNotes?: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'current_version_id', nullable: true })
  currentVersionId?: string;

  @Column({ name: 'current_version_number', default: 0 })
  currentVersionNumber: number;

  // Folder/Organization
  @Column({ nullable: true })
  folder?: string;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  // Usage tracking
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

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
  @OneToMany(() => TemplateVersion, (version) => version.template, {
    cascade: true,
  })
  versions: TemplateVersion[];

  @ManyToOne(() => TemplateVersion, { nullable: true })
  @JoinColumn({ name: 'current_version_id' })
  currentVersion?: TemplateVersion;
}
