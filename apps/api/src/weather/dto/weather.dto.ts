import { IsBoolean, IsNumber, IsOptional, IsInt, Min, Max, IsIn, IsArray, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWeatherSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  checkHour?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  heatThresholdC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coldThresholdC?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rainEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  windThresholdKmh?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  floodAlertsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  govAdvisoryOverride?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoApproveWfh?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireManagerApproval?: boolean;
}

export class WeatherAlertResponseDto {
  @IsIn(['accept', 'ignore'])
  action!: 'accept' | 'ignore';
}

export class AdminApproveAlertsDto {
  @ApiPropertyOptional({ description: 'Specific alert IDs; omit to approve all pending eligible today' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alertIds?: string[];
}

export class UpdateOfficeLocationDto {
  officeAddress?: string;
  officeCity?: string;
}

export class UpdateEmployeeLocationDto {
  address?: string;
  city?: string;
  homeCountry?: string;
}
