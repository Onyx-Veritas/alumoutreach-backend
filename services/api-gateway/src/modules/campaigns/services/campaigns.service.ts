import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { CampaignRepository, PaginatedResult } from '../repositories/campaign.repository';
import { Campaign, CampaignChannel, CampaignStatus } from '../entities/campaign.entity';
import { CampaignRun, CampaignRunStatus } from '../entities/campaign-run.entity';
import { CampaignMessage, DispatchStatus } from '../entities/campaign-message.entity';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ScheduleCampaignDto,
  CampaignPreviewDto,
  CampaignSearchDto,
  CampaignMessageSearchDto,
  CampaignResponseDto,
  CampaignPreviewResponseDto,
  PaginatedCampaignsResponseDto,
  PaginatedMessagesResponseDto,
  PaginationMeta,
} from '../dto/campaign.dto';
import { CampaignMapper } from '../mappers/campaign.mapper';
import {
  CampaignEventType,
  CampaignSubjects,
  CampaignCreatedEvent,
  CampaignUpdatedEvent,
  CampaignDeletedEvent,
  CampaignScheduledEvent,
  CampaignCancelledEvent,
} from '../events/campaign.events';

@Injectable()
export class CampaignsService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly eventBus: EventBusService,
  ) {
    this.logger = new AppLoggerService();
    this.logger.setContext('CampaignsService');
  }

  // ============ CRUD Operations ============

  async create(
    tenantId: string,
    dto: CreateCampaignDto,
    userId: string,
    correlationId: string,
  ): Promise<CampaignResponseDto> {
    const startTime = this.logger.logOperationStart('create campaign', {
      tenantId,
      name: dto.name,
      channel: dto.channel,
      correlationId,
    });

    try {
      // Check for duplicate name
      const existing = await this.campaignRepository.findByName(tenantId, dto.name);
      if (existing) {
        throw new ConflictException(`Campaign with name "${dto.name}" already exists`);
      }

      // Create campaign entity
      const campaign = new Campaign();
      campaign.id = uuidv4();
      campaign.tenantId = tenantId;
      campaign.name = dto.name;
      campaign.description = dto.description;
      campaign.channel = dto.channel;
      campaign.templateVersionId = dto.templateVersionId;
      campaign.segmentId = dto.segmentId;
      campaign.scheduleAt = dto.scheduleAt ? new Date(dto.scheduleAt) : undefined;
      campaign.status = dto.scheduleAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;
      campaign.metadata = dto.metadata;
      campaign.createdBy = userId;
      campaign.updatedBy = userId;
      campaign.isDeleted = false;

      const saved = await this.campaignRepository.create(campaign);

      // Publish event
      await this.publishEvent(CampaignSubjects.CREATED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_CREATED,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: saved.id,
          name: saved.name,
          channel: saved.channel,
          segmentId: saved.segmentId,
          templateVersionId: saved.templateVersionId,
          createdBy: userId,
        },
      } as CampaignCreatedEvent);

      this.logger.logOperationEnd('create campaign', startTime, {
        campaignId: saved.id,
        status: saved.status,
      });

      return CampaignMapper.toResponseDto(saved);
    } catch (error) {
      this.logger.logOperationError('create campaign', error as Error, { correlationId });
      throw error;
    }
  }

  async findById(
    tenantId: string,
    id: string,
    correlationId: string,
  ): Promise<CampaignResponseDto> {
    const startTime = this.logger.logOperationStart('find campaign by id', {
      tenantId,
      id,
      correlationId,
    });

    try {
      const campaign = await this.campaignRepository.findById(tenantId, id);
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      this.logger.logOperationEnd('find campaign by id', startTime);
      return CampaignMapper.toResponseDto(campaign);
    } catch (error) {
      this.logger.logOperationError('find campaign by id', error as Error, { correlationId });
      throw error;
    }
  }

  async findAll(
    tenantId: string,
    search: CampaignSearchDto,
    correlationId: string,
  ): Promise<PaginatedCampaignsResponseDto> {
    const startTime = this.logger.logOperationStart('find all campaigns', {
      tenantId,
      correlationId,
      ...search,
    });

    try {
      const result = await this.campaignRepository.findAll(tenantId, search);

      const totalPages = Math.ceil(result.total / result.limit);
      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      this.logger.logOperationEnd('find all campaigns', startTime, {
        total: result.total,
        resultCount: result.data.length,
      });

      return {
        data: CampaignMapper.toResponseDtoList(result.data),
        meta,
      };
    } catch (error) {
      this.logger.logOperationError('find all campaigns', error as Error, { correlationId });
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCampaignDto,
    userId: string,
    correlationId: string,
  ): Promise<CampaignResponseDto> {
    const startTime = this.logger.logOperationStart('update campaign', {
      tenantId,
      id,
      correlationId,
    });

    try {
      // Find existing campaign
      const existing = await this.campaignRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      // Can only update DRAFT or SCHEDULED campaigns
      if (![CampaignStatus.DRAFT, CampaignStatus.SCHEDULED].includes(existing.status)) {
        throw new BadRequestException(
          `Cannot update campaign in ${existing.status} status. Only DRAFT or SCHEDULED campaigns can be updated.`,
        );
      }

      // Check for name conflict if name is being changed
      if (dto.name && dto.name !== existing.name) {
        const nameConflict = await this.campaignRepository.findByName(tenantId, dto.name);
        if (nameConflict) {
          throw new ConflictException(`Campaign with name "${dto.name}" already exists`);
        }
      }

      // Track changes for event
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updateData: Partial<Campaign> = { updatedBy: userId };

      if (dto.name !== undefined && dto.name !== existing.name) {
        changes.name = { old: existing.name, new: dto.name };
        updateData.name = dto.name;
      }
      if (dto.description !== undefined && dto.description !== existing.description) {
        changes.description = { old: existing.description, new: dto.description };
        updateData.description = dto.description;
      }
      if (dto.channel !== undefined && dto.channel !== existing.channel) {
        changes.channel = { old: existing.channel, new: dto.channel };
        updateData.channel = dto.channel;
      }
      if (dto.templateVersionId !== undefined && dto.templateVersionId !== existing.templateVersionId) {
        changes.templateVersionId = { old: existing.templateVersionId, new: dto.templateVersionId };
        updateData.templateVersionId = dto.templateVersionId;
      }
      if (dto.segmentId !== undefined && dto.segmentId !== existing.segmentId) {
        changes.segmentId = { old: existing.segmentId, new: dto.segmentId };
        updateData.segmentId = dto.segmentId;
      }
      if (dto.scheduleAt !== undefined) {
        const newSchedule = new Date(dto.scheduleAt);
        if (newSchedule.getTime() !== existing.scheduleAt?.getTime()) {
          changes.scheduleAt = { old: existing.scheduleAt, new: newSchedule };
          updateData.scheduleAt = newSchedule;
          updateData.status = CampaignStatus.SCHEDULED;
        }
      }
      if (dto.metadata !== undefined) {
        changes.metadata = { old: existing.metadata, new: dto.metadata };
        updateData.metadata = dto.metadata;
      }

      const updated = await this.campaignRepository.update(tenantId, id, updateData);

      // Publish event
      if (Object.keys(changes).length > 0) {
        await this.publishEvent(CampaignSubjects.UPDATED, {
          eventId: uuidv4(),
          eventType: CampaignEventType.CAMPAIGN_UPDATED,
          tenantId,
          correlationId,
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'api-gateway',
          payload: {
            campaignId: id,
            name: updated?.name || existing.name,
            changes,
            updatedBy: userId,
          },
        } as CampaignUpdatedEvent);
      }

      this.logger.logOperationEnd('update campaign', startTime, {
        campaignId: id,
        changesCount: Object.keys(changes).length,
      });

      return CampaignMapper.toResponseDto(updated!);
    } catch (error) {
      this.logger.logOperationError('update campaign', error as Error, { correlationId });
      throw error;
    }
  }

  async delete(
    tenantId: string,
    id: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('delete campaign', {
      tenantId,
      id,
      correlationId,
    });

    try {
      const existing = await this.campaignRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      // Cannot delete running campaigns
      if (existing.status === CampaignStatus.RUNNING) {
        throw new BadRequestException('Cannot delete a running campaign. Cancel it first.');
      }

      await this.campaignRepository.softDelete(tenantId, id, userId);

      // Publish event
      await this.publishEvent(CampaignSubjects.DELETED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_DELETED,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: id,
          name: existing.name,
          deletedBy: userId,
          hardDelete: false,
        },
      } as CampaignDeletedEvent);

      this.logger.logOperationEnd('delete campaign', startTime);
    } catch (error) {
      this.logger.logOperationError('delete campaign', error as Error, { correlationId });
      throw error;
    }
  }

  // ============ Scheduling ============

  async schedule(
    tenantId: string,
    id: string,
    dto: ScheduleCampaignDto,
    userId: string,
    correlationId: string,
  ): Promise<CampaignResponseDto> {
    const startTime = this.logger.logOperationStart('schedule campaign', {
      tenantId,
      id,
      scheduleAt: dto.scheduleAt,
      correlationId,
    });

    try {
      const existing = await this.campaignRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      // Validate campaign is ready for scheduling
      if (![CampaignStatus.DRAFT, CampaignStatus.SCHEDULED].includes(existing.status)) {
        throw new BadRequestException(
          `Cannot schedule campaign in ${existing.status} status. Only DRAFT or SCHEDULED campaigns can be scheduled.`,
        );
      }

      // Validate required fields
      if (!existing.segmentId) {
        throw new BadRequestException('Campaign must have a segment assigned before scheduling');
      }
      if (!existing.templateVersionId) {
        throw new BadRequestException('Campaign must have a template assigned before scheduling');
      }

      // Validate schedule time is in the future
      const scheduleAt = new Date(dto.scheduleAt);
      if (scheduleAt <= new Date()) {
        throw new BadRequestException('Schedule time must be in the future');
      }

      // Update campaign
      const updated = await this.campaignRepository.update(tenantId, id, {
        scheduleAt,
        status: CampaignStatus.SCHEDULED,
        updatedBy: userId,
      });

      // Publish event
      await this.publishEvent(CampaignSubjects.SCHEDULED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_SCHEDULED,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: id,
          name: updated!.name,
          channel: updated!.channel,
          scheduleAt: scheduleAt.toISOString(),
          audienceCount: updated!.audienceCount,
          scheduledBy: userId,
        },
      } as CampaignScheduledEvent);

      this.logger.logOperationEnd('schedule campaign', startTime, {
        campaignId: id,
        scheduleAt: scheduleAt.toISOString(),
      });

      return CampaignMapper.toResponseDto(updated!);
    } catch (error) {
      this.logger.logOperationError('schedule campaign', error as Error, { correlationId });
      throw error;
    }
  }

  async cancel(
    tenantId: string,
    id: string,
    userId: string,
    correlationId: string,
    reason?: string,
  ): Promise<CampaignResponseDto> {
    const startTime = this.logger.logOperationStart('cancel campaign', {
      tenantId,
      id,
      correlationId,
    });

    try {
      const existing = await this.campaignRepository.findById(tenantId, id);
      if (!existing) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      // Can only cancel SCHEDULED or RUNNING campaigns
      if (![CampaignStatus.SCHEDULED, CampaignStatus.RUNNING].includes(existing.status)) {
        throw new BadRequestException(
          `Cannot cancel campaign in ${existing.status} status. Only SCHEDULED or RUNNING campaigns can be cancelled.`,
        );
      }

      const previousStatus = existing.status;

      // Update campaign
      const updated = await this.campaignRepository.update(tenantId, id, {
        status: CampaignStatus.CANCELLED,
        updatedBy: userId,
        metadata: {
          ...existing.metadata,
          cancelledAt: new Date().toISOString(),
          cancelReason: reason,
        },
      });

      // Publish event
      await this.publishEvent(CampaignSubjects.CANCELLED, {
        eventId: uuidv4(),
        eventType: CampaignEventType.CAMPAIGN_CANCELLED,
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'api-gateway',
        payload: {
          campaignId: id,
          name: updated!.name,
          previousStatus,
          cancelledBy: userId,
          reason,
        },
      } as CampaignCancelledEvent);

      this.logger.logOperationEnd('cancel campaign', startTime, {
        campaignId: id,
        previousStatus,
      });

      return CampaignMapper.toResponseDto(updated!);
    } catch (error) {
      this.logger.logOperationError('cancel campaign', error as Error, { correlationId });
      throw error;
    }
  }

  // ============ Preview ============

  async preview(
    tenantId: string,
    id: string,
    dto: CampaignPreviewDto,
    correlationId: string,
  ): Promise<CampaignPreviewResponseDto> {
    const startTime = this.logger.logOperationStart('preview campaign', {
      tenantId,
      id,
      sampleSize: dto.sampleSize,
      correlationId,
    });

    try {
      const campaign = await this.campaignRepository.findById(tenantId, id);
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID ${id} not found`);
      }

      // TODO: Integrate with SegmentsService to get audience preview
      // For now, return mock data
      const sampleSize = dto.sampleSize || 10;

      const response: CampaignPreviewResponseDto = {
        campaignId: id,
        totalAudienceCount: campaign.audienceCount || 0,
        sampleContacts: [], // Would be populated from SegmentsService
        templatePreview: {
          message: 'Template preview not yet implemented',
          channel: campaign.channel,
        },
      };

      this.logger.logOperationEnd('preview campaign', startTime);
      return response;
    } catch (error) {
      this.logger.logOperationError('preview campaign', error as Error, { correlationId });
      throw error;
    }
  }

  // ============ Messages ============

  async getMessages(
    tenantId: string,
    campaignId: string,
    search: CampaignMessageSearchDto,
    correlationId: string,
  ): Promise<PaginatedMessagesResponseDto> {
    const startTime = this.logger.logOperationStart('get campaign messages', {
      tenantId,
      campaignId,
      correlationId,
    });

    try {
      // Verify campaign exists
      const campaign = await this.campaignRepository.findById(tenantId, campaignId);
      if (!campaign) {
        throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
      }

      const result = await this.campaignRepository.findMessagesByCampaign(tenantId, campaignId, search);

      const totalPages = Math.ceil(result.total / result.limit);
      const meta: PaginationMeta = {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages,
        hasNextPage: result.page < totalPages,
        hasPreviousPage: result.page > 1,
      };

      this.logger.logOperationEnd('get campaign messages', startTime, {
        total: result.total,
      });

      return {
        data: CampaignMapper.toMessageResponseDtoList(result.data),
        meta,
      };
    } catch (error) {
      this.logger.logOperationError('get campaign messages', error as Error, { correlationId });
      throw error;
    }
  }

  // ============ Event Publishing ============

  private async publishEvent(subject: string, event: Record<string, unknown>): Promise<void> {
    try {
      await this.eventBus.publish(subject, event as any, {
        correlationId: event.correlationId as string,
        tenantId: event.tenantId as string,
      });

      this.logger.logEventPublish(event.eventType as string, event.correlationId as string, {
        tenantId: event.tenantId as string,
        subject,
      });
    } catch (error) {
      this.logger.warn('Failed to publish campaign event', {
        subject,
        eventType: event.eventType,
        error: (error as Error).message,
      });
    }
  }
}
