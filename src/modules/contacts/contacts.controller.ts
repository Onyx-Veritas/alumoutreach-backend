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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tag', required: false, type: String })
  @ApiQuery({ name: 'batchYear', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  async findAll(@Query() query: PaginationDto & Record<string, any>) {
    return this.contactsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get contact statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats() {
    return this.contactsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  @ApiResponse({ status: 200, description: 'Contact retrieved' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get contact activity timeline' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved' })
  async getTimeline(@Param('id') id: string) {
    return this.contactsService.getTimeline(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.create(createContactDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 204, description: 'Contact deleted' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add tags to a contact' })
  @ApiResponse({ status: 200, description: 'Tags added' })
  async addTags(@Param('id') id: string, @Body('tags') tags: string[]) {
    return this.contactsService.addTags(id, tags);
  }

  @Delete(':id/tags')
  @ApiOperation({ summary: 'Remove tags from a contact' })
  @ApiResponse({ status: 200, description: 'Tags removed' })
  async removeTags(@Param('id') id: string, @Body('tags') tags: string[]) {
    return this.contactsService.removeTags(id, tags);
  }

  @Post('bulk/import')
  @ApiOperation({ summary: 'Bulk import contacts' })
  @ApiResponse({ status: 200, description: 'Import started' })
  async bulkImport(@Body() data: { contacts: CreateContactDto[] }) {
    return this.contactsService.bulkImport(data.contacts);
  }

  @Post('bulk/export')
  @ApiOperation({ summary: 'Export contacts' })
  @ApiResponse({ status: 200, description: 'Export started' })
  async bulkExport(@Body() data: { filters?: Record<string, any>; format?: string }) {
    return this.contactsService.bulkExport(data.filters, data.format);
  }
}
