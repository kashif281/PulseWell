import { Controller, Get, Put, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { WeatherEngineService } from './weather-engine.service';
import { UpdateWeatherSettingsDto, WeatherAlertResponseDto, AdminApproveAlertsDto } from './dto/weather.dto';

@ApiTags('Weather')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('weather')
export class WeatherController {
  constructor(private weather: WeatherEngineService) {}

  @Get('alert/today')
  @ApiOperation({ summary: 'Get my weather WFH alert for today' })
  myAlert(@CurrentUser('sub') userId: string) {
    return this.weather.getMyAlertToday(userId);
  }

  @Post('alert/respond')
  @ApiOperation({ summary: 'Accept or ignore today weather WFH alert' })
  respond(@CurrentUser('sub') userId: string, @Body() dto: WeatherAlertResponseDto) {
    return this.weather.respondToAlert(userId, dto.action);
  }

  @Get('settings')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get company weather WFH settings' })
  getSettings(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.weather.getOrCreateSettings(resolveCompanyId(user, companyId));
  }

  @Put('settings')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update company weather WFH settings' })
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: UpdateWeatherSettingsDto,
  ) {
    return this.weather.updateSettings(resolveCompanyId(user, companyId), dto);
  }

  @Get('current')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Live weather at company office location' })
  current(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.weather.getCurrentOfficeWeather(resolveCompanyId(user, companyId));
  }

  @Get('dashboard')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR weather alerts dashboard for today' })
  dashboard(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.weather.getHrDashboard(resolveCompanyId(user, companyId));
  }

  @Post('run-check')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually trigger weather check for company' })
  runCheck(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.weather.runDailyCheckForCompany(resolveCompanyId(user, companyId));
  }

  @Post('alerts/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR approve WFH for eligible employees (all pending or selected)' })
  approveAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: AdminApproveAlertsDto,
  ) {
    return this.weather.approveAlertsForAdmin(resolveCompanyId(user, companyId), dto.alertIds);
  }

  @Post('alerts/:alertId/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR allow work from home for an employee (no auto check-in)' })
  approveAlert(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Param('alertId') alertId: string,
  ) {
    return this.weather.approveAlertForAdmin(resolveCompanyId(user, companyId), alertId);
  }

  @Post('alerts/:alertId/revoke')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR not allow WFH — employee should come to office' })
  revokeAlert(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Param('alertId') alertId: string,
  ) {
    return this.weather.revokeAlertForAdmin(resolveCompanyId(user, companyId), alertId);
  }
}
