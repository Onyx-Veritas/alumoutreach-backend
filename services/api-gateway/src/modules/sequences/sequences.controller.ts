import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SequencesService } from './sequences.service';

@ApiTags('Sequences')
@ApiBearerAuth()
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all sequences' })
  async findAll(@Query() query: Record<string, any>) {
    return this.sequencesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sequence by ID' })
  async findOne(@Param('id') id: string) {
    return this.sequencesService.findOne(id);
  }

  @Get(':id/enrollments')
  @ApiOperation({ summary: 'Get sequence enrollments' })
  async getEnrollments(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.sequencesService.getEnrollments(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a sequence' })
  async create(@Body() dto: any) {
    return this.sequencesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a sequence' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.sequencesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sequence' })
  async remove(@Param('id') id: string) {
    return this.sequencesService.remove(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a sequence' })
  async activate(@Param('id') id: string) {
    return this.sequencesService.activate(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a sequence' })
  async pause(@Param('id') id: string) {
    return this.sequencesService.pause(id);
  }

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll contacts in a sequence' })
  async enroll(@Param('id') id: string, @Body() dto: { contactIds: string[] }) {
    return this.sequencesService.enroll(id, dto.contactIds);
  }

  @Post(':id/unenroll')
  @ApiOperation({ summary: 'Unenroll contacts from a sequence' })
  async unenroll(@Param('id') id: string, @Body() dto: { contactIds: string[] }) {
    return this.sequencesService.unenroll(id, dto.contactIds);
  }
}
