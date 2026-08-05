import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { AttendanceService } from './attendance.service';
import { AttendanceEventsService } from './attendance-events.service';
import { CompanyActivityService } from './company-activity.service';
import { LeaveService } from './leave.service';
import { PayrollService } from './payroll.service';
import { ApprovalsService, HrmDashboardService } from './hrm-dashboard.service';
import { PrismaService } from '../prisma/prisma.module';
import { UpdateEmployeeSalaryDto } from './dto/salary.dto';
import { CreateLeaveRequestDto } from './dto/leave.dto';

@ApiTags('HRM')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('hrm')
export class HrmController {
  constructor(
    private attendance: AttendanceService,
    private attendanceEvents: AttendanceEventsService,
    private companyActivity: CompanyActivityService,
    private leave: LeaveService,
    private payroll: PayrollService,
    private approvals: ApprovalsService,
    private hrmDashboard: HrmDashboardService,
    private prisma: PrismaService,
  ) {}

  // --- Attendance (employee) ---
  @Post('attendance/check-in')
  @ApiOperation({ summary: 'Employee check in (office)' })
  checkIn(@CurrentUser('sub') userId: string) {
    return this.attendance.checkIn(userId, false);
  }

  @Post('attendance/check-in/remote')
  @ApiOperation({ summary: 'Employee check in from home' })
  checkInRemote(@CurrentUser('sub') userId: string) {
    return this.attendance.checkIn(userId, true);
  }

  @Post('attendance/check-out')
  @ApiOperation({ summary: 'Employee check out' })
  checkOut(@CurrentUser('sub') userId: string) {
    return this.attendance.checkOut(userId);
  }

  @Post('attendance/end-day')
  @ApiOperation({ summary: 'End workday (no more sessions today)' })
  endDay(@CurrentUser('sub') userId: string) {
    return this.attendance.endDay(userId);
  }

  @Get('attendance/today')
  @ApiOperation({ summary: 'Today attendance' })
  todayAttendance(@CurrentUser('sub') userId: string) {
    return this.attendance.getToday(userId);
  }

  @Get('attendance/history')
  @ApiOperation({ summary: 'My attendance history' })
  myHistory(
    @CurrentUser('sub') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.getMyHistory(userId, from, to);
  }

  @Get('attendance/calendar/:employeeId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Attendance calendar' })
  calendar(
    @CurrentUser() user: JwtPayload,
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.attendance.getEmployeeCalendar(employeeId, y, m, user);
  }

  @Get('attendance/presence')
  @ApiOperation({ summary: 'Team presence — who is working today' })
  teamPresence(
    @CurrentUser('sub') userId: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.attendance.getTeamPresence(userId, { department, status, search });
  }

  @Sse('attendance/stream')
  @ApiOperation({ summary: 'Real-time attendance & activity stream (SSE)' })
  attendanceStream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    const companyId = user.companyId!;
    return this.attendanceEvents.subscribe(companyId).pipe(
      map((event) => ({ data: JSON.stringify(event) })),
    );
  }

  @Get('activity/feed')
  @ApiOperation({ summary: 'Company activity feed' })
  activityFeed(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const companyId = user.companyId!;
    return this.companyActivity.getFeed(companyId, limit ? parseInt(limit, 10) : 30);
  }

  @Get('attendance/dashboard')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR attendance dashboard' })
  attendanceDashboard(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('date') date?: string,
  ) {
    return this.attendance.getCompanyDashboard(resolveCompanyId(user, companyId), date);
  }

  @Get('attendance/company-history')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company attendance history' })
  companyHistory(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
  ) {
    return this.attendance.getCompanyHistory(resolveCompanyId(user, companyId), period);
  }

  // --- Leave ---
  @Get('leave/types')
  @ApiOperation({ summary: 'Leave types' })
  leaveTypes(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = user.role === UserRole.EMPLOYEE ? user.companyId! : resolveCompanyId(user, companyId);
    return this.leave.getLeaveTypes(cid);
  }

  @Get('leave/balances')
  @ApiOperation({ summary: 'My leave balances' })
  balances(@CurrentUser('sub') userId: string) {
    return this.leave.getMyBalances(userId);
  }

  @Post('leave/requests')
  @ApiOperation({ summary: 'Submit leave request' })
  createLeave(@CurrentUser('sub') userId: string, @Body() body: CreateLeaveRequestDto) {
    return this.leave.createRequest(userId, body);
  }

  @Get('leave/requests/me')
  @ApiOperation({ summary: 'My leave requests' })
  myLeaves(@CurrentUser('sub') userId: string) {
    return this.leave.getMyRequests(userId);
  }

  @Post('leave/requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel leave request' })
  cancelLeave(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.leave.cancelRequest(userId, id);
  }

  @Get('leave/requests')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company leave requests' })
  companyLeaves(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('status') status?: never,
  ) {
    return this.leave.getCompanyRequests(resolveCompanyId(user, companyId), status);
  }

  @Put('leave/requests/:id/review')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject leave' })
  reviewLeave(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; notes?: string },
  ) {
    return this.leave.reviewRequest(id, user, body.action, body.notes);
  }

  @Get('leave/upcoming')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upcoming approved leaves' })
  upcomingLeaves(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.leave.getUpcomingLeaves(resolveCompanyId(user, companyId));
  }

  // --- Payroll ---
  @Post('payroll/generate')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate monthly payroll' })
  generatePayroll(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Body() body?: { year?: number; month?: number },
  ) {
    const now = new Date();
    const year = body?.year ?? now.getFullYear();
    const month = body?.month ?? now.getMonth() + 1;
    return this.payroll.generatePayroll(resolveCompanyId(user, companyId), year, month);
  }

  @Get('payroll')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List payrolls' })
  listPayrolls(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.payroll.listPayrolls(resolveCompanyId(user, companyId));
  }

  @Get('payroll/slips/me')
  @ApiOperation({ summary: 'My salary slips' })
  mySlips(@CurrentUser('sub') userId: string) {
    return this.payroll.getMySalarySlips(userId);
  }

  @Get('payroll/slips/:id')
  @ApiOperation({ summary: 'Salary slip detail' })
  slip(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payroll.getSalarySlip(id, user);
  }

  @Get('payroll/loans/list')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Company loans' })
  listLoans(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.payroll.getCompanyLoans(resolveCompanyId(user, companyId));
  }

  @Post('payroll/loans')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Issue employee loan' })
  createLoan(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.payroll.createLoan(resolveCompanyId(user, companyId), body as never);
  }

  @Get('payroll/:id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Payroll detail' })
  payrollDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.payroll.getPayroll(id, resolveCompanyId(user, companyId));
  }

  @Put('payroll/:id/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve payroll' })
  approvePayroll(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.payroll.approvePayroll(id, resolveCompanyId(user, companyId));
  }

  @Put('payroll/:id/paid')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark payroll as paid' })
  paidPayroll(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.payroll.markPayrollPaid(id, resolveCompanyId(user, companyId));
  }

  @Get('employees/:id/salary')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get employee salary structure' })
  getSalary(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.payroll.getEmployeeSalary(id, user);
  }

  @Put('employees/:id/salary')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update employee salary structure' })
  updateSalary(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateEmployeeSalaryDto,
  ) {
    return this.payroll.updateEmployeeSalary(id, body, user);
  }

  // --- Approvals ---
  @Get('approvals/pending')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Pending approvals' })
  pendingApprovals(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.approvals.listPending(resolveCompanyId(user, companyId));
  }

  @Get('approvals')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'All approvals' })
  allApprovals(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.approvals.listAll(resolveCompanyId(user, companyId), status);
  }

  // --- Dashboards ---
  @Get('dashboard/employee')
  @ApiOperation({ summary: 'Employee HR dashboard' })
  employeeDashboard(@CurrentUser('sub') userId: string) {
    return this.hrmDashboard.getEmployeeDashboard(userId);
  }

  @Get('dashboard/hr')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unified HR overview' })
  hrDashboard(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.hrmDashboard.getHrOverview(resolveCompanyId(user, companyId));
  }

  @Get('insights')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'HR operational AI insights' })
  hrInsights(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    return this.hrmDashboard.getHrInsights(resolveCompanyId(user, companyId));
  }

  // --- Holidays ---
  @Get('holidays')
  @ApiOperation({ summary: 'Company holidays' })
  holidays(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid =
      user.role === UserRole.EMPLOYEE && user.companyId
        ? user.companyId
        : resolveCompanyId(user, companyId);
    return this.prisma.holiday.findMany({
      where: { companyId: cid, date: { gte: new Date(new Date().getFullYear(), 0, 1) } },
      orderBy: { date: 'asc' },
    });
  }

  @Post('holidays')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add holiday' })
  addHoliday(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Body() body?: { name: string; date: string },
  ) {
    return this.prisma.holiday.create({
      data: {
        companyId: resolveCompanyId(user, companyId),
        name: body!.name,
        date: new Date(body!.date),
      },
    });
  }

  // --- HR Reports (CSV) ---
  @Get('reports/:type')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export HR report as CSV data' })
  async hrReport(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    const lines: string[] = [];

    if (type === 'attendance') {
      const rows = await this.attendance.getCompanyHistory(cid, 'monthly');
      lines.push('Date,Employee,Department,Status,CheckIn,CheckOut,Hours,LateMin');
      for (const r of rows) {
        const name = `${r.employee.user.firstName} ${r.employee.user.lastName}`;
        lines.push(
          `${r.date.toISOString().split('T')[0]},${name},${r.employee.department?.name ?? ''},${r.status},${r.checkInAt?.toISOString() ?? ''},${r.checkOutAt?.toISOString() ?? ''},${r.workingHours ?? ''},${r.lateMinutes ?? ''}`,
        );
      }
    } else if (type === 'leave') {
      const rows = await this.leave.getCompanyRequests(cid);
      lines.push('Employee,Type,Start,End,Status,Reason');
      for (const r of rows) {
        const name = `${r.employee.user.firstName} ${r.employee.user.lastName}`;
        lines.push(
          `${name},${r.leaveType.name},${r.startDate.toISOString().split('T')[0]},${r.endDate.toISOString().split('T')[0]},${r.status},${r.reason ?? ''}`,
        );
      }
    } else if (type === 'payroll') {
      const rows = await this.payroll.listPayrolls(cid);
      lines.push('PeriodStart,PeriodEnd,Status,TotalGross,TotalNet,Employees');
      for (const r of rows) {
        lines.push(
          `${r.periodStart.toISOString().split('T')[0]},${r.periodEnd.toISOString().split('T')[0]},${r.status},${r.totalGross},${r.totalNet},${r._count.items}`,
        );
      }
    } else {
      lines.push('Report type not found');
    }

    return { fileName: `${type}-report.csv`, content: lines.join('\n') };
  }
}
