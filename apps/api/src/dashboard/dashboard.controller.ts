import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('employee')
  @ApiOperation({ summary: 'Get employee workforce dashboard' })
  getEmployeeDashboard(@CurrentUser('sub') userId: string) {
    return this.dashboardService.getEmployeeDashboard(userId);
  }

  @Get('employer')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get employer/HR dashboard' })
  getEmployerDashboard(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
  ) {
    return this.dashboardService.getEmployerDashboard(resolveCompanyId(user, companyId));
  }
}
