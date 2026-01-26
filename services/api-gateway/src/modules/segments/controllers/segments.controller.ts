import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { SegmentsService } from '../services/segments.service';
import {
  CreateSegmentDto,
  UpdateSegmentDto,
  AddMembersDto,
  RemoveMembersDto,
  PreviewSegmentDto,
  SegmentSearchDto,
  MemberSearchDto,
  SegmentResponseDto,
  PaginatedSegmentsResponseDto,
  PaginatedMembersResponseDto,
  SegmentPreviewResponseDto,
  RecomputeResponseDto,
} from '../dto/segment.dto';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { CurrentUser, CurrentUserContext } from '../../../common/decorators/current-user.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';

@ApiTags('Segments')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
@ApiHeader({ name: 'X-Correlation-ID', required: false, description: 'Request correlation ID' })
@Controller('segments')
export class SegmentsController {
  private readonly logger: AppLoggerService;

  constructor(private readonly segmentsService: SegmentsService) {
    this.logger = new AppLoggerService();
    this.logger.setContext('SegmentsController');
  }

  // ============ CRUD Operations ============

  @Post()
  @ApiOperation({ summary: 'Create a new segment' })
  @ApiResponse({ status: 201, description: 'Segment created successfully', type: SegmentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Segment name already exists' })
  async create(
    @Body() dto: CreateSegmentDto,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Create segment request', { name: dto.name, type: dto.type, tenantId, correlationId });
    return this.segmentsService.create(dto, user.userId, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all segments with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Segments retrieved successfully', type: PaginatedSegmentsResponseDto })
  async findAll(
    @Query() query: SegmentSearchDto,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<PaginatedSegmentsResponseDto> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Find all segments request', { ...query, tenantId, correlationId });
    return this.segmentsService.findAll(query, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get segment by ID' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment retrieved successfully', type: SegmentResponseDto })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Find segment by ID request', { id, tenantId, correlationId });
    return this.segmentsService.findById(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment updated successfully', type: SegmentResponseDto })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  @ApiResponse({ status: 409, description: 'Segment name already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSegmentDto,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Update segment request', { id, tenantId, correlationId });
    return this.segmentsService.update(id, dto, user.userId, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 204, description: 'Segment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Delete segment request', { id, tenantId, correlationId });
    await this.segmentsService.delete(id, user.userId, tenantId);
  }

  // ============ Segment Operations ============

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview segment rules and matching contacts' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Preview generated successfully', type: SegmentPreviewResponseDto })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewSegmentDto,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentPreviewResponseDto> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Preview segment request', { id, tenantId, correlationId });
    return this.segmentsService.preview(id, dto, tenantId);
  }

  @Post(':id/recompute')
  @ApiOperation({ summary: 'Recompute segment membership for dynamic segments' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment recomputed successfully', type: RecomputeResponseDto })
  @ApiResponse({ status: 400, description: 'Only dynamic segments can be recomputed' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async recompute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<RecomputeResponseDto> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Recompute segment request', { id, tenantId, correlationId });
    return this.segmentsService.recompute(id, user.userId, tenantId);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment archived successfully', type: SegmentResponseDto })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Archive segment request', { id, tenantId, correlationId });
    return this.segmentsService.archive(id, user.userId, tenantId);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Segment unarchived successfully', type: SegmentResponseDto })
  @ApiResponse({ status: 400, description: 'Segment is not archived' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Unarchive segment request', { id, tenantId, correlationId });
    return this.segmentsService.unarchive(id, user.userId, tenantId);
  }

  @Get(':id/count')
  @ApiOperation({ summary: 'Get segment member count' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Member count retrieved' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async getMemberCount(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<{ count: number }> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Get segment member count request', { id, tenantId, correlationId });
    const count = await this.segmentsService.getMemberCount(id, tenantId);
    return { count };
  }

  // ============ Member Operations ============

  @Get(':id/members')
  @ApiOperation({ summary: 'Get segment members with pagination' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully', type: PaginatedMembersResponseDto })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MemberSearchDto,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<PaginatedMembersResponseDto> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Get segment members request', { id, ...query, tenantId, correlationId });
    return this.segmentsService.getMembers(id, query, tenantId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add members to a static segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 201, description: 'Members added successfully' })
  @ApiResponse({ status: 400, description: 'Only static segments can have manually added members' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMembersDto,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<{ added: number }> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Add segment members request', { id, count: dto.contactIds.length, tenantId, correlationId });
    return this.segmentsService.addMembers(id, dto, user.userId, tenantId);
  }

  @Delete(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove members from a static segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiResponse({ status: 200, description: 'Members removed successfully' })
  @ApiResponse({ status: 400, description: 'Only static segments can have members manually removed' })
  @ApiResponse({ status: 404, description: 'Segment not found' })
  async removeMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveMembersDto,
    @CurrentUser() user: CurrentUserContext,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<{ removed: number }> {
    this.logger.setMeta({ tenantId, userId: user.userId, correlationId });
    this.logger.log('Remove segment members request', { id, count: dto.contactIds.length, tenantId, correlationId });
    return this.segmentsService.removeMembers(id, dto, user.userId, tenantId);
  }

  @Get(':id/members/:contactId/check')
  @ApiOperation({ summary: 'Check if a contact is a member of a segment' })
  @ApiParam({ name: 'id', description: 'Segment ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Membership check result' })
  async checkMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<{ isMember: boolean }> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Check segment membership request', { id, contactId, tenantId, correlationId });
    const isMember = await this.segmentsService.isMember(id, contactId, tenantId);
    return { isMember };
  }

  // ============ Contact-centric Operations ============

  @Get('contact/:contactId')
  @ApiOperation({ summary: 'Get all segments a contact belongs to' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact segments retrieved successfully', type: [SegmentResponseDto] })
  async getContactSegments(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<SegmentResponseDto[]> {
    this.logger.setMeta({ tenantId, correlationId });
    this.logger.log('Get contact segments request', { contactId, tenantId, correlationId });
    return this.segmentsService.getContactSegments(contactId, tenantId);
  }
}
