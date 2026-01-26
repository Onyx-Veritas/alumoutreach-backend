import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Segment } from './segment.entity';

// ============ Member Source ============

export enum MemberSource {
  MANUAL = 'manual',
  DYNAMIC = 'dynamic',
  IMPORT = 'import',
  API = 'api',
  EVENT = 'event',
}

// ============ Segment Member Entity ============

@Entity('segment_members')
@Unique(['segmentId', 'contactId'])
@Index('idx_segment_member_segment_added', ['segmentId', 'addedAt'])
@Index('idx_segment_member_tenant_segment', ['tenantId', 'segmentId'])
export class SegmentMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index('idx_segment_member_tenant')
  tenantId: string;

  @Column({ name: 'segment_id' })
  @Index('idx_segment_member_segment')
  segmentId: string;

  @Column({ name: 'contact_id' })
  @Index('idx_segment_member_contact')
  contactId: string;

  // How the member was added
  @Column({
    type: 'enum',
    enum: MemberSource,
    default: MemberSource.DYNAMIC,
  })
  source: MemberSource;

  // When added (for static) or computed (for dynamic)
  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;

  // Who added (for manual additions)
  @Column({ name: 'added_by', nullable: true })
  addedBy?: string;

  // Last time membership was confirmed (for dynamic segments)
  @Column({ name: 'computed_at', type: 'timestamptz', nullable: true })
  computedAt?: Date;

  // Computation batch ID (for tracking which refresh added this)
  @Column({ name: 'computation_batch_id', nullable: true })
  computationBatchId?: string;

  // Optional metadata about the membership
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Relations
  @ManyToOne(() => Segment, (segment) => segment.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'segment_id' })
  segment: Segment;
}
