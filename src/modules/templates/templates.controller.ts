import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all templates' })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  async findAll(@Query() query: Record<string, any>) {
    return this.templatesService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get template statistics' })
  async getStats() {
    return this.templatesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a template' })
  async create(@Body() dto: any) {
    return this.templatesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a template' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template' })
  async remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template' })
  async duplicate(@Param('id') id: string) {
    return this.templatesService.duplicate(id);
  }

  @Post('render')
  @ApiOperation({ summary: 'Render a template with variables' })
  async render(@Body() dto: { templateId: string; variables: Record<string, any> }) {
    return this.templatesService.render(dto.templateId, dto.variables);
  }
}
