import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ContactRepository, PaginatedResult } from './repositories/contact.repository';
import { ContactSearchService, SearchResponse } from './services/contact-search.service';
import { EventBusService } from '../../common/services/event-bus.service';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { ContactMapper } from './mappers/contact.mapper';
import { Contact, ContactStatus } from './entities/contact.entity';
import { ContactTimelineEvent, TimelineEventType } from './entities/contact-timeline-event.entity';
import { ConsentChannel, ConsentStatus, ConsentSource } from './entities/contact-consent.entity';
import { AttributeType } from './entities/contact-attribute.entity';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactResponseDto,
  ContactSearchDto,
  AddTagDto,
  AddAttributeDto,
  UpdateConsentDto,
  TimelineQueryDto,
  TimelineEventResponseDto,
  AttributeResponseDto,
  ConsentResponseDto,
  PaginatedResponseDto,
  PaginationMeta,
} from './dto/contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly repository: ContactRepository,
    private readonly searchService: ContactSearchService,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('ContactsService');
    this.logger.info('ContactsService initialized');
  }

  // ============ CREATE ============

  async create(
    tenantId: string,
    dto: CreateContactDto,
    userId: string,
    correlationId: string,
  ): Promise<ContactResponseDto> {
    const startTime = this.logger.logOperationStart('create contact', {
      tenantId,
      correlationId,
      userId,
    });

    try {
      // Check for duplicate email
      if (dto.email) {
        const existing = await this.repository.findByEmail(tenantId, dto.email);
        if (existing) {
          this.logger.warn('Duplicate email detected', { tenantId, email: dto.email });
          throw new ConflictException(`Contact with email ${dto.email} already exists`);
        }
      }

      // Create contact entity
      const contact = new Contact();
      contact.tenantId = tenantId;
      contact.fullName = dto.fullName;
      contact.preferredName = dto.preferredName;
      contact.email = dto.email;
      contact.emailSecondary = dto.emailSecondary;
      contact.phone = dto.phone;
      contact.phoneCountryCode = dto.phoneCountryCode;
      contact.whatsapp = dto.whatsapp;
      contact.profileImageUrl = dto.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dto.fullName}`;
      contact.salutation = dto.salutation;
      contact.firstName = dto.firstName;
      contact.lastName = dto.lastName;
      contact.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined;
      contact.gender = dto.gender;
      contact.externalId = dto.externalId;
      contact.roles = dto.roles || ['alumnus'];
      contact.preferredLanguage = dto.preferredLanguage || 'en';
      contact.metadata = dto.metadata;
      contact.status = ContactStatus.ACTIVE;
      contact.engagementScore = 50;
      contact.createdBy = userId;

      // Apply nested DTOs
      ContactMapper.applyAcademicInfo(contact, dto.academic);
      ContactMapper.applyProfessionalInfo(contact, dto.professional);
      ContactMapper.applyLocationInfo(contact, dto.location);

      const saved = await this.repository.create(contact);
      this.logger.info('Contact created', { tenantId, contactId: saved.id, correlationId });

      // Add tags if provided
      if (dto.tagIds && dto.tagIds.length > 0) {
        this.logger.debug('Adding tags to new contact', { tagCount: dto.tagIds.length });
        for (const tagId of dto.tagIds) {
          await this.repository.addTagToContact(tenantId, saved.id, tagId, userId);
        }
      }

      // Create timeline event
      await this.repository.createTimelineEvent({
        tenantId,
        contactId: saved.id,
        eventType: TimelineEventType.CONTACT_CREATED,
        title: 'Contact created',
        description: `Contact ${saved.fullName} was created`,
        actorId: userId,
        actorType: 'user',
        correlationId,
      });

      // Index in search
      await this.searchService.indexContact(saved);

      // Publish event
      await this.eventBus.publishContactCreated(
        tenantId,
        {
          contactId: saved.id,
          fullName: saved.fullName,
          email: saved.email,
          phone: saved.phone,
          createdBy: userId,
        },
        correlationId,
      );

      // Fetch with relations
      const result = await this.repository.findById(tenantId, saved.id);
      this.logger.logOperationEnd('create contact', startTime, { contactId: saved.id });

      return ContactMapper.toResponseDto(result!);
    } catch (error) {
      this.logger.logOperationError('create contact', error as Error, { tenantId, correlationId });
      throw error;
    }
  }

  // ============ READ ============

  async findById(tenantId: string, id: string, correlationId: string): Promise<ContactResponseDto> {
    const startTime = this.logger.logOperationStart('find contact by id', {
      tenantId,
      contactId: id,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, id);

      if (!contact) {
        this.logger.warn('Contact not found', { tenantId, contactId: id });
        throw new NotFoundException(`Contact with ID ${id} not found`);
      }

      this.logger.logOperationEnd('find contact by id', startTime, { found: true });
      return ContactMapper.toResponseDto(contact);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('find contact by id', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    query: ContactSearchDto,
    correlationId: string,
  ): Promise<PaginatedResponseDto<ContactResponseDto>> {
    const startTime = this.logger.logOperationStart('find all contacts', {
      tenantId,
      correlationId,
      page: query.page,
      limit: query.limit,
    });

    try {
      const result = await this.repository.findAll(tenantId, query);

      const data = result.data.map((c) => ContactMapper.toResponseDto(c));
      const totalPages = Math.ceil(result.total / result.limit);

      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      this.logger.logOperationEnd('find all contacts', startTime, {
        total: result.total,
        returned: data.length,
      });

      return { data, meta };
    } catch (error) {
      this.logger.logOperationError('find all contacts', error as Error, { tenantId });
      throw error;
    }
  }

  async search(
    tenantId: string,
    query: string,
    limit: number,
    correlationId: string,
  ): Promise<SearchResponse> {
    const startTime = this.logger.logOperationStart('search contacts', {
      tenantId,
      query,
      correlationId,
    });

    try {
      const result = await this.searchService.search(tenantId, query, { limit });

      this.logger.logOperationEnd('search contacts', startTime, {
        total: result.total,
        took: result.took,
      });

      return result;
    } catch (error) {
      this.logger.logOperationError('search contacts', error as Error, { tenantId, query });
      throw error;
    }
  }

  // ============ UPDATE ============

  async update(
    tenantId: string,
    id: string,
    dto: UpdateContactDto,
    userId: string,
    correlationId: string,
  ): Promise<ContactResponseDto> {
    const startTime = this.logger.logOperationStart('update contact', {
      tenantId,
      contactId: id,
      correlationId,
    });

    try {
      const existing = await this.repository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Contact with ID ${id} not found`);
      }

      // Check for email conflict
      if (dto.email && dto.email !== existing.email) {
        const emailConflict = await this.repository.findByEmail(tenantId, dto.email);
        if (emailConflict && emailConflict.id !== id) {
          throw new ConflictException(`Email ${dto.email} is already in use`);
        }
      }

      // Track changes for event
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      // Build update payload
      const updateData: Partial<Contact> = { updatedBy: userId };

      const simpleFields = [
        'fullName', 'preferredName', 'email', 'emailSecondary', 'phone', 'phoneCountryCode',
        'whatsapp', 'profileImageUrl', 'salutation', 'firstName', 'lastName', 'gender',
        'externalId', 'preferredLanguage', 'status', 'engagementScore',
      ] as const;

      for (const field of simpleFields) {
        if (dto[field] !== undefined && dto[field] !== existing[field]) {
          changes[field] = { old: existing[field], new: dto[field] };
          (updateData as Record<string, unknown>)[field] = dto[field];
        }
      }

      if (dto.dateOfBirth) {
        updateData.dateOfBirth = new Date(dto.dateOfBirth);
      }

      if (dto.roles) {
        updateData.roles = dto.roles;
      }

      if (dto.metadata) {
        updateData.metadata = { ...existing.metadata, ...dto.metadata };
      }

      // Apply nested updates
      if (dto.academic) {
        ContactMapper.applyAcademicInfo(existing, dto.academic);
        Object.assign(updateData, {
          program: existing.program,
          specialization: existing.specialization,
          batchYear: existing.batchYear,
          graduationYear: existing.graduationYear,
          department: existing.department,
          rollNumber: existing.rollNumber,
          degree: existing.degree,
        });
      }

      if (dto.professional) {
        ContactMapper.applyProfessionalInfo(existing, dto.professional);
        Object.assign(updateData, {
          currentCompany: existing.currentCompany,
          designation: existing.designation,
          industry: existing.industry,
          linkedinUrl: existing.linkedinUrl,
          yearsOfExperience: existing.yearsOfExperience,
          skills: existing.skills,
        });
      }

      if (dto.location) {
        ContactMapper.applyLocationInfo(existing, dto.location);
        Object.assign(updateData, {
          city: existing.city,
          state: existing.state,
          country: existing.country,
          postalCode: existing.postalCode,
          timezone: existing.timezone,
        });
      }

      const updated = await this.repository.update(tenantId, id, updateData);
      this.logger.info('Contact updated', { tenantId, contactId: id, changesCount: Object.keys(changes).length });

      // Create timeline event
      if (Object.keys(changes).length > 0) {
        await this.repository.createTimelineEvent({
          tenantId,
          contactId: id,
          eventType: TimelineEventType.CONTACT_UPDATED,
          title: 'Contact updated',
          description: `Updated fields: ${Object.keys(changes).join(', ')}`,
          data: { changes },
          actorId: userId,
          actorType: 'user',
          correlationId,
        });
      }

      // Update search index
      await this.searchService.indexContact(updated);

      // Publish event
      if (Object.keys(changes).length > 0) {
        await this.eventBus.publishContactUpdated(
          tenantId,
          { contactId: id, changes, updatedBy: userId },
          correlationId,
        );
      }

      this.logger.logOperationEnd('update contact', startTime, { contactId: id });
      return ContactMapper.toResponseDto(updated);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.logOperationError('update contact', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  // ============ DELETE ============

  async delete(tenantId: string, id: string, userId: string, correlationId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('delete contact', {
      tenantId,
      contactId: id,
      correlationId,
    });

    try {
      const existing = await this.repository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Contact with ID ${id} not found`);
      }

      await this.repository.softDelete(tenantId, id, userId);
      this.logger.info('Contact soft deleted', { tenantId, contactId: id });

      // Remove from search index
      await this.searchService.removeFromIndex(id);

      // Publish event
      await this.eventBus.publishContactDeleted(
        tenantId,
        { contactId: id, deletedBy: userId, hardDelete: false },
        correlationId,
      );

      this.logger.logOperationEnd('delete contact', startTime);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('delete contact', error as Error, { tenantId, contactId: id });
      throw error;
    }
  }

  // ============ TAGS ============

  async addTag(
    tenantId: string,
    contactId: string,
    dto: AddTagDto,
    userId: string,
    correlationId: string,
  ): Promise<ContactResponseDto> {
    const startTime = this.logger.logOperationStart('add tag', {
      tenantId,
      contactId,
      tagId: dto.tagId,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, contactId);
      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      const tag = await this.repository.findTagById(tenantId, dto.tagId);
      if (!tag) {
        throw new NotFoundException(`Tag with ID ${dto.tagId} not found`);
      }

      await this.repository.addTagToContact(tenantId, contactId, dto.tagId, userId);

      // Create timeline event
      await this.repository.createTimelineEvent({
        tenantId,
        contactId,
        eventType: TimelineEventType.TAG_ADDED,
        title: 'Tag added',
        description: `Tag "${tag.name}" was added`,
        data: { tagId: dto.tagId, tagName: tag.name },
        actorId: userId,
        actorType: 'user',
        correlationId,
      });

      // Publish event
      await this.eventBus.publishContactTagAdded(
        tenantId,
        { contactId, tagId: dto.tagId, tagName: tag.name, addedBy: userId },
        correlationId,
      );

      const updated = await this.repository.findById(tenantId, contactId);
      this.logger.logOperationEnd('add tag', startTime);

      return ContactMapper.toResponseDto(updated!);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('add tag', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  async removeTag(
    tenantId: string,
    contactId: string,
    tagId: string,
    userId: string,
    correlationId: string,
  ): Promise<ContactResponseDto> {
    const startTime = this.logger.logOperationStart('remove tag', {
      tenantId,
      contactId,
      tagId,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, contactId);
      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      const tag = await this.repository.findTagById(tenantId, tagId);
      const tagName = tag?.name || 'Unknown';

      await this.repository.removeTagFromContact(tenantId, contactId, tagId);

      // Create timeline event
      await this.repository.createTimelineEvent({
        tenantId,
        contactId,
        eventType: TimelineEventType.TAG_REMOVED,
        title: 'Tag removed',
        description: `Tag "${tagName}" was removed`,
        data: { tagId, tagName },
        actorId: userId,
        actorType: 'user',
        correlationId,
      });

      // Publish event
      await this.eventBus.publishContactTagRemoved(
        tenantId,
        { contactId, tagId, tagName, removedBy: userId },
        correlationId,
      );

      const updated = await this.repository.findById(tenantId, contactId);
      this.logger.logOperationEnd('remove tag', startTime);

      return ContactMapper.toResponseDto(updated!);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('remove tag', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  // ============ ATTRIBUTES ============

  async addOrUpdateAttribute(
    tenantId: string,
    contactId: string,
    dto: AddAttributeDto,
    userId: string,
    correlationId: string,
  ): Promise<AttributeResponseDto> {
    const startTime = this.logger.logOperationStart('add/update attribute', {
      tenantId,
      contactId,
      key: dto.key,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, contactId);
      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      const valueType = (dto.valueType as AttributeType) || AttributeType.STRING;
      const attr = await this.repository.upsertAttribute(
        tenantId,
        contactId,
        dto.key,
        dto.value,
        valueType,
        {
          label: dto.label,
          category: dto.category,
          isSearchable: dto.isSearchable,
          updatedBy: userId,
        },
      );

      // Create timeline event
      await this.repository.createTimelineEvent({
        tenantId,
        contactId,
        eventType: TimelineEventType.ATTRIBUTE_UPDATED,
        title: 'Attribute updated',
        description: `Attribute "${dto.key}" was updated`,
        data: { key: dto.key, value: dto.value },
        actorId: userId,
        actorType: 'user',
        correlationId,
      });

      // Publish event
      await this.eventBus.publishContactAttributeUpdated(
        tenantId,
        { contactId, key: dto.key, value: dto.value, updatedBy: userId },
        correlationId,
      );

      this.logger.logOperationEnd('add/update attribute', startTime);
      return ContactMapper.toAttributeResponseDto(attr);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('add/update attribute', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  // ============ TIMELINE ============

  async getTimeline(
    tenantId: string,
    contactId: string,
    query: TimelineQueryDto,
    correlationId: string,
  ): Promise<PaginatedResponseDto<TimelineEventResponseDto>> {
    const startTime = this.logger.logOperationStart('get timeline', {
      tenantId,
      contactId,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, contactId);
      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      const result = await this.repository.getTimeline(tenantId, contactId, query);

      const data = result.data.map((e) => ContactMapper.toTimelineEventResponseDto(e));
      const totalPages = Math.ceil(result.total / result.limit);

      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      this.logger.logOperationEnd('get timeline', startTime, { total: result.total });
      return { data, meta };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('get timeline', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  // ============ CONSENT ============

  async updateConsent(
    tenantId: string,
    contactId: string,
    dto: UpdateConsentDto,
    userId: string,
    correlationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ConsentResponseDto> {
    const startTime = this.logger.logOperationStart('update consent', {
      tenantId,
      contactId,
      channel: dto.channel,
      correlationId,
    });

    try {
      const contact = await this.repository.findById(tenantId, contactId);
      if (!contact) {
        throw new NotFoundException(`Contact with ID ${contactId} not found`);
      }

      const channel = dto.channel as ConsentChannel;
      const status = dto.status === 'opted_in' ? ConsentStatus.OPTED_IN : ConsentStatus.OPTED_OUT;
      const source = (dto.source as ConsentSource) || ConsentSource.USER_REQUEST;

      // Get previous consent for event
      const existingConsents = await this.repository.getContactConsents(tenantId, contactId);
      const previousConsent = existingConsents.find((c) => c.channel === channel);
      const previousStatus = previousConsent?.status;

      const consent = await this.repository.upsertConsent(tenantId, contactId, channel, status, source, {
        consentText: dto.consentText,
        consentVersion: dto.consentVersion,
        ipAddress,
        userAgent,
        updatedBy: userId,
      });

      // Create timeline event
      await this.repository.createTimelineEvent({
        tenantId,
        contactId,
        eventType: TimelineEventType.CONSENT_UPDATED,
        title: 'Consent updated',
        description: `Consent for ${channel} updated to ${status}`,
        channel,
        data: { channel, status, previousStatus, source },
        actorId: userId,
        actorType: 'user',
        correlationId,
        ipAddress,
        userAgent,
      });

      // Publish event
      await this.eventBus.publishContactConsentUpdated(
        tenantId,
        { contactId, channel, status, previousStatus, source, updatedBy: userId },
        correlationId,
      );

      this.logger.logOperationEnd('update consent', startTime);
      return ContactMapper.toConsentResponseDto(consent);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.logOperationError('update consent', error as Error, { tenantId, contactId });
      throw error;
    }
  }

  // ============ STATS ============

  async getStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byStatus: Record<string, number>;
  }> {
    const startTime = this.logger.logOperationStart('get contact stats', { tenantId });
    try {
      const stats = await this.repository.getContactStats(tenantId);
      this.logger.logOperationEnd('get contact stats', startTime, { total: stats.total });
      return stats;
    } catch (error) {
      this.logger.logOperationError('get contact stats', error as Error, { tenantId });
      throw error;
    }
  }

  // ============ SEARCH INDEX REBUILD ============

  async rebuildSearchIndex(tenantId: string): Promise<{ indexed: number; failed: number }> {
    const startTime = this.logger.logOperationStart('rebuild search index', { tenantId });

    try {
      // Fetch all contacts for tenant
      const result = await this.repository.findAll(tenantId, { page: 1, limit: 100000 });
      const stats = await this.searchService.rebuildIndex(tenantId, result.data);

      this.logger.logOperationEnd('rebuild search index', startTime, stats);
      return stats;
    } catch (error) {
      this.logger.logOperationError('rebuild search index', error as Error, { tenantId });
      throw error;
    }
  }
}
