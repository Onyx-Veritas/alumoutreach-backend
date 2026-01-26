import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview' })
  async getDashboard(@Query() query: Record<string, any>) {
    return this.analyticsService.getDashboard(query);
  }

  @Get('messaging')
  @ApiOperation({ summary: 'Get messaging analytics' })
  async getMessaging(@Query() query: Record<string, any>) {
    return this.analyticsService.getMessaging(query);
  }

  @Get('engagement')
  @ApiOperation({ summary: 'Get engagement analytics' })
  async getEngagement(@Query() query: Record<string, any>) {
    return this.analyticsService.getEngagement(query);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Get campaign analytics' })
  async getCampaigns(@Query() query: Record<string, any>) {
    return this.analyticsService.getCampaigns(query);
  }

  @Get('channels')
  @ApiOperation({ summary: 'Get channel performance' })
  async getChannels(@Query() query: Record<string, any>) {
    return this.analyticsService.getChannels(query);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get trend data' })
  async getTrends(@Query() query: Record<string, any>) {
    return this.analyticsService.getTrends(query);
  }
}
