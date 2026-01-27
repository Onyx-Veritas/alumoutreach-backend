import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ActivityType } from './inbox.enums';
import { InboxThread } from './inbox-thread.entity';

/**
 * Inbox Activity Entity
 * Audit log per thread tracking assignments, status changes, tags, events
 */
@Entity('inbox_activities')
@Index(['tenantId', 'threadId'])
@Index(['tenantId', 'createdAt'])
@Index(['threadId', 'createdAt'])
export class InboxActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'thread_id' })
  threadId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => InboxThread, (thread) => thread.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread: InboxThread;
}
