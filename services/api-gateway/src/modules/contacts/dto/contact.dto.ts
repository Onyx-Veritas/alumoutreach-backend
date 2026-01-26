import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsDateString,
  IsBoolean,
  ValidateNested,
  IsObject,
  Min,
  Max,
  Length,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ContactStatus } from '../entities/contact.entity';

// ============ Academic DTO ============
export class AcademicInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  program?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  batchYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  graduationYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  degree?: string;
}

// ============ Professional DTO ============
export class ProfessionalInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(70)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}

// ============ Location DTO ============
export class LocationInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

// ============ Create Contact DTO ============
export class CreateContactDto {
  @ApiProperty({ description: 'Full name of the contact' })
  @IsString()
  @Length(2, 200)
  fullName: string;

  @ApiPropertyOptional({ description: 'Preferred name / nickname' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  preferredName?: string;

  @ApiPropertyOptional({ description: 'Primary email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Secondary email address' })
  @IsOptional()
  @IsEmail()
  emailSecondary?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Phone country code' })
  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @ApiPropertyOptional({ description: 'WhatsApp number' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salutation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ type: AcademicInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicInfoDto)
  academic?: AcademicInfoDto;

  @ApiPropertyOptional({ type: ProfessionalInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfessionalInfoDto)
  professional?: ProfessionalInfoDto;

  @ApiPropertyOptional({ type: LocationInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInfoDto)
  location?: LocationInfoDto;

  @ApiPropertyOptional({ type: [String], description: 'Contact roles' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Tag IDs to assign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// ============ Update Contact DTO ============
export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({ enum: ContactStatus })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementScore?: number;
}

// ============ Contact Response DTO ============
export class ContactResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional()
  externalId?: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional()
  preferredName?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  emailSecondary?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  whatsapp?: string;

  @ApiPropertyOptional()
  profileImageUrl?: string;

  @ApiProperty({ enum: ContactStatus })
  status: ContactStatus;

  @ApiProperty()
  engagementScore: number;

  @ApiPropertyOptional({ type: [String] })
  roles?: string[];

  @ApiPropertyOptional()
  tags?: TagResponseDto[];

  @ApiPropertyOptional()
  academic?: AcademicInfoDto;

  @ApiPropertyOptional()
  professional?: ProfessionalInfoDto;

  @ApiPropertyOptional()
  location?: LocationInfoDto;

  @ApiPropertyOptional()
  consents?: ConsentResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============ Tag DTOs ============
export class TagResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  color?: string;
}

export class AddTagDto {
  @ApiProperty({ description: 'Tag ID to add' })
  @IsUUID('4')
  tagId: string;
}

export class CreateTagDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;
}

// ============ Attribute DTOs ============
export class AddAttributeDto {
  @ApiProperty({ description: 'Attribute key' })
  @IsString()
  @Length(1, 100)
  key: string;

  @ApiProperty({ description: 'Attribute value' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ description: 'Value type', default: 'string' })
  @IsOptional()
  @IsEnum(['string', 'number', 'boolean', 'date', 'datetime', 'json', 'array'])
  valueType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;
}

export class AttributeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  valueType: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============ Consent DTOs ============
export class UpdateConsentDto {
  @ApiProperty({ enum: ['email', 'sms', 'whatsapp', 'push', 'voice'] })
  @IsEnum(['email', 'sms', 'whatsapp', 'push', 'voice'])
  channel: string;

  @ApiProperty({ enum: ['opted_in', 'opted_out'] })
  @IsEnum(['opted_in', 'opted_out'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['explicit', 'implicit', 'user_request', 'preference_center'])
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consentText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consentVersion?: string;
}

export class ConsentResponseDto {
  @ApiProperty()
  channel: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  source: string;

  @ApiPropertyOptional()
  optedInAt?: Date;

  @ApiPropertyOptional()
  optedOutAt?: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============ Timeline DTOs ============
export class TimelineEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  channel?: string;

  @ApiPropertyOptional()
  referenceType?: string;

  @ApiPropertyOptional()
  referenceId?: string;

  @ApiProperty()
  occurredAt: Date;

  @ApiPropertyOptional()
  actorId?: string;

  @ApiPropertyOptional()
  actorType?: string;
}

export class TimelineQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Filter by channel' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ============ Search & Pagination DTOs ============
export class ContactSearchDto {
  @ApiPropertyOptional({ description: 'Search query (name, email, phone)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @ApiPropertyOptional({ description: 'Filter by tag IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  tags?: string[];

  @ApiPropertyOptional({ description: 'Filter by roles', type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  roles?: string[];

  @ApiPropertyOptional({ description: 'Filter by batch year' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  batchYear?: number;

  @ApiPropertyOptional({ description: 'Filter by graduation year' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  graduationYear?: number;

  @ApiPropertyOptional({ description: 'Filter by department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Filter by company' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ description: 'Filter by industry' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Minimum engagement score' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minEngagementScore?: number;

  @ApiPropertyOptional({ description: 'Maximum engagement score' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxEngagementScore?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationMeta {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;
}
