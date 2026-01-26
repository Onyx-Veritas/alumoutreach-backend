import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';
import { WorkflowsService } from '../services/workflows.service';
import { WorkflowTriggerService } from '../services/workflow-trigger.service';
import { WorkflowRunnerService } from '../services/workflow-runner.service';
import { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WorkflowMapper } from '../mappers/workflow.mapper';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  ListWorkflowsQueryDto,
  ListWorkflowRunsQueryDto,
  TriggerWorkflowDto,
  PreviewWorkflowDto,
  WorkflowResponseDto,
  WorkflowRunResponseDto,
  WorkflowRunDetailResponseDto,
  PaginatedWorkflowsResponseDto,
  PaginatedWorkflowRunsResponseDto,
  WorkflowGraphDto,
} from '../dto/workflow.dto';

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly triggerService: WorkflowTriggerService,
    private readonly runnerService: WorkflowRunnerService,
    private readonly runRepo: WorkflowRunRepository,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('WorkflowsController');
  }

  // ============ WORKFLOW CRUD ============

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiBody({ type: CreateWorkflowDto })
  @ApiResponse({ status: 201, description: 'Workflow created successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 409, description: 'Workflow with this name already exists' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() userId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: CreateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    this.logger.logOperationStart('create', { tenantId, name: dto.name });
    return this.workflowsService.create(tenantId, dto, userId, correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiResponse({ status: 200, description: 'List of workflows', type: PaginatedWorkflowsResponseDto })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListWorkflowsQueryDto,
  ): Promise<PaginatedWorkflowsResponseDto> {
    return this.workflowsService.findAll(tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow details', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowResponseDto> {
    return this.workflowsService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiBody({ type: UpdateWorkflowDto })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot update published workflow' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Workflow with this name already exists' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    this.logger.logOperationStart('update', { tenantId, id });
    return this.workflowsService.update(id, tenantId, dto, userId, correlationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 204, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.logOperationStart('delete', { tenantId, id });
    await this.workflowsService.delete(id, tenantId, userId, correlationId);
  }

  // ============ WORKFLOW LIFECYCLE ============

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow published successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot publish invalid workflow' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async publish(
    @TenantId() tenantId: string,
    @CurrentUser() userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowResponseDto> {
    this.logger.logOperationStart('publish', { tenantId, id });
    return this.workflowsService.publish(id, tenantId, userId, correlationId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Workflow unpublished successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Workflow is not published' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async unpublish(
    @TenantId() tenantId: string,
    @CurrentUser() userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowResponseDto> {
    this.logger.logOperationStart('unpublish', { tenantId, id });
    return this.workflowsService.unpublish(id, tenantId, userId, correlationId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a workflow graph' })
  @ApiBody({ type: WorkflowGraphDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'object' } },
        warnings: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  async validateGraph(
    @Body() graph: WorkflowGraphDto,
  ): Promise<{
    isValid: boolean;
    errors: Array<{ code: string; message: string; nodeId?: string }>;
    warnings: Array<{ code: string; message: string; nodeId?: string }>;
  }> {
    return this.workflowsService.validateGraph(graph as any);
  }

  // ============ WORKFLOW RUNS ============

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a workflow for a contact' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiBody({ type: TriggerWorkflowDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Workflow triggered',
    schema: {
      type: 'object',
      properties: {
        triggered: { type: 'boolean' },
        workflowId: { type: 'string' },
        runId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  async trigger(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriggerWorkflowDto,
  ): Promise<{
    triggered: boolean;
    workflowId?: string;
    runId?: string;
    reason?: string;
  }> {
    this.logger.logOperationStart('trigger', { tenantId, workflowId: id, contactId: dto.contactId });
    return this.triggerService.triggerManually(
      id,
      dto.contactId,
      tenantId,
      dto.context,
      dto.correlationId || correlationId,
    );
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'List workflow runs' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'List of workflow runs', type: PaginatedWorkflowRunsResponseDto })
  async listRuns(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListWorkflowRunsQueryDto,
  ): Promise<PaginatedWorkflowRunsResponseDto> {
    const { data, total } = await this.runRepo.findByWorkflowId(id, tenantId, query);
    const limit = query.limit || 20;
    const page = query.page || 1;

    return {
      data: data.map(r => WorkflowMapper.toRunResponse(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(':id/runs/:runId')
  @ApiOperation({ summary: 'Get workflow run details' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'runId', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'Workflow run details', type: WorkflowRunDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async getRunDetails(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<WorkflowRunDetailResponseDto> {
    const run = await this.runRepo.findByIdWithNodeRuns(runId, tenantId);
    
    if (!run || run.workflowId !== id) {
      throw new Error('Run not found');
    }

    return WorkflowMapper.toRunDetailResponse(run);
  }

  @Post(':id/runs/:runId/cancel')
  @ApiOperation({ summary: 'Cancel a workflow run' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'runId', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'Run cancelled' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async cancelRun(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<{ cancelled: boolean }> {
    const cancelled = await this.runRepo.cancel(runId, tenantId);
    return { cancelled };
  }

  @Post(':id/runs/:runId/resume')
  @ApiOperation({ summary: 'Resume a waiting workflow run' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiParam({ name: 'runId', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'Run resumed' })
  async resumeRun(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<{
    runId: string;
    status: string;
    completedNodes: number;
    failedNodes: number;
    error?: string;
  }> {
    return this.runnerService.resumeRun(runId, tenantId);
  }

  // ============ PREVIEW ============

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview workflow execution for a contact' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiBody({ type: PreviewWorkflowDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Preview result',
    schema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', items: { type: 'object' } },
        estimatedDuration: { type: 'string' },
      },
    },
  })
  async preview(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewWorkflowDto,
  ): Promise<{
    nodes: Array<{ id: string; type: string; willExecute: boolean; reason?: string }>;
    estimatedDuration: string;
  }> {
    // Get workflow
    const workflow = await this.workflowsService.findById(id, tenantId);
    
    // Simple preview - just return the nodes in order
    const nodes = workflow.graph.nodes.map(node => ({
      id: node.id,
      type: node.type,
      willExecute: true,
      reason: undefined,
    }));

    // Calculate estimated duration based on delay nodes
    let totalMinutes = 0;
    for (const node of workflow.graph.nodes) {
      if (node.type === 'delay') {
        const data = node.data as { duration?: number; unit?: string };
        if (data.duration) {
          switch (data.unit) {
            case 'minutes': totalMinutes += data.duration; break;
            case 'hours': totalMinutes += data.duration * 60; break;
            case 'days': totalMinutes += data.duration * 24 * 60; break;
          }
        }
      }
    }

    const estimatedDuration = totalMinutes === 0 
      ? 'Immediate' 
      : totalMinutes < 60 
        ? `${totalMinutes} minutes`
        : totalMinutes < 1440
          ? `${Math.round(totalMinutes / 60)} hours`
          : `${Math.round(totalMinutes / 1440)} days`;

    return { nodes, estimatedDuration };
  }
}
