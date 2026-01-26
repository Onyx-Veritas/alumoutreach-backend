import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all workflows' })
  async findAll(@Query() query: Record<string, any>) {
    return this.workflowsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow by ID' })
  async findOne(@Param('id') id: string) {
    return this.workflowsService.findOne(id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get workflow executions' })
  async getExecutions(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.workflowsService.getExecutions(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a workflow' })
  async create(@Body() dto: any) {
    return this.workflowsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.workflowsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  async remove(@Param('id') id: string) {
    return this.workflowsService.remove(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a workflow' })
  async activate(@Param('id') id: string) {
    return this.workflowsService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow' })
  async deactivate(@Param('id') id: string) {
    return this.workflowsService.deactivate(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a workflow with sample data' })
  async test(@Param('id') id: string, @Body() dto: any) {
    return this.workflowsService.test(id, dto);
  }
}
