import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async listPending(companyId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { companyId, status: 'PENDING' },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(companyId: string, status?: string) {
    return this.prisma.approvalRequest.findMany({
      where: { companyId, ...(status && { status: status as never }) },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

@Injectable()
export class HrmDashboardService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
  ) {}

  async getEmployeeDashboard(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!employee) return null;

    const today = await this.attendanceService.getToday(userId);
    const balances = await this.leaveService.getMyBalances(userId);
    const pendingLeaves = await this.prisma.leaveRequest.count({
      where: { employeeId: employee.id, status: 'PENDING' },
    });
    const latestSlip = await this.prisma.payrollItem.findFirst({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      include: { payroll: true, salaryPayment: true },
    });
    const upcomingHoliday = await this.prisma.holiday.findFirst({
      where: { companyId: employee.companyId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    });

    return {
      attendance: today,
      workingHours: today?.workingHours ?? 0,
      leaveBalances: balances,
      pendingLeaveRequests: pendingLeaves,
      latestSalary: latestSlip
        ? { netSalary: Number(latestSlip.netSalary), period: latestSlip.payroll.periodStart, status: latestSlip.salaryPayment?.status }
        : null,
      upcomingHoliday,
    };
  }

  async getHrOverview(companyId: string) {
    const attendance = await this.attendanceService.getCompanyDashboard(companyId);
    const [pendingLeaves, pendingPayroll, employees, payrolls] =
      await Promise.all([
        this.prisma.leaveRequest.count({
          where: {
            employee: { companyId },
            status: 'PENDING',
          },
        }),
        this.prisma.payroll.count({ where: { companyId, status: { in: ['GENERATED', 'APPROVED'] } } }),
        this.prisma.employee.count({ where: { companyId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } } }),
        this.prisma.payroll.findMany({
          where: { companyId, status: 'PAID' },
          orderBy: { periodStart: 'desc' },
          take: 1,
        }),
      ]);

    const pendingApprovals = await this.prisma.approvalRequest.count({
      where: { companyId, status: 'PENDING' },
    });

    return {
      ...attendance,
      activeEmployees: employees,
      pendingLeaveRequests: pendingLeaves,
      pendingPayroll,
      pendingApprovals,
      monthlySalaryCost: payrolls[0] ? Number(payrolls[0].totalNet) : 0,
    };
  }

  async getHrInsights(companyId: string) {
    const insights: string[] = [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const payrolls = await this.prisma.payroll.findMany({
      where: { companyId },
      orderBy: { periodStart: 'desc' },
      take: 2,
    });
    if (payrolls.length === 2) {
      const diff =
        ((Number(payrolls[0].totalNet) - Number(payrolls[1].totalNet)) / Number(payrolls[1].totalNet || 1)) * 100;
      if (Math.abs(diff) > 1) {
        insights.push(
          `Payroll ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff).toFixed(1)}% compared to last month.`,
        );
      }
    }

    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      include: {
        department: true,
        attendances: { where: { date: { gte: monthStart } } },
      },
    });

    const deptOvertime = new Map<string, number>();
    for (const e of employees) {
      const dept = e.department?.name ?? 'Unassigned';
      const ot = e.attendances.reduce((s, a) => s + (a.overtimeHours ?? 0), 0);
      deptOvertime.set(dept, (deptOvertime.get(dept) ?? 0) + ot);
    }
    let maxDept = '';
    let maxOt = 0;
    for (const [d, v] of deptOvertime) {
      if (v > maxOt) {
        maxOt = v;
        maxDept = d;
      }
    }
    if (maxDept && maxOt > 0) {
      insights.push(`${maxDept} has the highest overtime this month (${maxOt.toFixed(1)} hours).`);
    }

    const absentStreak = await this.prisma.employee.findMany({
      where: { companyId },
      include: {
        attendances: { where: { date: { gte: new Date(Date.now() - 4 * 86400000) } }, orderBy: { date: 'desc' } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const chronicAbsent = absentStreak.filter(
      (e) => e.attendances.length === 0 || e.attendances.every((a) => !a.checkInAt),
    );
    if (chronicAbsent.length > 0) {
      insights.push(
        `${chronicAbsent.length} employee(s) have been absent for more than 3 consecutive days.`,
      );
    }

    const balances = await this.prisma.leaveBalance.findMany({
      where: { employee: { companyId }, year: now.getFullYear() },
      include: { leaveType: true, employee: { include: { department: true } } },
    });
    const deptLeave = new Map<string, { used: number; allocated: number }>();
    for (const b of balances) {
      const dept = b.employee.department?.name ?? 'Unassigned';
      const cur = deptLeave.get(dept) ?? { used: 0, allocated: 0 };
      cur.used += b.used;
      cur.allocated += b.allocated;
      deptLeave.set(dept, cur);
    }
    for (const [dept, v] of deptLeave) {
      if (v.allocated > 0) {
        const pct = (v.used / v.allocated) * 100;
        if (pct >= 80) {
          insights.push(`${dept} has used ${pct.toFixed(0)}% of its annual leave allocation.`);
        }
      }
    }

    const stored = await this.prisma.aiInsight.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const s of stored) insights.push(`${s.title}: ${s.content}`);

    return { insights };
  }
}
