import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide statistics' })
  getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('companies')
  @ApiOperation({ summary: 'List all companies' })
  listCompanies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listCompanies(page, limit, search);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company details' })
  getCompany(@Param('id') id: string) {
    return this.adminService.getCompany(id);
  }

  @Put('companies/:id/status')
  @ApiOperation({ summary: 'Activate/deactivate company' })
  updateCompanyStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.adminService.updateCompanyStatus(id, body.isActive);
  }

  @Put('companies/:id/subscription')
  @ApiOperation({ summary: 'Update company subscription' })
  updateSubscription(
    @Param('id') id: string,
    @Body() body: { plan: SubscriptionPlan; status?: SubscriptionStatus },
  ) {
    return this.adminService.updateSubscription(id, body.plan, body.status);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(page, limit, search);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Activate/deactivate user' })
  updateUserStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.adminService.updateUserStatus(id, body.isActive);
  }

  @Get('activity-logs')
  @ApiOperation({ summary: 'Platform activity logs' })
  getActivityLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getActivityLogs(page, limit);
  }
}
