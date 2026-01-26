import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { SegmentRepository, PaginatedResult, RecomputeResult } from '../repositories/segment.repository';
import { Segment, SegmentType, SegmentStatus, SegmentRules } from '../entities/segment.entity';
import { SegmentMember, MemberSource } from '../entities/segment-member.entity';
import {
  CreateSegmentDto,
  UpdateSegmentDto,
  AddMembersDto,
  RemoveMembersDto,
  PreviewSegmentDto,
  SegmentSearchDto,
  MemberSearchDto,
  SegmentResponseDto,
  SegmentMemberResponseDto,
  PaginatedSegmentsResponseDto,
  PaginatedMembersResponseDto,
  SegmentPreviewResponseDto,
  RecomputeResponseDto,
  PaginationMeta,
} from '../dto/segment.dto';
import { SegmentMapper } from '../mappers/segment.mapper';
import { SegmentValidatorService } from '../validators/segment-validators';
import { SegmentEventType } from '../../../common/events/segment.events';

@Injectable()
export class SegmentsService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly segmentRepository: SegmentRepository,
    private readonly segmentValidator: SegmentValidatorService,
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentsService');
  }

  // ============ CRUD Operations ============

  /**
   * Create a new segment
   */
  async create(dto: CreateSegmentDto, userId: string, tenantId: string): Promise<SegmentResponseDto> {
    const startTime = this.logger.logOperationStart('create segment', {
      name: dto.name,
      type: dto.type,
      tenantId,
      userId,
    });

    try {
      // Validate the request
      const validation = this.segmentValidator.validateCreate(dto);
      if (!validation.isValid) {
        this.logger.warn('Segment validation failed', { errors: validation.errors });
        throw new BadRequestException({
          message: 'Segment validation failed',
          errors: validation.errors,
        });
      }

      // Check for duplicate name
      const existing = await this.segmentRepository.findByName(tenantId, dto.name);
      if (existing) {
        this.logger.warn('Segment name already exists', { name: dto.name, tenantId });
        throw new ConflictException(`Segment with name "${dto.name}" already exists`);
      }

      // Create segment entity
      const segment = new Segment();
      segment.id = uuidv4();
      segment.tenantId = tenantId;
      segment.name = dto.name;
      segment.description = dto.description;
      segment.type = dto.type;
      segment.status = SegmentStatus.ACTIVE;
      segment.rules = dto.rules as unknown as SegmentRules;
      segment.eventConfig = dto.eventConfig;
      segment.metadata = dto.metadata || {};
      segment.color = dto.color || '#4F46E5';
      segment.folder = dto.folder;
      segment.tags = dto.tags || [];
      segment.refreshIntervalMinutes = dto.refreshIntervalMinutes || 60;
      segment.createdBy = userId;
      segment.updatedBy = userId;
      segment.memberCount = 0;

      const saved = await this.segmentRepository.create(segment);

      // For dynamic segments, compute initial membership
      if (dto.type === SegmentType.DYNAMIC && dto.rules) {
        this.logger.log('Computing initial membership for dynamic segment', { segmentId: saved.id });
        const batchId = uuidv4();
        await this.segmentRepository.recomputeMembers(
          tenantId,
          saved.id,
          dto.rules as unknown as SegmentRules,
          batchId,
        );
      }

      // Publish event
      await this.publishEvent(SegmentEventType.SEGMENT_CREATED, saved, tenantId);

      const response = SegmentMapper.toResponseDto(saved);

      this.logger.logOperationEnd('create segment', startTime, {
        segmentId: saved.id,
        type: saved.type,
        memberCount: saved.memberCount,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('create segment', startTime, {
        error: (error as Error).message,
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Get segment by ID
   */
  async findById(id: string, tenantId: string): Promise<SegmentResponseDto> {
    const startTime = this.logger.logOperationStart('find segment by id', { id, tenantId });

    try {
      const segment = await this.segmentRepository.findById(tenantId, id);
      if (!segment) {
        this.logger.warn('Segment not found', { id, tenantId });
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      const response = SegmentMapper.toResponseDto(segment);

      this.logger.logOperationEnd('find segment by id', startTime, { found: true });
      return response;
    } catch (error) {
      this.logger.logOperationEnd('find segment by id', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Find all segments with search/filter/pagination
   */
  async findAll(search: SegmentSearchDto, tenantId: string): Promise<PaginatedSegmentsResponseDto> {
    const startTime = this.logger.logOperationStart('find all segments', { ...search, tenantId });

    try {
      const result = await this.segmentRepository.findAll(tenantId, search);

      const totalPages = Math.ceil(result.total / result.limit);
      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      const response: PaginatedSegmentsResponseDto = {
        data: result.data.map(SegmentMapper.toResponseDto),
        meta,
      };

      this.logger.logOperationEnd('find all segments', startTime, {
        resultCount: result.data.length,
        total: result.total,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('find all segments', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update a segment
   */
  async update(
    id: string,
    dto: UpdateSegmentDto,
    userId: string,
    tenantId: string,
  ): Promise<SegmentResponseDto> {
    const startTime = this.logger.logOperationStart('update segment', { id, tenantId, userId });

    try {
      // Find existing segment
      const existing = await this.segmentRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      // Validate update
      const validation = this.segmentValidator.validateUpdate(dto, existing.type);
      if (!validation.isValid) {
        this.logger.warn('Segment update validation failed', { errors: validation.errors });
        throw new BadRequestException({
          message: 'Segment update validation failed',
          errors: validation.errors,
        });
      }

      // Check name conflict if name is being updated
      if (dto.name && dto.name !== existing.name) {
        const nameConflict = await this.segmentRepository.findByName(tenantId, dto.name);
        if (nameConflict) {
          throw new ConflictException(`Segment with name "${dto.name}" already exists`);
        }
      }

      // Build updates object
      const updates: Partial<Segment> = {
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.description !== undefined) updates.description = dto.description;
      if (dto.status !== undefined) updates.status = dto.status;
      if (dto.rules !== undefined) updates.rules = dto.rules as unknown as SegmentRules;
      if (dto.eventConfig !== undefined) updates.eventConfig = dto.eventConfig;
      if (dto.folder !== undefined) updates.folder = dto.folder;
      if (dto.tags !== undefined) updates.tags = dto.tags;
      if (dto.color !== undefined) updates.color = dto.color;
      if (dto.refreshIntervalMinutes !== undefined) updates.refreshIntervalMinutes = dto.refreshIntervalMinutes;
      if (dto.metadata !== undefined) updates.metadata = dto.metadata;

      // Update segment
      const segment = await this.segmentRepository.update(tenantId, id, updates);

      // Recompute if rules changed for dynamic segment
      if (dto.rules && segment.type === SegmentType.DYNAMIC) {
        this.logger.log('Rules updated, recomputing membership', { segmentId: id });
        const batchId = uuidv4();
        await this.segmentRepository.recomputeMembers(
          tenantId,
          id,
          dto.rules as unknown as SegmentRules,
          batchId,
        );
      }

      // Publish event
      await this.publishEvent(SegmentEventType.SEGMENT_UPDATED, segment, tenantId);

      const response = SegmentMapper.toResponseDto(segment);

      this.logger.logOperationEnd('update segment', startTime, {
        segmentId: segment.id,
        rulesChanged: !!dto.rules,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('update segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Soft delete a segment
   */
  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    const startTime = this.logger.logOperationStart('delete segment', { id, tenantId, userId });

    try {
      const segment = await this.segmentRepository.findById(tenantId, id);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      await this.segmentRepository.softDelete(tenantId, id, userId);

      // Publish event
      await this.publishEvent(SegmentEventType.SEGMENT_DELETED, segment, tenantId);

      this.logger.logOperationEnd('delete segment', startTime, { deleted: true });
    } catch (error) {
      this.logger.logOperationEnd('delete segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  // ============ Member Operations ============

  /**
   * Get segment members with pagination
   */
  async getMembers(
    segmentId: string,
    search: MemberSearchDto,
    tenantId: string,
  ): Promise<PaginatedMembersResponseDto> {
    const startTime = this.logger.logOperationStart('get segment members', {
      segmentId,
      ...search,
      tenantId,
    });

    try {
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      const result = await this.segmentRepository.getMembers(tenantId, segmentId, search);

      const totalPages = Math.ceil(result.total / result.limit);
      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      const response: PaginatedMembersResponseDto = {
        data: result.data.map(SegmentMapper.toMemberResponseDto),
        meta,
      };

      this.logger.logOperationEnd('get segment members', startTime, {
        memberCount: result.data.length,
        total: result.total,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('get segment members', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Add members to a static segment
   */
  async addMembers(
    segmentId: string,
    dto: AddMembersDto,
    userId: string,
    tenantId: string,
  ): Promise<{ added: number }> {
    const startTime = this.logger.logOperationStart('add segment members', {
      segmentId,
      contactCount: dto.contactIds.length,
      tenantId,
      userId,
    });

    try {
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      // Only static segments can have manual members
      if (segment.type !== SegmentType.STATIC) {
        throw new BadRequestException('Only static segments can have manually added members');
      }

      const addedCount = await this.segmentRepository.addMembers(
        tenantId,
        segmentId,
        dto.contactIds,
        dto.source || MemberSource.MANUAL,
        userId,
      );

      // Publish membership updated event
      await this.publishEvent(SegmentEventType.SEGMENT_MEMBERSHIP_UPDATED, segment, tenantId, {
        action: 'added',
        contactIds: dto.contactIds,
        addedCount,
      });

      this.logger.logOperationEnd('add segment members', startTime, { added: addedCount });
      return { added: addedCount };
    } catch (error) {
      this.logger.logOperationEnd('add segment members', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Remove members from a static segment
   */
  async removeMembers(
    segmentId: string,
    dto: RemoveMembersDto,
    userId: string,
    tenantId: string,
  ): Promise<{ removed: number }> {
    const startTime = this.logger.logOperationStart('remove segment members', {
      segmentId,
      contactCount: dto.contactIds.length,
      tenantId,
      userId,
    });

    try {
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      // Only static segments can have members removed
      if (segment.type !== SegmentType.STATIC) {
        throw new BadRequestException('Only static segments can have members manually removed');
      }

      const removedCount = await this.segmentRepository.removeMembers(
        tenantId,
        segmentId,
        dto.contactIds,
      );

      // Publish membership updated event
      await this.publishEvent(SegmentEventType.SEGMENT_MEMBERSHIP_UPDATED, segment, tenantId, {
        action: 'removed',
        contactIds: dto.contactIds,
        removedCount,
      });

      this.logger.logOperationEnd('remove segment members', startTime, { removed: removedCount });
      return { removed: removedCount };
    } catch (error) {
      this.logger.logOperationEnd('remove segment members', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Check if a contact is a member of a segment
   */
  async isMember(segmentId: string, contactId: string, tenantId: string): Promise<boolean> {
    const startTime = this.logger.logOperationStart('check segment membership', {
      segmentId,
      contactId,
      tenantId,
    });

    try {
      const result = await this.segmentRepository.isMember(tenantId, segmentId, contactId);

      this.logger.logOperationEnd('check segment membership', startTime, { isMember: result });
      return result;
    } catch (error) {
      this.logger.logOperationEnd('check segment membership', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  // ============ Segment Operations ============

  /**
   * Preview segment rules without saving
   */
  async preview(
    segmentId: string,
    dto: PreviewSegmentDto,
    tenantId: string,
  ): Promise<SegmentPreviewResponseDto> {
    const startTime = this.logger.logOperationStart('preview segment', { segmentId, tenantId });

    try {
      // Get segment
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      // Use provided rules or segment's existing rules
      const rulesToPreview = dto.rules || segment.rules;
      if (!rulesToPreview) {
        throw new BadRequestException('No rules to preview');
      }

      // Validate rules
      const validation = this.segmentValidator.validateRules(rulesToPreview as unknown as SegmentRules);
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'Rule validation failed',
          errors: validation.errors,
        });
      }

      const limit = dto.limit || 100;
      const result = await this.segmentRepository.previewRules(
        tenantId,
        rulesToPreview as unknown as SegmentRules,
        limit,
      );

      const response: SegmentPreviewResponseDto = {
        segmentId,
        totalMatches: result.count,
        contacts: result.sample,
        queryDurationMs: result.durationMs,
        rulesApplied: dto.rules || (segment.rules as any),
      };

      this.logger.logOperationEnd('preview segment', startTime, {
        matchingCount: result.count,
        sampleSize: result.sample.length,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('preview segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Force recompute segment membership
   */
  async recompute(segmentId: string, userId: string, tenantId: string): Promise<RecomputeResponseDto> {
    const startTime = this.logger.logOperationStart('recompute segment', {
      segmentId,
      tenantId,
      userId,
    });

    try {
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      if (segment.type !== SegmentType.DYNAMIC) {
        throw new BadRequestException('Only dynamic segments can be recomputed');
      }

      if (!segment.rules) {
        throw new BadRequestException('Segment has no rules defined');
      }

      const batchId = uuidv4();
      const result = await this.segmentRepository.recomputeMembers(
        tenantId,
        segmentId,
        segment.rules,
        batchId,
      );

      // Publish refresh event
      await this.publishEvent(SegmentEventType.SEGMENT_REFRESHED, segment, tenantId, {
        previousCount: result.previousCount,
        newCount: result.newCount,
        addedCount: result.addedCount,
        removedCount: result.removedCount,
        batchId,
      });

      const response: RecomputeResponseDto = {
        segmentId,
        previousCount: result.previousCount,
        newCount: result.newCount,
        added: result.addedCount,
        removed: result.removedCount,
        durationMs: result.durationMs,
        batchId: result.batchId,
      };

      this.logger.logOperationEnd('recompute segment', startTime, {
        segmentId: response.segmentId,
        previousCount: response.previousCount,
        newCount: response.newCount,
        added: response.added,
        removed: response.removed,
        durationMs: response.durationMs,
      });
      return response;
    } catch (error) {
      this.logger.logOperationEnd('recompute segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get count of members in a segment
   */
  async getMemberCount(segmentId: string, tenantId: string): Promise<number> {
    const startTime = this.logger.logOperationStart('get segment member count', {
      segmentId,
      tenantId,
    });

    try {
      const segment = await this.segmentRepository.findById(tenantId, segmentId);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${segmentId} not found`);
      }

      this.logger.logOperationEnd('get segment member count', startTime, {
        count: segment.memberCount,
      });

      return segment.memberCount;
    } catch (error) {
      this.logger.logOperationEnd('get segment member count', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get segments a contact belongs to
   */
  async getContactSegments(contactId: string, tenantId: string): Promise<SegmentResponseDto[]> {
    const startTime = this.logger.logOperationStart('get contact segments', {
      contactId,
      tenantId,
    });

    try {
      const segments = await this.segmentRepository.findByContactId(tenantId, contactId);
      const response = segments.map(SegmentMapper.toResponseDto);

      this.logger.logOperationEnd('get contact segments', startTime, {
        segmentCount: segments.length,
      });

      return response;
    } catch (error) {
      this.logger.logOperationEnd('get contact segments', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Archive a segment
   */
  async archive(id: string, userId: string, tenantId: string): Promise<SegmentResponseDto> {
    const startTime = this.logger.logOperationStart('archive segment', { id, tenantId, userId });

    try {
      const segment = await this.segmentRepository.findById(tenantId, id);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      const updated = await this.segmentRepository.update(tenantId, id, {
        status: SegmentStatus.ARCHIVED,
        updatedBy: userId,
        updatedAt: new Date(),
      });

      await this.publishEvent(SegmentEventType.SEGMENT_UPDATED, updated, tenantId, {
        action: 'archived',
      });

      const response = SegmentMapper.toResponseDto(updated);

      this.logger.logOperationEnd('archive segment', startTime, { archived: true });
      return response;
    } catch (error) {
      this.logger.logOperationEnd('archive segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Unarchive a segment
   */
  async unarchive(id: string, userId: string, tenantId: string): Promise<SegmentResponseDto> {
    const startTime = this.logger.logOperationStart('unarchive segment', { id, tenantId, userId });

    try {
      const segment = await this.segmentRepository.findById(tenantId, id);
      if (!segment) {
        throw new NotFoundException(`Segment with ID ${id} not found`);
      }

      if (segment.status !== SegmentStatus.ARCHIVED) {
        throw new BadRequestException('Segment is not archived');
      }

      const updated = await this.segmentRepository.update(tenantId, id, {
        status: SegmentStatus.ACTIVE,
        updatedBy: userId,
        updatedAt: new Date(),
      });

      await this.publishEvent(SegmentEventType.SEGMENT_UPDATED, updated, tenantId, {
        action: 'unarchived',
      });

      const response = SegmentMapper.toResponseDto(updated);

      this.logger.logOperationEnd('unarchive segment', startTime, { unarchived: true });
      return response;
    } catch (error) {
      this.logger.logOperationEnd('unarchive segment', startTime, { error: (error as Error).message });
      throw error;
    }
  }

  // ============ Event Publishing ============

  private async publishEvent(
    eventType: SegmentEventType,
    segment: Segment,
    tenantId: string,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const payload = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        tenantId,
        payload: {
          segmentId: segment.id,
          name: segment.name,
          type: segment.type,
          ...additionalData,
        },
      };

      await this.natsClient.emit(eventType, payload).toPromise();

      this.logger.debug('Published segment event', {
        eventType,
        segmentId: segment.id,
        tenantId,
      });
    } catch (error) {
      this.logger.error('Failed to publish segment event', (error as Error).stack, {
        eventType,
        segmentId: segment.id,
        errorMessage: (error as Error).message,
      });
      // Don't throw - event publishing failure shouldn't fail the operation
    }
  }
}
