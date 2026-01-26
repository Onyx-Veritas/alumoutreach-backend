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
import { SegmentMember } from './segment-member.entity';

// ============ Enums ============

export enum SegmentType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  EVENT_DRIVEN = 'event_driven',
}

export enum SegmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

// ============ Rule Interfaces ============

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_null'
  | 'is_not_null'
  | 'has_tag'
  | 'has_any_tag'
  | 'has_all_tags'
  | 'has_attribute'
  | 'has_event'
  | 'event_count_gte'
  | 'event_count_lte';

export type RuleField =
  | 'email'
  | 'primaryEmail'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'status'
  | 'source'
  | 'createdAt'
  | 'updatedAt'
  | 'lastActivityAt'
  | 'tags'
  | `attributes.${string}`
  | `timeline.${string}`
  | `channel.${string}`;

export interface SegmentRule {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface SegmentRuleGroup {
  logic: 'AND' | 'OR';
  rules: Array<SegmentRule | SegmentRuleGroup>;
}

export interface SegmentRules {
  logic: 'AND' | 'OR';
  groups: Array<SegmentRule | SegmentRuleGroup>;
}

// ============ Segment Entity ============

@Entity('segments')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'type'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class Segment {
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
    enum: SegmentType,
    default: SegmentType.DYNAMIC,
  })
  type: SegmentType;

  @Column({
    type: 'enum',
    enum: SegmentStatus,
    default: SegmentStatus.ACTIVE,
  })
  status: SegmentStatus;

  // Rules for dynamic segments (JSON)
  @Column({ type: 'jsonb', nullable: true })
  rules?: SegmentRules;

  // Event trigger config for event-driven segments
  @Column({ name: 'event_config', type: 'jsonb', nullable: true })
  eventConfig?: {
    eventType: string;
    conditions?: SegmentRule[];
  };

  // Folder organization
  @Column({ length: 255, nullable: true })
  folder?: string;

  // Tags for categorization
  @Column('text', { array: true, default: '{}' })
  tags: string[];

  // Color for UI
  @Column({ length: 7, nullable: true })
  color?: string;

  // Membership counts (cached)
  @Column({ name: 'member_count', default: 0 })
  memberCount: number;

  // Last computation info
  @Column({ name: 'last_computed_at', type: 'timestamptz', nullable: true })
  lastComputedAt?: Date;

  @Column({ name: 'computation_duration_ms', nullable: true })
  computationDurationMs?: number;

  // Scheduling for dynamic segments
  @Column({ name: 'refresh_interval_minutes', nullable: true })
  refreshIntervalMinutes?: number;

  @Column({ name: 'next_refresh_at', type: 'timestamptz', nullable: true })
  nextRefreshAt?: Date;

  // Custom metadata
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
  @OneToMany(() => SegmentMember, (member) => member.segment, {
    cascade: true,
  })
  members: SegmentMember[];
}
