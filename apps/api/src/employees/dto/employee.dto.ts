import { IsString, IsOptional, IsInt, IsNumber, IsArray, IsEnum, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeRoleDto {
  @ApiProperty({ enum: ['MANAGER', 'EMPLOYEE'] })
  @IsIn(['MANAGER', 'EMPLOYEE'])
  role!: 'MANAGER' | 'EMPLOYEE';
}

export class UpdateEmployeeProfileDto {
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
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingConditions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smokingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alcoholConsumption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exerciseFrequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  homeCountry?: string;
}

export class SetLocationFromCoordinatesDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsNotEmpty()
  longitude!: number;
}

export class CreateGoalDto {
  @ApiPropertyOptional()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deadline?: string;
}
