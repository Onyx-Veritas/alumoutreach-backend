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
  Headers,
  Ip,
  ParseUUIDPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { Tenant, TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactResponseDto,
  ContactSearchDto,
  AddTagDto,
  AddAttributeDto,
  UpdateConsentDto,
  TimelineQueryDto,
  TimelineEventResponseDto,
  AttributeResponseDto,
  ConsentResponseDto,
  PaginatedResponseDto,
} from './dto/contact.dto';

@ApiTags('Contacts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', required: true, description: 'Tenant identifier' })
@ApiHeader({ name: 'X-Correlation-ID', required: false, description: 'Request correlation ID for tracing' })
@Controller('api/v1/contacts')
export class ContactsController {
  private readonly logger: AppLoggerService;

  constructor(private readonly contactsService: ContactsService) {
    this.logger = new AppLoggerService();
    this.logger.setContext('ContactsController');
    this.logger.info('ContactsController initialized');
  }

  // ============ CREATE ============

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Create a new contact', description: 'Creates a new contact with the provided data' })
  @ApiBody({ type: CreateContactDto })
  @ApiResponse({ status: 201, description: 'Contact created successfully', type: ContactResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Contact with email already exists' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Body() dto: CreateContactDto,
  ): Promise<{ success: boolean; data: ContactResponseDto }> {
    this.logger.debug('Create contact request received', { tenantId, correlationId });
    const contact = await this.contactsService.create(tenantId, dto, userId || 'system', correlationId);
    return { success: true, data: contact };
  }

  // ============ LIST / SEARCH ============

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get all contacts', description: 'Retrieves contacts with pagination, filtering, and sorting' })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  async findAll(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query() query: ContactSearchDto,
  ): Promise<{ success: boolean; data: ContactResponseDto[]; meta: any }> {
    this.logger.debug('Find all contacts request', { tenantId, correlationId, page: query.page });
    const result = await this.contactsService.findAll(tenantId, query, correlationId);
    return { success: true, data: result.data, meta: result.meta };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search contacts', description: 'Full-text search across contacts using Elasticsearch' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 20)' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async search(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<{ success: boolean; data: any; took: number; total: number }> {
    this.logger.debug('Search contacts request', { tenantId, correlationId, query });
    const result = await this.contactsService.search(tenantId, query, limit || 20, correlationId);
    return { success: true, data: result.hits, took: result.took, total: result.total };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get contact statistics', description: 'Returns aggregate statistics for contacts' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(
    @TenantId() tenantId: string,
  ): Promise<{ success: boolean; data: any }> {
    this.logger.debug('Get contact stats request', { tenantId });
    const stats = await this.contactsService.getStats(tenantId);
    return { success: true, data: stats };
  }

  // ============ GET BY ID ============

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID', description: 'Retrieves a single contact with all related data' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiResponse({ status: 200, description: 'Contact retrieved successfully', type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; data: ContactResponseDto }> {
    this.logger.debug('Find contact by id request', { tenantId, contactId: id });
    const contact = await this.contactsService.findById(tenantId, id, correlationId);
    return { success: true, data: contact };
  }

  // ============ UPDATE ============

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, skipMissingProperties: true }))
  @ApiOperation({ summary: 'Update contact', description: 'Partially updates a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiBody({ type: UpdateContactDto })
  @ApiResponse({ status: 200, description: 'Contact updated successfully', type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 409, description: 'Email conflict' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<{ success: boolean; data: ContactResponseDto }> {
    this.logger.debug('Update contact request', { tenantId, contactId: id });
    const contact = await this.contactsService.update(tenantId, id, dto, userId || 'system', correlationId);
    return { success: true, data: contact };
  }

  // ============ DELETE ============

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contact', description: 'Soft deletes a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiResponse({ status: 204, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async delete(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.logger.debug('Delete contact request', { tenantId, contactId: id });
    await this.contactsService.delete(tenantId, id, userId || 'system', correlationId);
  }

  // ============ TAGS ============

  @Post(':id/tags')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Add tag to contact', description: 'Associates a tag with a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiBody({ type: AddTagDto })
  @ApiResponse({ status: 200, description: 'Tag added successfully', type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Contact or tag not found' })
  async addTag(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTagDto,
  ): Promise<{ success: boolean; data: ContactResponseDto }> {
    this.logger.debug('Add tag request', { tenantId, contactId: id, tagId: dto.tagId });
    const contact = await this.contactsService.addTag(tenantId, id, dto, userId || 'system', correlationId);
    return { success: true, data: contact };
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Remove tag from contact', description: 'Removes a tag association from a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiParam({ name: 'tagId', description: 'Tag UUID' })
  @ApiResponse({ status: 200, description: 'Tag removed successfully', type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async removeTag(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<{ success: boolean; data: ContactResponseDto }> {
    this.logger.debug('Remove tag request', { tenantId, contactId: id, tagId });
    const contact = await this.contactsService.removeTag(tenantId, id, tagId, userId || 'system', correlationId);
    return { success: true, data: contact };
  }

  // ============ ATTRIBUTES ============

  @Post(':id/attributes')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Add/update contact attribute', description: 'Creates or updates a custom attribute on a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiBody({ type: AddAttributeDto })
  @ApiResponse({ status: 200, description: 'Attribute saved successfully', type: AttributeResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async addAttribute(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAttributeDto,
  ): Promise<{ success: boolean; data: AttributeResponseDto }> {
    this.logger.debug('Add/update attribute request', { tenantId, contactId: id, key: dto.key });
    const attribute = await this.contactsService.addOrUpdateAttribute(tenantId, id, dto, userId || 'system', correlationId);
    return { success: true, data: attribute };
  }

  // ============ TIMELINE ============

  @Get(':id/timeline')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get contact timeline', description: 'Retrieves the activity timeline for a contact' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getTimeline(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TimelineQueryDto,
  ): Promise<{ success: boolean; data: TimelineEventResponseDto[]; meta: any }> {
    this.logger.debug('Get timeline request', { tenantId, contactId: id });
    const result = await this.contactsService.getTimeline(tenantId, id, query, correlationId);
    return { success: true, data: result.data, meta: result.meta };
  }

  // ============ CONSENT ============

  @Post(':id/consent')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update consent', description: 'Updates consent status for a channel' })
  @ApiParam({ name: 'id', description: 'Contact UUID' })
  @ApiBody({ type: UpdateConsentDto })
  @ApiResponse({ status: 200, description: 'Consent updated successfully', type: ConsentResponseDto })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async updateConsent(
    @TenantId() tenantId: string,
    @CurrentUser('userId') userId: string,
    @CorrelationId() correlationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsentDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ success: boolean; data: ConsentResponseDto }> {
    this.logger.debug('Update consent request', { tenantId, contactId: id, channel: dto.channel });
    const consent = await this.contactsService.updateConsent(
      tenantId,
      id,
      dto,
      userId || 'system',
      correlationId,
      ipAddress,
      userAgent,
    );
    return { success: true, data: consent };
  }

  // ============ ADMIN ============

  @Post('admin/rebuild-search-index')
  @ApiOperation({ summary: 'Rebuild search index', description: 'Re-indexes all contacts in Elasticsearch (admin only)' })
  @ApiResponse({ status: 200, description: 'Index rebuilt successfully' })
  async rebuildSearchIndex(
    @TenantId() tenantId: string,
  ): Promise<{ success: boolean; data: { indexed: number; failed: number } }> {
    this.logger.info('Rebuild search index request', { tenantId });
    const stats = await this.contactsService.rebuildSearchIndex(tenantId);
    return { success: true, data: stats };
  }
}
