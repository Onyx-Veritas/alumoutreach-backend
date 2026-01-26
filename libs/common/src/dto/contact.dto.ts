import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsObject,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  UNSUBSCRIBED = 'unsubscribed',
}

export enum ContactRole {
  ALUMNUS = 'alumnus',
  STUDENT = 'student',
  PROSPECT = 'prospect',
  DONOR = 'donor',
  FACULTY = 'faculty',
  STAFF = 'staff',
  RECRUITER = 'recruiter',
  MENTOR = 'mentor',
}

export class ContactChannelDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEmail()
  emailSecondary?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phoneSecondary?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;
}

export class ContactConsentDto {
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  pushOptIn?: boolean;

  @IsOptional()
  @IsString()
  preferredChannel?: string;
}

export class AcademicInfoDto {
  @IsOptional()
  @IsString()
  program?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsNumber()
  batchYear?: number;

  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsNumber()
  graduationYear?: number;
}

export class ProfessionalInfoDto {
  @IsOptional()
  @IsString()
  currentCompany?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}

export class CreateContactDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  preferredName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactChannelDto)
  channels?: ContactChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactConsentDto)
  consent?: ContactConsentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicInfoDto)
  academic?: AcademicInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfessionalInfoDto)
  professional?: ProfessionalInfoDto;

  @IsOptional()
  @IsArray()
  @IsEnum(ContactRole, { each: true })
  roles?: ContactRole[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, any>;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateContactDto extends CreateContactDto {
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;
}

export class ContactResponseDto {
  id: string;
  tenantId: string;
  fullName: string;
  preferredName?: string;
  channels: ContactChannelDto;
  consent: ContactConsentDto;
  academic: AcademicInfoDto;
  professional: ProfessionalInfoDto;
  roles: ContactRole[];
  tags: string[];
  customAttributes: Record<string, any>;
  status: ContactStatus;
  engagementScore: number;
  profileImageUrl?: string;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class TimelineEventDto {
  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
