import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EventBusService } from '../../../common/services/event-bus.service';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WorkflowGraphValidator } from '../validators/workflow-graph.validator';
import { WorkflowMapper } from '../mappers/workflow.mapper';
import { Workflow, WorkflowGraph, TriggerConfig } from '../entities/workflow.entity';
import { WorkflowTriggerType } from '../entities/workflow.enums';
import { WORKFLOW_SUBJECTS, WorkflowEventFactory } from '../events/workflow.events';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ListWorkflowsQueryDto,
  WorkflowResponseDto,
  PaginatedWorkflowsResponseDto,
} from '../dto/workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly runRepo: WorkflowRunRepository,
    private readonly graphValidator: WorkflowGraphValidator,
    private readonly eventBus: EventBusService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowsService');
  }

  async create(
    tenantId: string,
    dto: CreateWorkflowDto,
    userId?: string,
    correlationId?: string,
  ): Promise<WorkflowResponseDto> {
    const startTime = this.logger.logOperationStart('create', { tenantId, name: dto.name });

    try {
      // Check name uniqueness
      const exists = await this.workflowRepo.existsByName(dto.name, tenantId);
      if (exists) {
        throw new ConflictException(`Workflow with name "${dto.name}" already exists`);
      }

      // Validate graph
      const validationResult = this.graphValidator.validate(dto.graph as WorkflowGraph);
      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Invalid workflow graph',
          errors: validationResult.errors,
        });
      }

      // Create workflow
      const workflow = await this.workflowRepo.create({
        tenantId,
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as unknown as TriggerConfig,
        graph: dto.graph as unknown as WorkflowGraph,
        createdBy: userId,
        updatedBy: userId,
      });

      // Publish event
      await this.publishEvent(
        WORKFLOW_SUBJECTS.WORKFLOW_CREATED,
        WorkflowEventFactory.createLifecycleEvent({
          tenantId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          triggerType: workflow.triggerType,
          userId,
          correlationId,
        }),
        correlationId,
      );

      this.logger.logOperationEnd('create', startTime, { workflowId: workflow.id });
      return WorkflowMapper.toResponse(workflow);
    } catch (error) {
      this.logger.logOperationError('create', error as Error, { tenantId, name: dto.name });
      throw error;
    }
  }

  async findById(id: string, tenantId: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowRepo.findById(id, tenantId);
    
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID "${id}" not found`);
    }

    return WorkflowMapper.toResponse(workflow);
  }

  async findAll(
    tenantId: string,
    query: ListWorkflowsQueryDto,
  ): Promise<PaginatedWorkflowsResponseDto> {
    const { data, total } = await this.workflowRepo.findAll({
      tenantId,
      ...query,
    });

    const limit = query.limit || 20;
    const page = query.page || 1;

    return {
      data: data.map(w => WorkflowMapper.toSummaryResponse(w)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateWorkflowDto,
    userId?: string,
    correlationId?: string,
  ): Promise<WorkflowResponseDto> {
    const startTime = this.logger.logOperationStart('update', { tenantId, id });

    try {
      const existing = await this.workflowRepo.findById(id, tenantId);
      if (!existing) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Check if published - prevent graph updates
      if (existing.isPublished && dto.graph) {
        throw new BadRequestException('Cannot update graph of a published workflow. Unpublish first.');
      }

      // Check name uniqueness if changing name
      if (dto.name && dto.name !== existing.name) {
        const nameExists = await this.workflowRepo.existsByName(dto.name, tenantId, id);
        if (nameExists) {
          throw new ConflictException(`Workflow with name "${dto.name}" already exists`);
        }
      }

      // Validate graph if provided
      if (dto.graph) {
        const validationResult = this.graphValidator.validate(dto.graph as WorkflowGraph);
        if (!validationResult.isValid) {
          throw new BadRequestException({
            message: 'Invalid workflow graph',
            errors: validationResult.errors,
          });
        }
      }

      const updated = await this.workflowRepo.update(id, tenantId, {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        triggerType: dto.triggerType ?? existing.triggerType,
        triggerConfig: dto.triggerConfig as unknown as TriggerConfig ?? existing.triggerConfig,
        graph: dto.graph as unknown as WorkflowGraph ?? existing.graph,
        updatedBy: userId,
      });

      if (!updated) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Publish event
      await this.publishEvent(
        WORKFLOW_SUBJECTS.WORKFLOW_UPDATED,
        WorkflowEventFactory.createLifecycleEvent({
          tenantId,
          workflowId: updated.id,
          workflowName: updated.name,
          triggerType: updated.triggerType,
          userId,
          correlationId,
        }),
        correlationId,
      );

      this.logger.logOperationEnd('update', startTime, { workflowId: updated.id });
      return WorkflowMapper.toResponse(updated);
    } catch (error) {
      this.logger.logOperationError('update', error as Error, { tenantId, id });
      throw error;
    }
  }

  async delete(
    id: string,
    tenantId: string,
    userId?: string,
    correlationId?: string,
  ): Promise<void> {
    const startTime = this.logger.logOperationStart('delete', { tenantId, id });

    try {
      const workflow = await this.workflowRepo.findById(id, tenantId);
      if (!workflow) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Check for active runs
      const activeRuns = await this.runRepo.findByWorkflowId(workflow.id, tenantId, { limit: 1 });
      if (activeRuns.total > 0) {
        this.logger.warn('Deleting workflow with existing runs', { workflowId: id, runCount: activeRuns.total });
      }

      const deleted = await this.workflowRepo.softDelete(id, tenantId, userId);
      if (!deleted) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Publish event
      await this.publishEvent(
        WORKFLOW_SUBJECTS.WORKFLOW_DELETED,
        WorkflowEventFactory.createLifecycleEvent({
          tenantId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          triggerType: workflow.triggerType,
          userId,
          correlationId,
        }),
        correlationId,
      );

      this.logger.logOperationEnd('delete', startTime, { workflowId: id });
    } catch (error) {
      this.logger.logOperationError('delete', error as Error, { tenantId, id });
      throw error;
    }
  }

  async publish(
    id: string,
    tenantId: string,
    userId?: string,
    correlationId?: string,
  ): Promise<WorkflowResponseDto> {
    const startTime = this.logger.logOperationStart('publish', { tenantId, id });

    try {
      const workflow = await this.workflowRepo.findById(id, tenantId);
      if (!workflow) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      if (workflow.isPublished) {
        throw new BadRequestException('Workflow is already published');
      }

      // Final validation before publishing
      const validationResult = this.graphValidator.validate(workflow.graph);
      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Cannot publish workflow with invalid graph',
          errors: validationResult.errors,
        });
      }

      const published = await this.workflowRepo.publish(id, tenantId, userId);
      if (!published) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Publish event
      await this.publishEvent(
        WORKFLOW_SUBJECTS.WORKFLOW_PUBLISHED,
        WorkflowEventFactory.createLifecycleEvent({
          tenantId,
          workflowId: published.id,
          workflowName: published.name,
          triggerType: published.triggerType,
          userId,
          correlationId,
        }),
        correlationId,
      );

      this.logger.logOperationEnd('publish', startTime, { workflowId: published.id });
      return WorkflowMapper.toResponse(published);
    } catch (error) {
      this.logger.logOperationError('publish', error as Error, { tenantId, id });
      throw error;
    }
  }

  async unpublish(
    id: string,
    tenantId: string,
    userId?: string,
    correlationId?: string,
  ): Promise<WorkflowResponseDto> {
    const startTime = this.logger.logOperationStart('unpublish', { tenantId, id });

    try {
      const workflow = await this.workflowRepo.findById(id, tenantId);
      if (!workflow) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      if (!workflow.isPublished) {
        throw new BadRequestException('Workflow is not published');
      }

      const unpublished = await this.workflowRepo.unpublish(id, tenantId, userId);
      if (!unpublished) {
        throw new NotFoundException(`Workflow with ID "${id}" not found`);
      }

      // Publish event
      await this.publishEvent(
        WORKFLOW_SUBJECTS.WORKFLOW_UNPUBLISHED,
        WorkflowEventFactory.createLifecycleEvent({
          tenantId,
          workflowId: unpublished.id,
          workflowName: unpublished.name,
          triggerType: unpublished.triggerType,
          userId,
          correlationId,
        }),
        correlationId,
      );

      this.logger.logOperationEnd('unpublish', startTime, { workflowId: unpublished.id });
      return WorkflowMapper.toResponse(unpublished);
    } catch (error) {
      this.logger.logOperationError('unpublish', error as Error, { tenantId, id });
      throw error;
    }
  }

  async validateGraph(graph: WorkflowGraph): Promise<{
    isValid: boolean;
    errors: Array<{ code: string; message: string; nodeId?: string }>;
    warnings: Array<{ code: string; message: string; nodeId?: string }>;
  }> {
    return this.graphValidator.validate(graph);
  }

  async getByTriggerType(tenantId: string, triggerType: WorkflowTriggerType): Promise<Workflow[]> {
    return this.workflowRepo.findByTriggerType(tenantId, triggerType);
  }

  private async publishEvent(subject: string, event: Record<string, unknown>, correlationId?: string): Promise<void> {
    try {
      await this.eventBus.publish(subject, event as any, {
        correlationId: correlationId || 'unknown',
      });
      this.logger.logEventPublish(subject, correlationId || 'unknown');
    } catch (error) {
      this.logger.warn(`Failed to publish event: ${subject}`, { error: (error as Error).message });
    }
  }
}
