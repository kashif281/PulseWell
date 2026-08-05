import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, LiveAttendanceStatus, PresenceVisibility, UserRole, WeatherAlertResponse } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  calcWorkingHours,
  getEmployeeByUserId,
  parseTimeOnDate,
  startOfDay,
} from './hrm.helpers';
import { AttendanceEventsService } from './attendance-events.service';
import { CompanyActivityService } from './company-activity.service';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private events: AttendanceEventsService,
    private activity: CompanyActivityService,
  ) {}

  private async getOrCreateTodayRecord(employeeId: string, date: Date) {
    let record = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
      include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
    });

    if (!record) {
      record = await this.prisma.attendance.create({
        data: {
          employeeId,
          date,
          liveStatus: LiveAttendanceStatus.ABSENT,
        },
        include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
      });
    } else if (
      record.sessions.length === 0 &&
      record.checkInAt &&
      !record.dayEndedAt
    ) {
      await this.migrateLegacySession(record.id, record.checkInAt, record.checkOutAt, record.isRemote);
      record = await this.prisma.attendance.findUniqueOrThrow({
        where: { id: record.id },
        include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
      });
    }

    return record;
  }

  private async migrateLegacySession(
    attendanceId: string,
    checkInAt: Date,
    checkOutAt: Date | null,
    isRemote: boolean,
  ) {
    await this.prisma.attendanceSession.create({
      data: {
        attendanceId,
        sessionNumber: 1,
        checkInAt,
        checkOutAt,
        isRemote,
        workingHours: checkOutAt ? calcWorkingHours(checkInAt, checkOutAt) : null,
      },
    });
    await this.recalculateRollup(attendanceId);
  }

  private getOpenSession<T extends { checkOutAt: Date | null }>(sessions: T[]): T | null {
    return sessions.find((s) => !s.checkOutAt) ?? null;
  }

  private async recalculateRollup(attendanceId: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        sessions: { orderBy: { checkInAt: 'asc' } },
        employee: { include: { company: true } },
      },
    });
    if (!attendance) return null;

    const sessions = attendance.sessions;
    let totalWorkingHours = 0;
    let totalBreakMinutes = 0;

    for (const session of sessions) {
      if (session.checkOutAt) {
        const hours = calcWorkingHours(session.checkInAt, session.checkOutAt);
        totalWorkingHours += hours;
        await this.prisma.attendanceSession.update({
          where: { id: session.id },
          data: { workingHours: hours },
        });
      }
    }

    for (let i = 0; i < sessions.length - 1; i++) {
      const current = sessions[i];
      const next = sessions[i + 1];
      if (current.checkOutAt) {
        const breakMs = next.checkInAt.getTime() - current.checkOutAt.getTime();
        totalBreakMinutes += Math.max(0, breakMs / 60000);
      }
    }

    const openSession = this.getOpenSession(sessions);
    const firstCheckIn = sessions[0]?.checkInAt ?? null;
    const closedSessions = sessions.filter((s) => s.checkOutAt);
    const lastCheckOut = closedSessions.length
      ? closedSessions[closedSessions.length - 1].checkOutAt
      : null;

    let liveStatus: LiveAttendanceStatus;
    if (attendance.status === AttendanceStatus.ON_LEAVE) {
      liveStatus = LiveAttendanceStatus.ON_LEAVE;
    } else if (attendance.status === AttendanceStatus.HALF_DAY) {
      liveStatus = LiveAttendanceStatus.ON_LEAVE;
    } else if (attendance.dayEndedAt) {
      liveStatus = LiveAttendanceStatus.CHECKED_OUT;
    } else if (openSession) {
      liveStatus = openSession.isRemote ? LiveAttendanceStatus.REMOTE : LiveAttendanceStatus.WORKING;
    } else if (sessions.length > 0) {
      liveStatus = LiveAttendanceStatus.ON_BREAK;
    } else {
      liveStatus = LiveAttendanceStatus.ABSENT;
    }

    const company = attendance.employee.company;
    const workEnd = parseTimeOnDate(attendance.date, company.businessHoursEnd ?? '17:00');
    const missingCheckOut =
      !attendance.dayEndedAt &&
      !openSession &&
      sessions.length > 0 &&
      new Date() > workEnd;

    let lateMinutes = attendance.lateMinutes ?? 0;
    if (firstCheckIn && sessions.length === 1 && !sessions[0].checkOutAt) {
      const workStart = parseTimeOnDate(attendance.date, company.businessHoursStart ?? '09:00');
      lateMinutes = Math.max(0, Math.floor((firstCheckIn.getTime() - workStart.getTime()) / 60000));
    }

    const standardHours = 8;
    const overtimeHours = Math.max(0, totalWorkingHours - standardHours);

    let attendanceStatus: AttendanceStatus = AttendanceStatus.PRESENT;
    if (liveStatus === LiveAttendanceStatus.REMOTE) attendanceStatus = AttendanceStatus.REMOTE;
    else if (liveStatus === LiveAttendanceStatus.ON_LEAVE) attendanceStatus = AttendanceStatus.ON_LEAVE;
    else if (lateMinutes > 5) attendanceStatus = AttendanceStatus.LATE;

    return this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        firstCheckInAt: firstCheckIn,
        lastCheckOutAt: lastCheckOut,
        checkInAt: openSession?.checkInAt ?? firstCheckIn,
        checkOutAt: attendance.dayEndedAt ? lastCheckOut : openSession ? null : lastCheckOut,
        workingHours: totalWorkingHours,
        overtimeHours,
        totalBreakMinutes: Math.round(totalBreakMinutes),
        sessionCount: sessions.length,
        liveStatus,
        missingCheckOut,
        lateMinutes: lateMinutes > 5 ? lateMinutes : 0,
        status: attendanceStatus,
        isRemote: openSession?.isRemote ?? sessions.some((s) => s.isRemote),
      },
      include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
    });
  }

  private formatEmployeeName(user: { firstName?: string | null; lastName?: string | null }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  }

  private async publishAttendanceUpdate(companyId: string, payload: unknown) {
    this.events.publish(companyId, { type: 'attendance', companyId, payload });
  }

  async checkIn(userId: string, isRemote = false) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const today = startOfDay();
    const now = new Date();

    const record = await this.getOrCreateTodayRecord(employee.id, today);

    if (record.dayEndedAt) {
      throw new BadRequestException('Workday already ended. You cannot check in again today.');
    }
    if (record.status === AttendanceStatus.ON_LEAVE || record.status === AttendanceStatus.HALF_DAY) {
      throw new BadRequestException('You are on leave today');
    }
    if (this.getOpenSession(record.sessions)) {
      throw new BadRequestException('Already checked in. Check out before starting a new session.');
    }

    const sessionNumber = record.sessions.length + 1;
    await this.prisma.attendanceSession.create({
      data: {
        attendanceId: record.id,
        sessionNumber,
        checkInAt: now,
        isRemote,
      },
    });

    await this.prisma.attendanceLog.create({
      data: { attendanceId: record.id, action: 'CHECK_IN', metadata: { isRemote, sessionNumber } },
    });

    const updated = await this.recalculateRollup(record.id);
    const name = this.formatEmployeeName(employee.user);

    const activityType = sessionNumber > 1 ? 'RETURN_FROM_BREAK' : 'CHECK_IN';
    const message =
      sessionNumber > 1
        ? `${name} returned from break at ${now.toLocaleTimeString()}`
        : `${name} checked in at ${now.toLocaleTimeString()}${isRemote ? ' (remote)' : ''}`;

    await this.activity.log(employee.companyId, employee.id, activityType, message, {
      isRemote,
      sessionNumber,
    });

    await this.publishAttendanceUpdate(employee.companyId, { employeeId: employee.id, action: 'check_in' });

    return this.formatTodayResponse(updated!);
  }

  async checkOut(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const today = startOfDay();
    const now = new Date();

    const record = await this.getOrCreateTodayRecord(employee.id, today);
    const openSession = record.sessions.find((s) => !s.checkOutAt);

    if (!openSession) {
      throw new BadRequestException('No active check-in session. Check in first.');
    }

    await this.prisma.attendanceSession.update({
      where: { id: openSession.id },
      data: { checkOutAt: now },
    });

    await this.prisma.attendanceLog.create({
      data: {
        attendanceId: record.id,
        action: 'CHECK_OUT',
        metadata: { sessionNumber: openSession.sessionNumber },
      },
    });

    const updated = await this.recalculateRollup(record.id);
    const name = this.formatEmployeeName(employee.user);

    await this.activity.log(
      employee.companyId,
      employee.id,
      'CHECK_OUT',
      `${name} checked out at ${now.toLocaleTimeString()}`,
      { sessionNumber: openSession.sessionNumber },
    );

    await this.publishAttendanceUpdate(employee.companyId, { employeeId: employee.id, action: 'check_out' });

    return this.formatTodayResponse(updated!);
  }

  async endDay(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const today = startOfDay();
    const now = new Date();

    const record = await this.getOrCreateTodayRecord(employee.id, today);
    const openSession = record.sessions.find((s) => !s.checkOutAt);

    if (openSession) {
      await this.prisma.attendanceSession.update({
        where: { id: openSession.id },
        data: { checkOutAt: now },
      });
    }

    if (record.sessions.length === 0 && !record.checkInAt) {
      throw new BadRequestException('No attendance recorded today');
    }

    await this.prisma.attendance.update({
      where: { id: record.id },
      data: { dayEndedAt: now },
    });

    const updated = await this.recalculateRollup(record.id);
    const name = this.formatEmployeeName(employee.user);

    await this.activity.log(
      employee.companyId,
      employee.id,
      'END_DAY',
      `${name} ended the workday at ${now.toLocaleTimeString()}`,
    );

    await this.publishAttendanceUpdate(employee.companyId, { employeeId: employee.id, action: 'end_day' });

    return this.formatTodayResponse(updated!);
  }

  private formatTodayResponse(
    record: Awaited<ReturnType<AttendanceService['recalculateRollup']>> & {
      sessions: {
        id: string;
        sessionNumber: number;
        checkInAt: Date;
        checkOutAt: Date | null;
        isRemote: boolean;
        workingHours: number | null;
      }[];
    },
  ) {
    if (!record) return null;
    const openSession = record.sessions.find((s) => !s.checkOutAt);
    return {
      ...record,
      currentSessionStart: openSession?.checkInAt ?? null,
      canCheckIn:
        !record.dayEndedAt &&
        record.status !== AttendanceStatus.ON_LEAVE &&
        record.status !== AttendanceStatus.HALF_DAY &&
        !openSession,
      canCheckOut: Boolean(openSession),
      canEndDay:
        !record.dayEndedAt &&
        record.sessions.length > 0 &&
        !openSession,
    };
  }

  async getToday(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const today = startOfDay();
    const record = await this.getOrCreateTodayRecord(employee.id, today);
    const refreshed = await this.recalculateRollup(record.id);
    return refreshed ? this.formatTodayResponse(refreshed as never) : null;
  }

  async getMyHistory(userId: string, from?: string, to?: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    const start = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const end = to ? new Date(to) : new Date();
    return this.prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: start, lte: end } },
      orderBy: { date: 'desc' },
      include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
    });
  }

  private mapLiveToRosterStatus(liveStatus: LiveAttendanceStatus | null): string {
    switch (liveStatus) {
      case LiveAttendanceStatus.WORKING:
        return 'PRESENT';
      case LiveAttendanceStatus.REMOTE:
        return 'REMOTE';
      case LiveAttendanceStatus.ON_BREAK:
        return 'ON_BREAK';
      case LiveAttendanceStatus.CHECKED_OUT:
        return 'CHECKED_OUT';
      case LiveAttendanceStatus.ON_LEAVE:
        return 'ON_LEAVE';
      default:
        return 'ABSENT';
    }
  }

  async getCompanyDashboard(companyId: string, dateStr?: string) {
    const date = dateStr ? startOfDay(new Date(dateStr)) : startOfDay();

    const employees = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        department: true,
      },
      orderBy: { user: { lastName: 'asc' } },
    });

    const employeeIds = employees.map((e) => e.id);

    const [attendanceRows, leavesToday, upcomingLeaves, weatherWfhAlerts] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: { in: employeeIds }, date },
        include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          startDate: { lte: date },
          endDate: { gte: date },
        },
        include: { leaveType: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          startDate: { gt: date },
        },
        include: {
          leaveType: true,
          employee: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              department: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
        take: 30,
      }),
      this.prisma.weatherAlert.findMany({
        where: {
          companyId,
          date,
          response: WeatherAlertResponse.ACCEPTED,
        },
        include: {
          employee: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              department: true,
            },
          },
        },
      }),
    ]);

    const attendanceByEmployee = new Map(attendanceRows.map((a) => [a.employeeId, a]));
    const leaveByEmployee = new Map(leavesToday.map((l) => [l.employeeId, l]));

    type RosterEntry = {
      employeeId: string;
      name: string;
      email: string;
      department: string | null;
      status: string;
      liveStatus: string | null;
      checkInAt: Date | null;
      checkOutAt: Date | null;
      currentSessionStart: Date | null;
      sessionCount: number;
      leaveType?: string;
      leaveStart?: Date;
      leaveEnd?: Date;
    };

    const roster: RosterEntry[] = [];

    for (const emp of employees) {
      const name =
        `${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim() || emp.user.email;
      const dept = emp.department?.name ?? null;
      const leave = leaveByEmployee.get(emp.id);
      const att = attendanceByEmployee.get(emp.id);
      const openSession = att?.sessions?.find((s) => !s.checkOutAt);

      if (leave) {
        roster.push({
          employeeId: emp.id,
          name,
          email: emp.user.email,
          department: dept,
          status: 'ON_LEAVE',
          liveStatus: 'ON_LEAVE',
          checkInAt: att?.firstCheckInAt ?? att?.checkInAt ?? null,
          checkOutAt: att?.lastCheckOutAt ?? att?.checkOutAt ?? null,
          currentSessionStart: null,
          sessionCount: att?.sessionCount ?? 0,
          leaveType: leave.leaveType.name,
          leaveStart: leave.startDate,
          leaveEnd: leave.endDate,
        });
        continue;
      }

      if (!att || att.liveStatus === LiveAttendanceStatus.ABSENT || att.sessionCount === 0) {
        roster.push({
          employeeId: emp.id,
          name,
          email: emp.user.email,
          department: dept,
          status: 'ABSENT',
          liveStatus: 'ABSENT',
          checkInAt: null,
          checkOutAt: null,
          currentSessionStart: null,
          sessionCount: 0,
        });
        continue;
      }

      const rosterStatus = this.mapLiveToRosterStatus(att.liveStatus);

      roster.push({
        employeeId: emp.id,
        name,
        email: emp.user.email,
        department: dept,
        status: rosterStatus,
        liveStatus: att.liveStatus,
        checkInAt: att.firstCheckInAt ?? att.checkInAt,
        checkOutAt: att.lastCheckOutAt ?? att.checkOutAt,
        currentSessionStart: openSession?.checkInAt ?? null,
        sessionCount: att.sessionCount,
      });
    }

    const onLeaveList = roster.filter((r) => r.status === 'ON_LEAVE');
    const absentList = roster.filter((r) => r.status === 'ABSENT');
    const lateList = roster.filter((r) => attendanceByEmployee.get(r.employeeId)?.status === 'LATE');
    const remoteList = roster.filter((r) => r.status === 'REMOTE');
    const workingList = roster.filter((r) => ['PRESENT', 'LATE', 'REMOTE'].includes(r.status));
    const onBreakList = roster.filter((r) => r.status === 'ON_BREAK');
    const checkedOutList = roster.filter((r) => r.status === 'CHECKED_OUT');
    const officePresentList = roster.filter((r) => ['PRESENT', 'LATE'].includes(r.status));

    const remoteEmployeeIds = new Set(remoteList.map((r) => r.employeeId));
    const wfhApprovedPendingToday = weatherWfhAlerts
      .filter((a) => !remoteEmployeeIds.has(a.employeeId) && !leaveByEmployee.has(a.employeeId))
      .map((a) => ({
        employeeId: a.employeeId,
        name:
          `${a.employee.user.firstName ?? ''} ${a.employee.user.lastName ?? ''}`.trim() ||
          a.employee.user.email,
        email: a.employee.user.email,
        department: a.employee.department?.name ?? null,
        status: 'WFH_APPROVED',
        reason: a.reason,
      }));

    return {
      date,
      totalEmployees: employees.length,
      checkedIn: workingList.length,
      checkedOut: checkedOutList.length,
      onBreak: onBreakList.length,
      absent: absentList.length,
      onLeave: onLeaveList.length,
      late: lateList.length,
      remote: remoteList.length,
      wfhApprovedPending: wfhApprovedPendingToday.length,
      onLeaveToday: onLeaveList,
      absentToday: absentList,
      lateToday: lateList,
      remoteToday: remoteList,
      wfhApprovedPendingToday,
      onBreakToday: onBreakList,
      presentToday: officePresentList,
      checkedOutToday: checkedOutList,
      upcomingLeaves: upcomingLeaves.map((l) => ({
        employeeId: l.employeeId,
        name: `${l.employee.user.firstName ?? ''} ${l.employee.user.lastName ?? ''}`.trim(),
        email: l.employee.user.email,
        department: l.employee.department?.name ?? null,
        leaveType: l.leaveType.name,
        startDate: l.startDate,
        endDate: l.endDate,
      })),
      records: attendanceRows,
    };
  }

  private async getVisibleEmployeeIds(viewerUserId: string) {
    const viewer = await getEmployeeByUserId(this.prisma, viewerUserId);
    const company = await this.prisma.company.findUnique({
      where: { id: viewer.companyId },
    });
    const visibility = company?.presenceVisibility ?? PresenceVisibility.COMPANY;

    const allEmployees = await this.prisma.employee.findMany({
      where: { companyId: viewer.companyId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
      select: { id: true, departmentId: true, managerId: true },
    });

    if (visibility === PresenceVisibility.COMPANY) {
      return allEmployees.map((e) => e.id);
    }

    if (visibility === PresenceVisibility.DEPARTMENT) {
      return allEmployees
        .filter((e) => e.departmentId === viewer.departmentId)
        .map((e) => e.id);
    }

    const visible = new Set<string>([viewer.id]);
    for (const emp of allEmployees) {
      if (emp.managerId === viewer.id) visible.add(emp.id);
      if (emp.id === viewer.managerId) visible.add(emp.id);
      if (viewer.managerId && emp.managerId === viewer.managerId) visible.add(emp.id);
    }
    return [...visible];
  }

  async getTeamPresence(
    userId: string,
    filters?: { department?: string; status?: string; search?: string },
  ) {
    const viewer = await getEmployeeByUserId(this.prisma, userId);
    const visibleIds = await this.getVisibleEmployeeIds(userId);
    const today = startOfDay();

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: visibleIds },
        companyId: viewer.companyId,
        employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
        ...(filters?.department && {
          department: { name: { equals: filters.department, mode: 'insensitive' } },
        }),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        department: true,
      },
      orderBy: { user: { lastName: 'asc' } },
    });

    const ids = employees.map((e) => e.id);
    const [attendanceRows, leavesToday] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: today },
        include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: { leaveType: true },
      }),
    ]);

    const attMap = new Map(attendanceRows.map((a) => [a.employeeId, a]));
    const leaveMap = new Map(leavesToday.map((l) => [l.employeeId, l]));

    let members = employees.map((emp) => {
      const name =
        `${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim() || emp.user.email;
      const att = attMap.get(emp.id);
      const leave = leaveMap.get(emp.id);
      const openSession = att?.sessions?.find((s) => !s.checkOutAt);

      let liveStatus = att?.liveStatus ?? LiveAttendanceStatus.ABSENT;
      if (leave) liveStatus = LiveAttendanceStatus.ON_LEAVE;

      return {
        employeeId: emp.id,
        name,
        email: emp.user.email,
        avatarUrl: emp.user.avatarUrl,
        department: emp.department?.name ?? null,
        position: emp.position,
        liveStatus,
        isRemote: att?.isRemote ?? false,
        currentSessionStart: openSession?.checkInAt ?? null,
        firstCheckInToday: att?.firstCheckInAt ?? att?.checkInAt ?? null,
        lastCheckOutToday: att?.lastCheckOutAt ?? att?.checkOutAt ?? null,
        sessionCount: att?.sessionCount ?? 0,
        workingHours: att?.workingHours ?? 0,
        totalBreakMinutes: att?.totalBreakMinutes ?? 0,
      };
    });

    if (filters?.status) {
      members = members.filter((m) => m.liveStatus === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.department?.toLowerCase().includes(q) ?? false),
      );
    }

    const counts = {
      working: members.filter((m) => m.liveStatus === LiveAttendanceStatus.WORKING).length,
      remote: members.filter((m) => m.liveStatus === LiveAttendanceStatus.REMOTE).length,
      onBreak: members.filter((m) => m.liveStatus === LiveAttendanceStatus.ON_BREAK).length,
      checkedOut: members.filter((m) => m.liveStatus === LiveAttendanceStatus.CHECKED_OUT).length,
      onLeave: members.filter((m) => m.liveStatus === LiveAttendanceStatus.ON_LEAVE).length,
      absent: members.filter((m) => m.liveStatus === LiveAttendanceStatus.ABSENT).length,
    };

    const departments = await this.prisma.department.findMany({
      where: { companyId: viewer.companyId },
      select: { name: true },
    });

    return {
      date: today,
      counts,
      departments: departments.map((d) => d.name),
      members,
      presenceVisibility: (
        await this.prisma.company.findUnique({ where: { id: viewer.companyId } })
      )?.presenceVisibility,
    };
  }

  async syncLeaveAttendance(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    options?: { isHalfDay?: boolean; leaveTypeCode?: string },
  ) {
    const cur = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));
    const isWfh = options?.leaveTypeCode === 'WFH';
    const status = isWfh
      ? AttendanceStatus.REMOTE
      : options?.isHalfDay
        ? AttendanceStatus.HALF_DAY
        : AttendanceStatus.ON_LEAVE;

    while (cur <= end) {
      const date = new Date(cur);
      await this.prisma.attendance.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: {
          status,
          liveStatus: LiveAttendanceStatus.ON_LEAVE,
          isRemote: isWfh,
          lateMinutes: 0,
          checkInAt: null,
          checkOutAt: null,
          workingHours: null,
          overtimeHours: null,
          dayEndedAt: null,
        },
        create: {
          employeeId,
          date,
          status,
          liveStatus: LiveAttendanceStatus.ON_LEAVE,
          isRemote: isWfh,
        },
      });
      cur.setDate(cur.getDate() + 1);
    }
  }

  async getEmployeeCalendar(
    employeeId: string,
    year: number,
    month: number,
    requester: { sub: string; role: UserRole; companyId?: string | null },
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, userId: true, companyId: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (requester.role === UserRole.EMPLOYEE && employee.userId !== requester.sub) {
      throw new ForbiddenException('You can only view your own attendance calendar');
    }
    if (
      requester.role === UserRole.COMPANY_ADMIN &&
      employee.companyId !== requester.companyId
    ) {
      throw new ForbiddenException('You can only view calendars in your company');
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const [attendance, leaves] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId, date: { gte: start, lte: end } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: { leaveType: true },
      }),
    ]);

    const days: Record<string, { status: string; label: string }> = {};
    for (const a of attendance) {
      const key = a.date.toISOString().split('T')[0];
      let status = 'present';
      if (a.status === 'LATE') status = 'late';
      else if (a.isRemote) status = 'remote';
      else if (a.status === 'ABSENT') status = 'absent';
      days[key] = { status, label: a.status };
    }
    for (const l of leaves) {
      const cur = new Date(l.startDate);
      while (cur <= l.endDate && cur <= end) {
        if (cur >= start) {
          const key = cur.toISOString().split('T')[0];
          days[key] = { status: 'leave', label: l.leaveType.name };
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    return { year, month, days };
  }

  async getCompanyHistory(
    companyId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    from?: string,
  ) {
    const end = startOfDay();
    const start = from ? new Date(from) : new Date(end);
    if (!from) {
      if (period === 'daily') start.setDate(end.getDate() - 7);
      else if (period === 'weekly') start.setDate(end.getDate() - 28);
      else start.setMonth(end.getMonth() - 1);
    }

    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: { id: true },
    });
    const ids = employees.map((e) => e.id);

    return this.prisma.attendance.findMany({
      where: { employeeId: { in: ids }, date: { gte: start, lte: end } },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: true,
          },
        },
        sessions: { orderBy: { sessionNumber: 'asc' } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
