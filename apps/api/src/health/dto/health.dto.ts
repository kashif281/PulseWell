import {
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HealthCheckinDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sleepHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  energy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  exerciseMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  waterIntake?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  mealsCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  painLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  medicineTaken?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicineNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMetricDto {
  @ApiPropertyOptional()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsNumber()
  value!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
