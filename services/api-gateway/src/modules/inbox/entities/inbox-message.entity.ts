import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InboxChannel, MessageDirection, MessageDeliveryStatus } from './inbox.enums';
import { InboxThread } from './inbox-thread.entity';

/**
 * Message metadata stored as JSONB
 */
export interface MessageMetadata {
  /** Email-specific: CC recipients */
  cc?: string[];
  /** Email-specific: BCC recipients */
  bcc?: string[];
  /** Email-specific: Subject */
  subject?: string;
  /** WhatsApp-specific: Message ID from provider */
  externalMessageId?: string;
  /** Reaction emoji if any */
  reaction?: string;
  /** Reply to message ID */
  replyToMessageId?: string;
  /** Message type (text, image, video, audio, document, template) */
  messageType?: string;
  /** For media messages: file name */
  fileName?: string;
  /** For media messages: file size in bytes */
  fileSize?: number;
  /** For media messages: mime type */
  mimeType?: string;
  /** Template variables used */
  templateVariables?: Record<string, unknown>;
  /** Error details if delivery failed */
  errorDetails?: string;
  /** Provider response data */
  providerResponse?: Record<string, unknown>;
}

/**
 * Inbox Message Entity
 * Represents a single inbound or outbound communication
 */
@Entity('inbox_messages')
@Index(['tenantId', 'threadId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'createdAt'])
@Index(['threadId', 'createdAt'])
export class InboxMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'thread_id' })
  threadId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({
    type: 'enum',
    enum: MessageDirection,
  })
  direction: MessageDirection;

  @Column({
    type: 'enum',
    enum: InboxChannel,
  })
  channel: InboxChannel;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'media_url', nullable: true })
  mediaUrl: string | null;

  @Column({ name: 'template_id', nullable: true })
  templateId: string | null;

  @Column({ name: 'pipeline_job_id', nullable: true })
  pipelineJobId: string | null;

  @Column({ name: 'workflow_run_id', nullable: true })
  workflowRunId: string | null;

  @Column({ name: 'sequence_run_id', nullable: true })
  sequenceRunId: string | null;

  @Column({ name: 'campaign_id', nullable: true })
  campaignId: string | null;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: MessageDeliveryStatus,
    default: MessageDeliveryStatus.PENDING,
  })
  deliveryStatus: MessageDeliveryStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: MessageMetadata;

  @Column({ name: 'sent_by', nullable: true })
  sentBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => InboxThread, (thread) => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread: InboxThread;
}
