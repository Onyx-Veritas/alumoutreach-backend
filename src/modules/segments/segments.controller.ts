import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SegmentsService } from './segments.service';

@ApiTags('Segments')
@ApiBearerAuth()
@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all segments' })
  async findAll(@Query() query: Record<string, any>) {
    return this.segmentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get segment by ID' })
  async findOne(@Param('id') id: string) {
    return this.segmentsService.findOne(id);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get contacts in a segment' })
  async getContacts(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.segmentsService.getContacts(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a segment' })
  async create(@Body() dto: any) {
    return this.segmentsService.create(dto);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview segment results' })
  async preview(@Body() dto: any) {
    return this.segmentsService.preview(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a segment' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.segmentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a segment' })
  async remove(@Param('id') id: string) {
    return this.segmentsService.remove(id);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh segment membership' })
  async refresh(@Param('id') id: string) {
    return this.segmentsService.refresh(id);
  }
}
