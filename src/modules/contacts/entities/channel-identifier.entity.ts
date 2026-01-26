import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Contact } from './contact.entity';

export enum ChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
  VOICE = 'voice',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
}

export enum ChannelStatus {
  ACTIVE = 'active',
  UNVERIFIED = 'unverified',
  BOUNCED = 'bounced',
  BLOCKED = 'blocked',
}

@Entity('channel_identifiers')
@Index(['tenantId', 'channelType', 'identifier'], { unique: true })
@Index(['contactId'])
export class ChannelIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({
    name: 'channel_type',
    type: 'enum',
    enum: ChannelType,
  })
  channelType: ChannelType;

  @Column()
  identifier: string;

  @Column({ name: 'display_name', nullable: true })
  displayName: string;

  @Column({
    type: 'enum',
    enum: ChannelStatus,
    default: ChannelStatus.UNVERIFIED,
  })
  status: ChannelStatus;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_at', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'bounce_count', default: 0 })
  bounceCount: number;

  @Column({ name: 'last_bounce_at', nullable: true })
  lastBounceAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Contact, (contact) => contact.channels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
