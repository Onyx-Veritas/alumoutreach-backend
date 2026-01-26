import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Contact } from './contact.entity';

export enum TimelineEventType {
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  EMAIL_SENT = 'email.sent',
  EMAIL_OPENED = 'email.opened',
  EMAIL_CLICKED = 'email.clicked',
  EMAIL_BOUNCED = 'email.bounced',
  SMS_SENT = 'sms.sent',
  SMS_DELIVERED = 'sms.delivered',
  WHATSAPP_SENT = 'whatsapp.sent',
  WHATSAPP_DELIVERED = 'whatsapp.delivered',
  WHATSAPP_READ = 'whatsapp.read',
  PUSH_SENT = 'push.sent',
  PUSH_CLICKED = 'push.clicked',
  CAMPAIGN_ENROLLED = 'campaign.enrolled',
  CAMPAIGN_COMPLETED = 'campaign.completed',
  SEQUENCE_ENROLLED = 'sequence.enrolled',
  SEQUENCE_COMPLETED = 'sequence.completed',
  WORKFLOW_TRIGGERED = 'workflow.triggered',
  TAG_ADDED = 'tag.added',
  TAG_REMOVED = 'tag.removed',
  CONSENT_UPDATED = 'consent.updated',
  ATTRIBUTE_UPDATED = 'attribute.updated',
  NOTE_ADDED = 'note.added',
  IMPORT = 'import',
  EXPORT = 'export',
  MERGE = 'merge',
  SEGMENT_ADDED = 'segment.added',
  SEGMENT_REMOVED = 'segment.removed',
  CUSTOM = 'custom',
}

@Entity('contact_timeline_events')
@Index(['tenantId', 'contactId', 'occurredAt'])
@Index(['tenantId', 'eventType'])
export class ContactTimelineEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: TimelineEventType,
  })
  eventType: TimelineEventType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('jsonb', { nullable: true })
  data: Record<string, unknown>;

  @Column({ nullable: true })
  channel: string;

  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string;

  @Column({ nullable: true })
  source: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ name: 'occurred_at' })
  @Index()
  occurredAt: Date;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string;

  @Column({ name: 'actor_type', nullable: true })
  actorType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Contact, (contact) => contact.timelineEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
