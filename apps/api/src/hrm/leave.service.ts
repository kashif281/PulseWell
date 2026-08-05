import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveRequestStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { getEmployeeByUserId } from './hrm.helpers';
import { AttendanceService } from './attendance.service';
import { CompanyActivityService } from './company-activity.service';

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', daysPerYear: 20 },
  { name: 'Sick Leave', code: 'SICK', daysPerYear: 10 },
  { name: 'Casual Leave', code: 'CASUAL', daysPerYear: 5 },
  { name: 'Emergency Leave', code: 'EMERGENCY', daysPerYear: 3 },
  { name: 'Maternity Leave', code: 'MATERNITY', daysPerYear: 90 },
  { name: 'Paternity Leave', code: 'PATERNITY', daysPerYear: 14 },
  { name: 'Bereavement Leave', code: 'BEREAVEMENT', daysPerYear: 5 },
  { name: 'Work From Home', code: 'WFH', daysPerYear: 24 },
  { name: 'Unpaid Leave', code: 'UNPAID', daysPerYear: 0, isPaid: false },
];

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private companyActivity: CompanyActivityService,
  ) {}

  async ensureLeaveTypes(companyId: string) {
    const count = await this.prisma.leaveType.count({ where: { companyId } });
    if (count > 0) return;
    await this.prisma.leaveType.createMany({
      data: DEFAULT_LEAVE_TYPES.map((t) => ({
        companyId,
        name: t.name,
        code: t.code,
        daysPerYear: t.daysPerYear,
        isPaid: t.isPaid ?? true,
      })),
    });
  }

  async ensureBalances(employeeId: string, companyId: string) {
    await this.ensureLeaveTypes(companyId);
    const year = new Date().getFullYear();
    const types = await this.prisma.leaveType.findMany({ where: { companyId, isActive: true } });
    for (const lt of types) {
      const existing = await this.prisma.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: lt.id, year } },
      });
      if (!existing) {
        await this.prisma.leaveBalance.create({
          data: {
            employeeId,
            leaveTypeId: lt.id,
            year,
            allocated: lt.daysPerYear,
            used: 0,
            remaining: lt.daysPerYear,
          },
        });
      }
    }
  }

  async getLeaveTypes(companyId: string) {
    await this.ensureLeaveTypes(companyId);
    return this.prisma.leaveType.findMany({ where: { companyId, isActive: true } });
  }

  async getMyBalances(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    await this.ensureBalances(employee.id, employee.companyId);
    const year = new Date().getFullYear();
    return this.prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, year },
      include: { leaveType: true },
    });
  }

  async createRequest(
    userId: string,
    dto: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      isHalfDay?: boolean;
      halfDayType?: string;
      reason?: string;
      emergencyContact?: string;
    },
  ) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('End date must be on or after start date');

    if (dto.isHalfDay) {
      if (!dto.halfDayType) {
        throw new BadRequestException('Select morning or afternoon for half-day leave');
      }
      if (start.toDateString() !== end.toDateString()) {
        throw new BadRequestException('Half-day leave must be for a single date');
      }
    }

    let days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    if (dto.isHalfDay) days = 0.5;

    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, companyId: employee.companyId },
    });
    if (!leaveType) throw new BadRequestException('Invalid leave type');

    const balance = await this.prisma.leaveBalance.findFirst({
      where: { employeeId: employee.id, leaveTypeId: dto.leaveTypeId, year: start.getFullYear() },
    });
    if (balance && balance.remaining < days) {
      throw new BadRequestException('Insufficient leave balance');
    }

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { leaveType: true },
    });
    if (overlapping) {
      const dateLabel =
        start.toDateString() === end.toDateString()
          ? start.toLocaleDateString()
          : `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
      throw new BadRequestException(
        `You already have a ${overlapping.status.toLowerCase()} ${overlapping.leaveType.name} request for ${dateLabel}.`,
      );
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        isHalfDay: dto.isHalfDay ?? false,
        halfDayType: dto.halfDayType as never,
        reason: dto.reason,
        emergencyContact: dto.emergencyContact,
        status: LeaveRequestStatus.PENDING,
      },
      include: { leaveType: true },
    });

    await this.prisma.approvalRequest.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        type: 'LEAVE',
        referenceId: request.id,
        title: `Leave request: ${request.leaveType.name}`,
        metadata: { days, startDate: dto.startDate, endDate: dto.endDate },
      },
    });

    return request;
  }

  async getMyRequests(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    return this.prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCompanyRequests(companyId: string, status?: LeaveRequestStatus) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: { id: true },
    });
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        ...(status && { status }),
      },
      include: {
        leaveType: true,
        employee: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewRequest(
    requestId: string,
    reviewer: { sub: string; role: UserRole; companyId?: string | null },
    action: 'approve' | 'reject',
    notes?: string,
  ) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: { include: { user: true } }, leaveType: true },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Request already processed');
    }

    if (reviewer.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('Not authorized');
    }
    if (reviewer.role === UserRole.COMPANY_ADMIN && request.employee.companyId !== reviewer.companyId) {
      throw new ForbiddenException('Not your company');
    }

    if (action === 'reject') {
      await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: LeaveRequestStatus.REJECTED, rejectedReason: notes },
      });
      await this.prisma.approvalRequest.updateMany({
        where: { type: 'LEAVE', referenceId: requestId },
        data: { status: 'REJECTED', reviewedAt: new Date(), notes },
      });
      return { status: 'REJECTED' };
    }

    let days = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / 86400000) + 1;
    if (request.isHalfDay) days = 0.5;

    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year: request.startDate.getFullYear(),
      },
    });
    if (balance) {
      await this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: balance.used + days,
          remaining: Math.max(0, balance.remaining - days),
        },
      });
    }

    await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: LeaveRequestStatus.APPROVED, hrApprovedAt: new Date() },
    });
    await this.prisma.approvalRequest.updateMany({
      where: { type: 'LEAVE', referenceId: requestId },
      data: { status: 'APPROVED', reviewedAt: new Date(), notes },
    });

    await this.attendanceService.syncLeaveAttendance(
      request.employeeId,
      request.startDate,
      request.endDate,
      {
        isHalfDay: request.isHalfDay,
        leaveTypeCode: request.leaveType.code,
      },
    );

    const empName = `${request.employee.user.firstName ?? ''} ${request.employee.user.lastName ?? ''}`.trim();
    await this.companyActivity.log(
      request.employee.companyId,
      request.employeeId,
      'LEAVE_APPROVED',
      `${empName} is on ${request.leaveType.name}${request.isHalfDay ? ' (half day)' : ''} until ${request.endDate.toLocaleDateString()}`,
      { leaveType: request.leaveType.name, startDate: request.startDate, endDate: request.endDate },
    );

    await this.prisma.notification.create({
      data: {
        userId: request.employee.userId,
        type: 'LEAVE_APPROVED',
        title: 'Leave approved',
        message: `Your ${request.leaveType.name} request has been approved.`,
      },
    });

    return { status: 'APPROVED' };
  }

  async cancelRequest(userId: string, requestId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, employeeId: employee.id },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending requests');
    }
    return this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: LeaveRequestStatus.CANCELLED },
    });
  }

  async getUpcomingLeaves(companyId: string) {
    const today = new Date();
    const employees = await this.prisma.employee.findMany({ where: { companyId }, select: { id: true } });
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        status: LeaveRequestStatus.APPROVED,
        endDate: { gte: today },
      },
      include: {
        leaveType: true,
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { startDate: 'asc' },
      take: 20,
    });
  }
}
