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

export enum ConsentChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
  VOICE = 'voice',
}

export enum ConsentStatus {
  OPTED_IN = 'opted_in',
  OPTED_OUT = 'opted_out',
  PENDING = 'pending',
  UNKNOWN = 'unknown',
}

export enum ConsentSource {
  EXPLICIT = 'explicit',
  IMPLICIT = 'implicit',
  IMPORT = 'import',
  SYSTEM = 'system',
  USER_REQUEST = 'user_request',
  PREFERENCE_CENTER = 'preference_center',
}

@Entity('contact_consents')
@Index(['tenantId', 'contactId', 'channel'], { unique: true })
export class ContactConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({
    type: 'enum',
    enum: ConsentChannel,
  })
  channel: ConsentChannel;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.UNKNOWN,
  })
  status: ConsentStatus;

  @Column({
    type: 'enum',
    enum: ConsentSource,
    default: ConsentSource.SYSTEM,
  })
  source: ConsentSource;

  @Column({ name: 'opted_in_at', nullable: true })
  optedInAt: Date;

  @Column({ name: 'opted_out_at', nullable: true })
  optedOutAt: Date;

  @Column({ name: 'consent_text', nullable: true })
  consentText: string;

  @Column({ name: 'consent_version', nullable: true })
  consentVersion: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Contact, (contact) => contact.consents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
