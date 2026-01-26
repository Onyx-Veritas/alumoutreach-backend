import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all campaigns' })
  async findAll(@Query() query: Record<string, any>) {
    return this.campaignsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get campaign statistics' })
  async getStats() {
    return this.campaignsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get campaign analytics' })
  async getAnalytics(@Param('id') id: string) {
    return this.campaignsService.getAnalytics(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  async create(@Body() dto: any) {
    return this.campaignsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  async remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a campaign' })
  async start(@Param('id') id: string) {
    return this.campaignsService.start(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a campaign' })
  async pause(@Param('id') id: string) {
    return this.campaignsService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a campaign' })
  async resume(@Param('id') id: string) {
    return this.campaignsService.resume(id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a campaign' })
  async duplicate(@Param('id') id: string) {
    return this.campaignsService.duplicate(id);
  }
}
