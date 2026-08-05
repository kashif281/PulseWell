import { Controller, Get, Put, Post, Delete, Body, Query, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { EmployeeInvitationService } from './employee-invitation.service';
import {
  UpdateEmployeeProfileDto,
  CreateGoalDto,
  SetLocationFromCoordinatesDto,
  UpdateEmployeeRoleDto,
} from './dto/employee.dto';
import {
  BulkImportCommitDto,
  BulkImportPreviewDto,
  CreateEmployeeDto,
} from './dto/invitation.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '@pulseai/types';
import { resolveCompanyId } from '../common/utils/company-scope';

@ApiTags('Employees')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(
    private employeesService: EmployeesService,
    private invitationService: EmployeeInvitationService,
  ) {}

  @Get('invitations')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR invitation progress dashboard' })
  listInvitations(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.invitationService.listInvitations(cid);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create employee and send invitation' })
  createEmployee(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEmployeeDto,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.invitationService.createEmployee(cid, dto);
  }

  @Post('import/preview')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Preview bulk employee CSV import' })
  previewImport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkImportPreviewDto,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.invitationService.previewBulkImport(cid, dto.csv);
  }

  @Post('import')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Commit bulk employee import' })
  commitImport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BulkImportCommitDto,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.invitationService.commitBulkImport(
      cid,
      dto.employees,
      dto.sendInvitations !== false,
    );
  }

  @Post(':id/resend-invitation')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resend employee invitation email' })
  resendInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.invitationService.resendInvitation(cid, id);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List company employees' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
  ) {
    const targetCompanyId = resolveCompanyId(user, companyId);
    return this.employeesService.listEmployees(targetCompanyId, search);
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Offboard (deactivate) an employee' })
  deleteEmployee(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.employeesService.offboardEmployee(cid, id);
  }

  @Put(':id/role')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote/demote an employee between Manager and Employee' })
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeRoleDto,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    if (!cid) throw new BadRequestException('Company required');
    return this.employeesService.updateEmployeeRole(cid, id, dto.role === 'MANAGER' ? UserRole.MANAGER : UserRole.EMPLOYEE);
  }

  @Get('wellness-monitor')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Disabled: wellness monitor removed from HR product' })
  wellnessMonitor() {
    throw new BadRequestException('Wellness monitor is disabled for this product configuration');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my employee profile' })
  getMe(@CurrentUser('sub') userId: string) {
    return this.employeesService.getEmployee(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my employee profile' })
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateEmployeeProfileDto) {
    return this.employeesService.updateProfile(userId, dto);
  }

  @Post('me/location')
  @ApiOperation({ summary: 'Set home location from GPS coordinates' })
  setMyLocation(@CurrentUser('sub') userId: string, @Body() dto: SetLocationFromCoordinatesDto) {
    return this.employeesService.setLocationFromCoordinates(userId, dto.latitude, dto.longitude);
  }

  @Get('me/goals')
  @ApiOperation({ summary: 'Get my goals' })
  getGoals(@CurrentUser('sub') userId: string) {
    return this.employeesService.getGoals(userId);
  }

  @Post('me/goals')
  @ApiOperation({ summary: 'Create a goal' })
  createGoal(@CurrentUser('sub') userId: string, @Body() dto: CreateGoalDto) {
    return this.employeesService.createGoal(userId, dto);
  }

  @Get('me/activity')
  @ApiOperation({ summary: 'Get activity timeline' })
  getActivity(@CurrentUser('sub') userId: string, @Query('limit') limit?: number) {
    return this.employeesService.getActivityTimeline(userId, limit);
  }

  @Get(':id/detail')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Disabled: health profile removed from HR product' })
  getDetail() {
    throw new BadRequestException('Employee health detail is disabled for this product configuration');
  }
}
