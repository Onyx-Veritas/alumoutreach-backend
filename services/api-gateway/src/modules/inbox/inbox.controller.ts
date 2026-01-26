import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InboxService } from './inbox.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  async findAllConversations(@Query() query: Record<string, any>) {
    return this.inboxService.findAllConversations(query);
  }

  @Get('conversations/stats')
  @ApiOperation({ summary: 'Get inbox statistics' })
  async getStats() {
    return this.inboxService.getStats();
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  async findOneConversation(@Param('id') id: string) {
    return this.inboxService.findOneConversation(id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  async getMessages(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.inboxService.getMessages(id, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(@Param('id') id: string, @Body() dto: any) {
    return this.inboxService.sendMessage(id, dto);
  }

  @Put('conversations/:id')
  @ApiOperation({ summary: 'Update conversation' })
  async updateConversation(@Param('id') id: string, @Body() dto: any) {
    return this.inboxService.updateConversation(id, dto);
  }

  @Post('conversations/:id/assign')
  @ApiOperation({ summary: 'Assign conversation to agent' })
  async assign(@Param('id') id: string, @Body() dto: { agentId: string }) {
    return this.inboxService.assign(id, dto.agentId);
  }

  @Post('conversations/:id/resolve')
  @ApiOperation({ summary: 'Resolve conversation' })
  async resolve(@Param('id') id: string) {
    return this.inboxService.resolve(id);
  }

  @Post('conversations/:id/snooze')
  @ApiOperation({ summary: 'Snooze conversation' })
  async snooze(@Param('id') id: string, @Body() dto: { until: string }) {
    return this.inboxService.snooze(id, dto.until);
  }

  @Get('canned-responses')
  @ApiOperation({ summary: 'Get canned responses' })
  async getCannedResponses() {
    return this.inboxService.getCannedResponses();
  }
}
