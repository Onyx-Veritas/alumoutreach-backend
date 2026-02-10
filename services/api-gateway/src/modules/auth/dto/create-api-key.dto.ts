import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My Integration Key' })
  @IsString()
  name: string;

  @ApiProperty({ example: ['contacts:read', 'campaigns:write'], required: false })
  @IsArray()
  @IsOptional()
  scopes?: string[];
}
