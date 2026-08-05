import { IsString, IsOptional, IsInt, IsNumber, IsArray, IsEnum } from 'class-validator';
import { PresenceVisibility } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  employeeCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  healthcareBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workingDays?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessHoursStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessHoursEnd?: string;

  @ApiPropertyOptional({ enum: PresenceVisibility })
  @IsOptional()
  @IsEnum(PresenceVisibility)
  presenceVisibility?: PresenceVisibility;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  officeCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  officeLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  officeLongitude?: number;
}

export class UpdateCompanyDto extends CreateCompanyDto {}

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  name!: string;
}
