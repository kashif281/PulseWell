import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckinDto, CreateMetricDto } from './dto/health.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Health')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Post('checkin')
  @ApiOperation({ summary: 'Submit daily health check-in' })
  checkin(@CurrentUser('sub') userId: string, @Body() dto: HealthCheckinDto) {
    return this.healthService.submitCheckin(userId, dto);
  }

  @Get('checkin/today')
  @ApiOperation({ summary: 'Get today check-in' })
  getToday(@CurrentUser('sub') userId: string) {
    return this.healthService.getTodayCheckin(userId);
  }

  @Get('checkin/history')
  @ApiOperation({ summary: 'Get check-in history' })
  getHistory(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    return this.healthService.getCheckinHistory(userId, days);
  }

  @Post('metrics')
  @ApiOperation({ summary: 'Record a health metric' })
  createMetric(@CurrentUser('sub') userId: string, @Body() dto: CreateMetricDto) {
    return this.healthService.createMetric(userId, dto);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get health metrics' })
  getMetrics(
    @CurrentUser('sub') userId: string,
    @Query('type') type?: string,
    @Query('period') period?: string,
  ) {
    return this.healthService.getMetrics(userId, type, period);
  }

  @Get('wellness-score')
  @ApiOperation({ summary: 'Get current wellness score' })
  getWellnessScore(@CurrentUser('sub') userId: string) {
    return this.healthService.getWellnessScore(userId);
  }
}
