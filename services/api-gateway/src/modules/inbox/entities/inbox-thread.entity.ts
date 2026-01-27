import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { InboxChannel, ThreadStatus, ThreadPriority } from './inbox.enums';

/**
 * Thread metadata stored as JSONB
 */
export interface ThreadMetadata {
  /** Subject line for email threads */
  subject?: string;
  /** Contact name cached for quick display */
  contactName?: string;
  /** Contact avatar URL */
  contactAvatar?: string;
  /** Last message preview */
  lastMessagePreview?: string;
  /** Tags associated with thread */
  tags?: string[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Source of the thread (campaign, workflow, sequence, manual) */
  source?: string;
  /** Source ID (campaignId, workflowId, etc.) */
  sourceId?: string;
}

/**
 * Inbox Thread Entity
 * Groups all messages between a contact and the system on a specific channel
 */
@Entity('inbox_threads')
@Index(['tenantId', 'contactId', 'channel'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'assignedTo'])
@Index(['tenantId', 'lastMessageAt'])
export class InboxThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  @Index()
  contactId: string;

  @Column({
    type: 'enum',
    enum: InboxChannel,
  })
  channel: InboxChannel;

  @Column({ name: 'unread_count', type: 'int', default: 0 })
  unreadCount: number;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({
    type: 'enum',
    enum: ThreadStatus,
    default: ThreadStatus.OPEN,
  })
  status: ThreadStatus;

  @Column({
    type: 'enum',
    enum: ThreadPriority,
    default: ThreadPriority.NORMAL,
  })
  priority: ThreadPriority;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: ThreadMetadata;

  @Column({ name: 'is_starred', default: false })
  isStarred: boolean;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', nullable: true })
  closedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations - using string-based entity reference for circular dependency
  @OneToMany('InboxMessage', 'thread')
  messages: import('./inbox-message.entity').InboxMessage[];

  @OneToMany('InboxActivity', 'thread')
  activities: import('./inbox-activity.entity').InboxActivity[];
}
