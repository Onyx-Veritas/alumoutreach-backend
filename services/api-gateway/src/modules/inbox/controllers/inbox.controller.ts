import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';
import { InboxService } from '../services/inbox.service';
import { InboxMessageService } from '../services/inbox-message.service';
import { InboxDistributionService } from '../services/inbox-distribution.service';
import { InboxActivityRepository } from '../repositories/inbox-activity.repository';
import { InboxMapper } from '../mappers/inbox.mapper';
import {
  ListThreadsQueryDto,
  AssignThreadDto,
  UpdateThreadStatusDto,
  UpdateThreadPriorityDto,
  ThreadTagsDto,
  SendMessageDto,
  AddNoteDto,
  ListMessagesQueryDto,
  ListActivitiesQueryDto,
  DistributeThreadsDto,
  ThreadResponseDto,
  ThreadSummaryResponseDto,
  PaginatedThreadsResponseDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
  ActivityResponseDto,
  PaginatedActivitiesResponseDto,
  DistributionResultDto,
  InboxStatsDto,
} from '../dto/inbox.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  private readonly mapper: InboxMapper;

  constructor(
    private readonly inboxService: InboxService,
    private readonly messageService: InboxMessageService,
    private readonly distributionService: InboxDistributionService,
    private readonly activityRepo: InboxActivityRepository,
  ) {
    this.mapper = new InboxMapper();
  }

  // ============================================================================
  // Thread Endpoints
  // ============================================================================

  @Get('threads')
  @ApiOperation({ summary: 'List inbox threads' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedThreadsResponseDto })
  async listThreads(
    @TenantId() tenantId: string,
    @Query() query: ListThreadsQueryDto,
  ): Promise<PaginatedThreadsResponseDto> {
    return this.inboxService.listThreads(tenantId, query);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get thread by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async getThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.getThread(tenantId, threadId);
  }

  @Post('threads/:id/assign')
  @ApiOperation({ summary: 'Assign thread to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot assign thread' })
  async assignThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: AssignThreadDto,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.assignThread(tenantId, threadId, dto, userId, correlationId);
  }

  @Delete('threads/:id/assign')
  @ApiOperation({ summary: 'Unassign thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async unassignThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.unassignThread(tenantId, threadId, userId, correlationId);
  }

  @Put('threads/:id/status')
  @ApiOperation({ summary: 'Update thread status' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status transition' })
  async updateThreadStatus(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: UpdateThreadStatusDto,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.updateThreadStatus(tenantId, threadId, dto, userId, correlationId);
  }

  @Put('threads/:id/priority')
  @ApiOperation({ summary: 'Update thread priority' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async updateThreadPriority(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: UpdateThreadPriorityDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.updateThreadPriority(tenantId, threadId, dto, userId);
  }

  @Post('threads/:id/tags')
  @ApiOperation({ summary: 'Add tags to thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async addTags(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: ThreadTagsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.addTags(tenantId, threadId, dto, userId);
  }

  @Delete('threads/:id/tags')
  @ApiOperation({ summary: 'Remove tags from thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async removeTags(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: ThreadTagsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.removeTags(tenantId, threadId, dto, userId);
  }

  @Post('threads/:id/star')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Star thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  async starThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.toggleStar(tenantId, threadId, true);
  }

  @Delete('threads/:id/star')
  @ApiOperation({ summary: 'Unstar thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  async unstarThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.toggleStar(tenantId, threadId, false);
  }

  @Post('threads/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  async archiveThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.toggleArchive(tenantId, threadId, true, userId);
  }

  @Delete('threads/:id/archive')
  @ApiOperation({ summary: 'Unarchive thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  async unarchiveThread(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.toggleArchive(tenantId, threadId, false, userId);
  }

  @Post('threads/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark thread as read' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: ThreadResponseDto })
  async markAsRead(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
  ): Promise<ThreadResponseDto> {
    return this.inboxService.markAsRead(tenantId, threadId);
  }

  // ============================================================================
  // Message Endpoints
  // ============================================================================

  @Get('threads/:id/messages')
  @ApiOperation({ summary: 'List messages in thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedMessagesResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async listMessages(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    return this.messageService.listMessages(tenantId, threadId, query);
  }

  @Post('threads/:id/messages')
  @ApiOperation({ summary: 'Send message in thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.CREATED, type: MessageResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid message' })
  async sendMessage(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.messageService.sendMessage(tenantId, threadId, dto, userId, correlationId);
  }

  @Post('threads/:id/notes')
  @ApiOperation({ summary: 'Add internal note to thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.CREATED, type: MessageResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Thread not found' })
  async addNote(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Body() dto: AddNoteDto,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.messageService.addNote(tenantId, threadId, dto, userId, correlationId);
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Get message by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: MessageResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Message not found' })
  async getMessage(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
  ): Promise<MessageResponseDto> {
    return this.messageService.getMessage(tenantId, messageId);
  }

  // ============================================================================
  // Activity Endpoints
  // ============================================================================

  @Get('threads/:id/activities')
  @ApiOperation({ summary: 'List activities for thread' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedActivitiesResponseDto })
  async listActivities(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) threadId: string,
    @Query() query: ListActivitiesQueryDto,
  ): Promise<PaginatedActivitiesResponseDto> {
    const { items, total } = await this.activityRepo.findByThread(tenantId, threadId, {
      type: query.type,
      page: query.page,
      limit: query.limit,
    });

    const activities = this.mapper.toActivityResponseDtos(items);
    const page = query.page || 1;
    const limit = query.limit || 50;

    return {
      items: activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================================================
  // Distribution Endpoints
  // ============================================================================

  @Post('distribute')
  @ApiOperation({ summary: 'Distribute unassigned threads to agents' })
  @ApiResponse({ status: HttpStatus.OK, type: DistributionResultDto })
  async distributeThreads(
    @TenantId() tenantId: string,
    @Body() dto: DistributeThreadsDto,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
  ): Promise<DistributionResultDto> {
    return this.distributionService.distributeThreads(tenantId, dto, userId, correlationId);
  }

  // ============================================================================
  // Stats Endpoints
  // ============================================================================

  @Get('stats')
  @ApiOperation({ summary: 'Get inbox statistics' })
  @ApiResponse({ status: HttpStatus.OK, type: InboxStatsDto })
  async getStats(
    @TenantId() tenantId: string,
  ): Promise<InboxStatsDto> {
    return this.inboxService.getStats(tenantId);
  }
}
