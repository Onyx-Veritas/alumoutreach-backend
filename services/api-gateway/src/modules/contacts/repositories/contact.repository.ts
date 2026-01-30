import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In, FindOptionsWhere, ILike } from 'typeorm';
import { Contact, ContactStatus } from '../entities/contact.entity';
import { ContactTag } from '../entities/contact-tag.entity';
import { ContactTagMapping } from '../entities/contact-tag-mapping.entity';
import { ContactAttribute, AttributeType } from '../entities/contact-attribute.entity';
import { ContactTimelineEvent, TimelineEventType } from '../entities/contact-timeline-event.entity';
import { ContactConsent, ConsentChannel, ConsentStatus, ConsentSource } from '../entities/contact-consent.entity';
import { ContactSearchDto, TimelineQueryDto } from '../dto/contact.dto';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ContactRepository {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactTag)
    private readonly tagRepo: Repository<ContactTag>,
    @InjectRepository(ContactTagMapping)
    private readonly tagMappingRepo: Repository<ContactTagMapping>,
    @InjectRepository(ContactAttribute)
    private readonly attributeRepo: Repository<ContactAttribute>,
    @InjectRepository(ContactTimelineEvent)
    private readonly timelineRepo: Repository<ContactTimelineEvent>,
    @InjectRepository(ContactConsent)
    private readonly consentRepo: Repository<ContactConsent>,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('ContactRepository');
  }

  // ============ CONTACT CRUD ============

  async create(contact: Partial<Contact>): Promise<Contact> {
    const startTime = this.logger.logOperationStart('create contact', {
      tenantId: contact.tenantId,
    });

    try {
      const entity = this.contactRepo.create(contact);
      const saved = await this.contactRepo.save(entity);

      this.logger.logDbQuery('INSERT contact', 1, { tenantId: contact.tenantId, contactId: saved.id });
      this.logger.logOperationEnd('create contact', startTime, { contactId: saved.id });

      return saved;
    } catch (error) {
      this.logger.logOperationError('create contact', error as Error, { tenantId: contact.tenantId });
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Contact | null> {
    const startTime = this.logger.logOperationStart('find contact by id', { tenantId, contactId: id });

    try {
      const contact = await this.contactRepo.findOne({
        where: { id, tenantId, isDeleted: false },
        relations: ['tagMappings', 'tagMappings.tag', 'consents', 'attributes'],
      });

      this.logger.logDbQuery('SELECT contact by id', contact ? 1 : 0, { tenantId, contactId: id });
      this.logger.logOperationEnd('find contact by id', startTime, { found: !!contact });

      return contact;
    } catch (error) {
      this.logger.logOperationError('find contact by id', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Contact[]> {
    if (ids.length === 0) return [];

    const startTime = this.logger.logOperationStart('find contacts by ids', { 
      tenantId, 
      count: ids.length,
    });

    try {
      const contacts = await this.contactRepo.find({
        where: { 
          id: In(ids), 
          tenantId, 
          isDeleted: false,
        },
        relations: ['attributes'],
      });

      this.logger.logDbQuery('SELECT contacts by ids', contacts.length, { tenantId, requestedCount: ids.length });
      this.logger.logOperationEnd('find contacts by ids', startTime, { found: contacts.length });

      return contacts;
    } catch (error) {
      this.logger.logOperationError('find contacts by ids', error as Error, { tenantId });
      throw error;
    }
  }

  async findByEmail(tenantId: string, email: string): Promise<Contact | null> {
    this.logger.logDbQuery('SELECT contact by email', undefined, { tenantId });

    return this.contactRepo.findOne({
      where: { tenantId, email, isDeleted: false },
    });
  }

  async findAll(tenantId: string, query: ContactSearchDto): Promise<PaginatedResult<Contact>> {
    const startTime = this.logger.logOperationStart('find all contacts', {
      tenantId,
      page: query.page,
      limit: query.limit,
    });

    try {
      const qb = this.contactRepo.createQueryBuilder('contact');

      qb.where('contact.tenantId = :tenantId', { tenantId });
      qb.andWhere('contact.isDeleted = false');

      // Apply filters
      this.applyFilters(qb, query);

      // Apply search
      if (query.q) {
        qb.andWhere(
          '(contact.fullName ILIKE :search OR contact.email ILIKE :search OR contact.phone ILIKE :search)',
          { search: `%${query.q}%` },
        );
      }

      // Sorting
      const sortField = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      qb.orderBy(`contact.${sortField}`, sortOrder);

      // Pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      qb.skip((page - 1) * limit).take(limit);

      // Include relations for response
      qb.leftJoinAndSelect('contact.tagMappings', 'tagMapping');
      qb.leftJoinAndSelect('tagMapping.tag', 'tag');

      const [data, total] = await qb.getManyAndCount();

      this.logger.logDbQuery('SELECT contacts with filters', data.length, {
        tenantId,
        total,
        page,
        limit,
      });
      this.logger.logOperationEnd('find all contacts', startTime, { total, returned: data.length });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('find all contacts', error as Error, { tenantId });
      throw error;
    }
  }

  private applyFilters(qb: SelectQueryBuilder<Contact>, query: ContactSearchDto): void {
    if (query.status) {
      qb.andWhere('contact.status = :status', { status: query.status });
    }

    if (query.batchYear) {
      qb.andWhere('contact.batchYear = :batchYear', { batchYear: query.batchYear });
    }

    if (query.graduationYear) {
      qb.andWhere('contact.graduationYear = :graduationYear', { graduationYear: query.graduationYear });
    }

    if (query.department) {
      qb.andWhere('contact.department ILIKE :department', { department: `%${query.department}%` });
    }

    if (query.company) {
      qb.andWhere('contact.currentCompany ILIKE :company', { company: `%${query.company}%` });
    }

    if (query.industry) {
      qb.andWhere('contact.industry ILIKE :industry', { industry: `%${query.industry}%` });
    }

    if (query.city) {
      qb.andWhere('contact.city ILIKE :city', { city: `%${query.city}%` });
    }

    if (query.country) {
      qb.andWhere('contact.country ILIKE :country', { country: `%${query.country}%` });
    }

    if (query.minEngagementScore !== undefined) {
      qb.andWhere('contact.engagementScore >= :minScore', { minScore: query.minEngagementScore });
    }

    if (query.maxEngagementScore !== undefined) {
      qb.andWhere('contact.engagementScore <= :maxScore', { maxScore: query.maxEngagementScore });
    }

    if (query.roles && query.roles.length > 0) {
      qb.andWhere('contact.roles && ARRAY[:...roles]::varchar[]', { roles: query.roles });
    }
  }

  async update(tenantId: string, id: string, data: Partial<Contact>): Promise<Contact> {
    const startTime = this.logger.logOperationStart('update contact', { tenantId, contactId: id });

    try {
      await this.contactRepo.update({ id, tenantId, isDeleted: false }, data);
      this.logger.logDbQuery('UPDATE contact', 1, { tenantId, contactId: id });

      const updated = await this.findById(tenantId, id);
      this.logger.logOperationEnd('update contact', startTime, { contactId: id });

      return updated!;
    } catch (error) {
      this.logger.logOperationError('update contact', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  async softDelete(tenantId: string, id: string, deletedBy: string): Promise<void> {
    const startTime = this.logger.logOperationStart('soft delete contact', { tenantId, contactId: id });

    try {
      await this.contactRepo.update(
        { id, tenantId },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
        },
      );

      this.logger.logDbQuery('UPDATE contact (soft delete)', 1, { tenantId, contactId: id });
      this.logger.logOperationEnd('soft delete contact', startTime);
    } catch (error) {
      this.logger.logOperationError('soft delete contact', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  // ============ TAGS ============

  async findOrCreateTag(tenantId: string, name: string, createdBy?: string): Promise<ContactTag> {
    let tag = await this.tagRepo.findOne({
      where: { tenantId, name, isDeleted: false },
    });

    if (!tag) {
      tag = this.tagRepo.create({
        tenantId,
        name,
        createdBy,
      });
      tag = await this.tagRepo.save(tag);
      this.logger.logDbQuery('INSERT tag', 1, { tenantId, tagName: name });
    }

    return tag;
  }

  async findTagById(tenantId: string, tagId: string): Promise<ContactTag | null> {
    return this.tagRepo.findOne({
      where: { id: tagId, tenantId, isDeleted: false },
    });
  }

  async addTagToContact(tenantId: string, contactId: string, tagId: string, addedBy?: string): Promise<ContactTagMapping> {
    const startTime = this.logger.logOperationStart('add tag to contact', { tenantId, contactId, tagId });

    try {
      // Check if mapping already exists
      const existing = await this.tagMappingRepo.findOne({
        where: { tenantId, contactId, tagId },
      });

      if (existing) {
        this.logger.info('Tag already mapped to contact', { tenantId, contactId, tagId });
        return existing;
      }

      const mapping = this.tagMappingRepo.create({
        tenantId,
        contactId,
        tagId,
        addedBy,
      });

      const saved = await this.tagMappingRepo.save(mapping);
      this.logger.logDbQuery('INSERT tag mapping', 1, { tenantId, contactId, tagId });
      this.logger.logOperationEnd('add tag to contact', startTime);

      return saved;
    } catch (error) {
      this.logger.logOperationError('add tag to contact', error as Error, { tenantId, contactId, tagId });
      throw error;
    }
  }

  async removeTagFromContact(tenantId: string, contactId: string, tagId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('remove tag from contact', { tenantId, contactId, tagId });

    try {
      const result = await this.tagMappingRepo.delete({ tenantId, contactId, tagId });
      this.logger.logDbQuery('DELETE tag mapping', result.affected || 0, { tenantId, contactId, tagId });
      this.logger.logOperationEnd('remove tag from contact', startTime);
    } catch (error) {
      this.logger.logOperationError('remove tag from contact', error as Error, { tenantId, contactId, tagId });
      throw error;
    }
  }

  async getContactTags(tenantId: string, contactId: string): Promise<ContactTag[]> {
    const mappings = await this.tagMappingRepo.find({
      where: { tenantId, contactId },
      relations: ['tag'],
    });

    return mappings.map((m) => m.tag).filter((t) => t && !t.isDeleted);
  }

  // ============ ATTRIBUTES ============

  async upsertAttribute(
    tenantId: string,
    contactId: string,
    key: string,
    value: string,
    valueType: AttributeType = AttributeType.STRING,
    options?: { label?: string; category?: string; isSearchable?: boolean; updatedBy?: string },
  ): Promise<ContactAttribute> {
    const startTime = this.logger.logOperationStart('upsert attribute', { tenantId, contactId, key });

    try {
      let attr = await this.attributeRepo.findOne({
        where: { tenantId, contactId, key, isDeleted: false },
      });

      if (attr) {
        attr.value = value;
        attr.valueType = valueType;
        attr.label = options?.label ?? attr.label;
        attr.category = options?.category ?? attr.category;
        attr.isSearchable = options?.isSearchable ?? attr.isSearchable;
        attr.updatedBy = options?.updatedBy;
        await this.attributeRepo.save(attr);
        this.logger.logDbQuery('UPDATE attribute', 1, { tenantId, contactId, key });
      } else {
        attr = this.attributeRepo.create({
          tenantId,
          contactId,
          key,
          value,
          valueType,
          label: options?.label,
          category: options?.category,
          isSearchable: options?.isSearchable ?? false,
          createdBy: options?.updatedBy,
        });
        await this.attributeRepo.save(attr);
        this.logger.logDbQuery('INSERT attribute', 1, { tenantId, contactId, key });
      }

      this.logger.logOperationEnd('upsert attribute', startTime);
      return attr;
    } catch (error) {
      this.logger.logOperationError('upsert attribute', error as Error, { tenantId, contactId, key });
      throw error;
    }
  }

  async getContactAttributes(tenantId: string, contactId: string): Promise<ContactAttribute[]> {
    return this.attributeRepo.find({
      where: { tenantId, contactId, isDeleted: false },
      order: { key: 'ASC' },
    });
  }

  // ============ TIMELINE ============

  async createTimelineEvent(event: Partial<ContactTimelineEvent>): Promise<ContactTimelineEvent> {
    const startTime = this.logger.logOperationStart('create timeline event', {
      tenantId: event.tenantId,
      contactId: event.contactId,
      eventType: event.eventType,
    });

    try {
      const entity = this.timelineRepo.create({
        ...event,
        occurredAt: event.occurredAt || new Date(),
      });

      const saved = await this.timelineRepo.save(entity);
      this.logger.logDbQuery('INSERT timeline event', 1, {
        tenantId: event.tenantId,
        contactId: event.contactId,
        eventType: event.eventType,
      });
      this.logger.logOperationEnd('create timeline event', startTime);

      return saved;
    } catch (error) {
      this.logger.logOperationError('create timeline event', error as Error, {
        tenantId: event.tenantId,
        contactId: event.contactId,
      });
      throw error;
    }
  }

  async getTimeline(
    tenantId: string,
    contactId: string,
    query: TimelineQueryDto,
  ): Promise<PaginatedResult<ContactTimelineEvent>> {
    const startTime = this.logger.logOperationStart('get timeline', { tenantId, contactId });

    try {
      const qb = this.timelineRepo.createQueryBuilder('event');

      qb.where('event.tenantId = :tenantId', { tenantId });
      qb.andWhere('event.contactId = :contactId', { contactId });

      if (query.eventType) {
        qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
      }

      if (query.channel) {
        qb.andWhere('event.channel = :channel', { channel: query.channel });
      }

      if (query.startDate) {
        qb.andWhere('event.occurredAt >= :startDate', { startDate: new Date(query.startDate) });
      }

      if (query.endDate) {
        qb.andWhere('event.occurredAt <= :endDate', { endDate: new Date(query.endDate) });
      }

      qb.orderBy('event.occurredAt', 'DESC');

      const page = query.page || 1;
      const limit = query.limit || 20;
      qb.skip((page - 1) * limit).take(limit);

      const [data, total] = await qb.getManyAndCount();

      this.logger.logDbQuery('SELECT timeline events', data.length, { tenantId, contactId, total });
      this.logger.logOperationEnd('get timeline', startTime, { total });

      return { data, total, page, limit };
    } catch (error) {
      this.logger.logOperationError('get timeline', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  // ============ CONSENT ============

  async upsertConsent(
    tenantId: string,
    contactId: string,
    channel: ConsentChannel,
    status: ConsentStatus,
    source: ConsentSource,
    options?: { consentText?: string; consentVersion?: string; ipAddress?: string; userAgent?: string; updatedBy?: string },
  ): Promise<ContactConsent> {
    const startTime = this.logger.logOperationStart('upsert consent', { tenantId, contactId, channel });

    try {
      let consent = await this.consentRepo.findOne({
        where: { tenantId, contactId, channel, isDeleted: false },
      });

      const now = new Date();

      if (consent) {
        consent.status = status;
        consent.source = source;
        consent.consentText = options?.consentText ?? consent.consentText;
        consent.consentVersion = options?.consentVersion ?? consent.consentVersion;
        consent.ipAddress = options?.ipAddress ?? consent.ipAddress;
        consent.userAgent = options?.userAgent ?? consent.userAgent;
        consent.updatedBy = options?.updatedBy;

        if (status === ConsentStatus.OPTED_IN) {
          consent.optedInAt = now;
        } else if (status === ConsentStatus.OPTED_OUT) {
          consent.optedOutAt = now;
        }

        await this.consentRepo.save(consent);
        this.logger.logDbQuery('UPDATE consent', 1, { tenantId, contactId, channel });
      } else {
        consent = this.consentRepo.create({
          tenantId,
          contactId,
          channel,
          status,
          source,
          consentText: options?.consentText,
          consentVersion: options?.consentVersion,
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
          updatedBy: options?.updatedBy,
          optedInAt: status === ConsentStatus.OPTED_IN ? now : undefined,
          optedOutAt: status === ConsentStatus.OPTED_OUT ? now : undefined,
        });

        await this.consentRepo.save(consent);
        this.logger.logDbQuery('INSERT consent', 1, { tenantId, contactId, channel });
      }

      this.logger.logOperationEnd('upsert consent', startTime);
      return consent;
    } catch (error) {
      this.logger.logOperationError('upsert consent', error as Error, { tenantId, contactId, channel });
      throw error;
    }
  }

  async getContactConsents(tenantId: string, contactId: string): Promise<ContactConsent[]> {
    return this.consentRepo.find({
      where: { tenantId, contactId, isDeleted: false },
    });
  }

  // ============ STATS ============

  async getContactStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byStatus: Record<string, number>;
  }> {
    const stats = await this.contactRepo
      .createQueryBuilder('contact')
      .select('contact.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('contact.tenantId = :tenantId', { tenantId })
      .andWhere('contact.isDeleted = false')
      .groupBy('contact.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    let total = 0;
    let active = 0;
    let inactive = 0;

    for (const row of stats) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;

      if (row.status === ContactStatus.ACTIVE) {
        active = count;
      } else if (row.status === ContactStatus.INACTIVE) {
        inactive = count;
      }
    }

    return { total, active, inactive, byStatus };
  }
}
