import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ChannelIdentifier } from './channel-identifier.entity';
import { ContactAttribute } from './contact-attribute.entity';
import { ContactTagMapping } from './contact-tag-mapping.entity';
import { ContactTimelineEvent } from './contact-timeline-event.entity';
import { ContactConsent } from './contact-consent.entity';

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed',
  ARCHIVED = 'archived',
}

@Entity('contacts')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'email'])
@Index(['tenantId', 'createdAt'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'external_id', nullable: true })
  @Index()
  externalId: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'preferred_name', nullable: true })
  preferredName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'email_secondary', nullable: true })
  emailSecondary: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'phone_country_code', nullable: true })
  phoneCountryCode: string;

  @Column({ nullable: true })
  whatsapp: string;

  @Column({ name: 'profile_image_url', nullable: true })
  profileImageUrl: string;

  @Column({ nullable: true })
  salutation: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  gender: string;

  // Academic Information
  @Column({ name: 'program', nullable: true })
  program: string;

  @Column({ name: 'specialization', nullable: true })
  specialization: string;

  @Column({ name: 'batch_year', nullable: true })
  batchYear: number;

  @Column({ name: 'graduation_year', nullable: true })
  graduationYear: number;

  @Column({ nullable: true })
  department: string;

  @Column({ name: 'roll_number', nullable: true })
  rollNumber: string;

  @Column({ nullable: true })
  degree: string;

  // Professional Information
  @Column({ name: 'current_company', nullable: true })
  currentCompany: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl: string;

  @Column({ name: 'years_of_experience', nullable: true })
  yearsOfExperience: number;

  @Column('simple-array', { nullable: true })
  skills: string[];

  // Location
  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  timezone: string;

  // Engagement
  @Column({ name: 'engagement_score', default: 50 })
  engagementScore: number;

  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.ACTIVE,
  })
  status: ContactStatus;

  @Column('simple-array', { nullable: true })
  roles: string[];

  @Column({ name: 'preferred_language', default: 'en' })
  preferredLanguage: string;

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt: Date;

  @Column({ name: 'last_contacted_at', nullable: true })
  lastContactedAt: Date;

  @Column({ name: 'total_interactions', default: 0 })
  totalInteractions: number;

  // Soft delete
  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: string;

  // Metadata
  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  // Audit
  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => ChannelIdentifier, (channel) => channel.contact)
  channels: ChannelIdentifier[];

  @OneToMany(() => ContactAttribute, (attr) => attr.contact)
  attributes: ContactAttribute[];

  @OneToMany(() => ContactTagMapping, (mapping) => mapping.contact)
  tagMappings: ContactTagMapping[];

  @OneToMany(() => ContactTimelineEvent, (event) => event.contact)
  timelineEvents: ContactTimelineEvent[];

  @OneToMany(() => ContactConsent, (consent) => consent.contact)
  consents: ContactConsent[];
}
