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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SequencesService } from '../services/sequences.service';
import {
  CreateSequenceDto,
  UpdateSequenceDto,
  SequenceResponseDto,
  PaginatedSequencesResponseDto,
  ListSequencesQueryDto,
  ListSequenceRunsQueryDto,
  PaginatedSequenceRunsResponseDto,
  SequenceRunDetailResponseDto,
  EnrollContactDto,
  ExitContactDto,
  PreviewSequenceDto,
  PreviewSequenceResponseDto,
} from '../dto/sequence.dto';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CurrentUser, CurrentUserContext } from '../../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../../common/decorators/correlation-id.decorator';

@ApiTags('Sequences')
@ApiBearerAuth()
@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}

  // ============================================================================
  // Sequence CRUD
  // ============================================================================

  @Post()
  @ApiOperation({ summary: 'Create a new sequence' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sequence created successfully',
    type: SequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Body() dto: CreateSequenceDto,
  ): Promise<SequenceResponseDto> {
    return this.sequencesService.create(tenantId, dto, user.userId, correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'List all sequences with pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sequences',
    type: PaginatedSequencesResponseDto,
  })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListSequencesQueryDto,
  ): Promise<PaginatedSequencesResponseDto> {
    return this.sequencesService.findMany(tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sequence by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sequence details',
    type: SequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SequenceResponseDto> {
    return this.sequencesService.findById(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sequence updated successfully',
    type: SequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input or sequence is published' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSequenceDto,
  ): Promise<SequenceResponseDto> {
    return this.sequencesService.update(tenantId, id, dto, user.userId, correlationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Sequence deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot delete published sequence' })
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sequencesService.delete(tenantId, id, user.userId, correlationId);
  }

  // ============================================================================
  // Sequence Publishing
  // ============================================================================

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sequence published successfully',
    type: SequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Sequence validation failed' })
  async publish(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SequenceResponseDto> {
    return this.sequencesService.publish(tenantId, id, user.userId, correlationId);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sequence unpublished successfully',
    type: SequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  async unpublish(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SequenceResponseDto> {
    return this.sequencesService.unpublish(tenantId, id, user.userId, correlationId);
  }

  // ============================================================================
  // Preview
  // ============================================================================

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview sequence execution' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sequence preview',
    type: PreviewSequenceResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence not found' })
  async preview(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewSequenceDto,
  ): Promise<PreviewSequenceResponseDto> {
    return this.sequencesService.previewSequence(tenantId, id, dto.contactId);
  }

  // ============================================================================
  // Enrollment
  // ============================================================================

  @Post(':id/enroll/:contactId')
  @ApiOperation({ summary: 'Enroll a contact into a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Sequence ID' })
  @ApiParam({ name: 'contactId', type: 'string', format: 'uuid', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contact enrolled successfully',
    type: SequenceRunDetailResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Sequence or contact not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Sequence not published' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Contact already enrolled' })
  async enrollContact(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: EnrollContactDto,
  ): Promise<SequenceRunDetailResponseDto> {
    const result = await this.sequencesService.enrollContact(
      tenantId,
      id,
      contactId,
      dto,
      user.userId,
      correlationId,
    );
    return result as SequenceRunDetailResponseDto;
  }

  @Post(':id/exit/:contactId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exit a contact from a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Sequence ID' })
  @ApiParam({ name: 'contactId', type: 'string', format: 'uuid', description: 'Contact ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact exited successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Active run not found' })
  async exitContact(
    @TenantId() tenantId: string,
    @CurrentUser() user: CurrentUserContext,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: ExitContactDto,
  ): Promise<void> {
    return this.sequencesService.exitContact(
      tenantId,
      id,
      contactId,
      dto.reason,
      user.userId,
      correlationId,
    );
  }

  // ============================================================================
  // Runs
  // ============================================================================

  @Get(':id/runs')
  @ApiOperation({ summary: 'List runs for a sequence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sequence runs',
    type: PaginatedSequenceRunsResponseDto,
  })
  async listRuns(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListSequenceRunsQueryDto,
  ): Promise<PaginatedSequenceRunsResponseDto> {
    return this.sequencesService.findRuns(tenantId, id, query);
  }

  @Get(':id/runs/:runId')
  @ApiOperation({ summary: 'Get run details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Sequence ID' })
  @ApiParam({ name: 'runId', type: 'string', format: 'uuid', description: 'Run ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Run details',
    type: SequenceRunDetailResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Run not found' })
  async getRunDetails(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<SequenceRunDetailResponseDto> {
    return this.sequencesService.findRunById(tenantId, id, runId);
  }
}
