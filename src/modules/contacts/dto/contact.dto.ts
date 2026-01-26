import { IsString, IsEmail, IsOptional, IsArray, IsObject, IsEnum, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ContactStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  UNSUBSCRIBED = 'unsubscribed',
}

export class ChannelsDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  emailSecondary?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;
}

export class ConsentDto {
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
  @IsString()
  preferredChannel?: string;
}

export class AcademicDto {
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
  @IsNumber()
  graduationYear?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  rollNumber?: string;
}

export class ProfessionalDto {
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
  @Type(() => ChannelsDto)
  channels?: ChannelsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentDto)
  consent?: ConsentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicDto)
  academic?: AcademicDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfessionalDto)
  professional?: ProfessionalDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

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
