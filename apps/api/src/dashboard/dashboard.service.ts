import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { startOfDay } from '@pulseai/utils';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getEmployeeDashboard(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    const today = startOfDay();
    const [attendance, pendingLeaves, latestSalary, upcomingHoliday] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId: employee.id, status: 'PENDING' },
      }),
      this.prisma.payrollItem.findFirst({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
        include: { payroll: true, salaryPayment: true },
      }),
      this.prisma.holiday.findFirst({
        where: { companyId: employee.companyId, date: { gte: new Date() } },
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      greeting: `Good ${this.getTimeOfDay()}, ${employee.user.firstName ?? 'there'}!`,
      attendance,
      workingHours: attendance?.workingHours ?? 0,
      pendingLeaveRequests: pendingLeaves,
      latestSalary: latestSalary
        ? {
            netSalary: Number(latestSalary.netSalary),
            period: latestSalary.payroll.periodStart,
            status: latestSalary.salaryPayment?.status,
          }
        : null,
      upcomingHoliday,
    };
  }

  async getEmployerDashboard(companyId: string) {
    const today = startOfDay();
    const [
      employeeCount,
      activeUsers,
      checkedIn,
      onLeave,
      pendingLeaveRequests,
      pendingPayroll,
      pendingApprovals,
      latestPaidPayroll,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: { companyId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
      }),
      this.prisma.user.count({
        where: {
          companyId,
          isActive: true,
          lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.attendance.count({
        where: { employee: { companyId }, date: today, checkInAt: { not: null } },
      }),
      this.prisma.leaveRequest.count({
        where: {
          employee: { companyId },
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
      this.prisma.leaveRequest.count({ where: { employee: { companyId }, status: 'PENDING' } }),
      this.prisma.payroll.count({ where: { companyId, status: { in: ['GENERATED', 'APPROVED'] } } }),
      this.prisma.approvalRequest.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.payroll.findFirst({
        where: { companyId, status: 'PAID' },
        orderBy: { periodStart: 'desc' },
      }),
    ]);

    return {
      employeeCount,
      activeEmployees: employeeCount,
      activeUsers,
      checkedIn,
      onLeave,
      pendingLeaveRequests,
      pendingPayroll,
      pendingApprovals,
      attendanceRate: employeeCount ? Math.round((checkedIn / employeeCount) * 100) : 0,
      monthlySalaryCost: latestPaidPayroll ? Number(latestPaidPayroll.totalNet) : 0,
      pendingReports: 0,
      averageSickDays: 0,
    };
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

}
