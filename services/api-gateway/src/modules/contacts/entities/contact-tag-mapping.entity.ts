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
import { ContactTag } from './contact-tag.entity';

@Entity('contact_tag_mappings')
@Index(['tenantId', 'contactId', 'tagId'], { unique: true })
export class ContactTagMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({ name: 'tag_id' })
  tagId: string;

  @Column({ name: 'added_by', nullable: true })
  addedBy: string;

  @Column({ name: 'added_via', nullable: true })
  addedVia: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Contact, (contact) => contact.tagMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @ManyToOne(() => ContactTag, (tag) => tag.contactMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: ContactTag;
}
