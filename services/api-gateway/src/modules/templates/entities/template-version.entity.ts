import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Template } from './template.entity';
import { TemplateChannel } from './template.enums';

// ============ Content Structures by Channel ============

export interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody?: string;
  preheader?: string;
  replyTo?: string;
  fromName?: string;
}

export interface SmsContent {
  body: string;
  senderId?: string;
}

export interface WhatsAppHeaderComponent {
  type: 'text' | 'image' | 'document' | 'video';
  text?: string;
  mediaUrl?: string;
  filename?: string;
}

export interface WhatsAppButtonComponent {
  type: 'quick_reply' | 'url' | 'phone_number' | 'copy_code';
  text: string;
  url?: string;
  phoneNumber?: string;
  example?: string[];
}

export interface WhatsAppContent {
  templateName: string;
  language: string;
  header?: WhatsAppHeaderComponent;
  body: string;
  footer?: string;
  buttons?: WhatsAppButtonComponent[];
}

export interface PushContent {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  clickAction?: string;
  data?: Record<string, string>;
}

export interface RcsCardContent {
  title: string;
  description?: string;
  mediaUrl?: string;
  mediaHeight?: 'short' | 'medium' | 'tall';
  suggestions?: Array<{
    type: 'reply' | 'action';
    text: string;
    postbackData?: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

export interface RcsContent {
  type: 'text' | 'card' | 'carousel';
  text?: string;
  cards?: RcsCardContent[];
  suggestions?: Array<{
    type: 'reply' | 'action';
    text: string;
    postbackData?: string;
  }>;
}

export type TemplateContent =
  | EmailContent
  | SmsContent
  | WhatsAppContent
  | PushContent
  | RcsContent;

// ============ Template Version Entity ============

@Entity('template_versions')
@Index(['templateId', 'versionNumber'], { unique: true })
@Index(['templateId', 'createdAt'])
export class TemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id' })
  @Index()
  templateId: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'version_number' })
  versionNumber: number;

  @Column({
    type: 'enum',
    enum: TemplateChannel,
  })
  channel: TemplateChannel;

  @Column({ type: 'jsonb' })
  content: TemplateContent;

  @Column('text', { array: true, default: '{}' })
  variables: string[];

  @Column({ type: 'text', nullable: true })
  changelog?: string;

  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;

  // Validation status
  @Column({ name: 'is_valid', default: true })
  isValid: boolean;

  @Column({ name: 'validation_errors', type: 'jsonb', nullable: true })
  validationErrors?: Array<{ field: string; message: string }>;

  // Rendered preview (cached)
  @Column({ name: 'preview_data', type: 'jsonb', nullable: true })
  previewData?: Record<string, unknown>;

  // Audit
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Template, (template) => template.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: Template;
}
