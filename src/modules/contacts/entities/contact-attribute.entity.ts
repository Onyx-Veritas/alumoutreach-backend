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

export enum AttributeType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  JSON = 'json',
  ARRAY = 'array',
}

@Entity('contact_attributes')
@Index(['tenantId', 'contactId', 'key'], { unique: true })
@Index(['tenantId', 'key'])
export class ContactAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column()
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({
    name: 'value_type',
    type: 'enum',
    enum: AttributeType,
    default: AttributeType.STRING,
  })
  valueType: AttributeType;

  @Column({ nullable: true })
  label: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'is_searchable', default: false })
  isSearchable: boolean;

  @Column({ name: 'is_encrypted', default: false })
  isEncrypted: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Contact, (contact) => contact.attributes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
