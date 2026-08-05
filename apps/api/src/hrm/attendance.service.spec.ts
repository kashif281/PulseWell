import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.module';

describe('AttendanceService calendar authorization', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    attendance: { findMany: jest.fn() },
    leaveRequest: { findMany: jest.fn() },
  };

  let service: AttendanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
    );
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
  });

  it('blocks employees from viewing another calendar', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-2',
      userId: 'user-2',
      companyId: 'company-a',
    });

    await expect(
      service.getEmployeeCalendar('emp-2', 2026, 7, {
        sub: 'user-1',
        role: UserRole.EMPLOYEE,
        companyId: 'company-a',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks company admins from other companies', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-2',
      userId: 'user-2',
      companyId: 'company-b',
    });

    await expect(
      service.getEmployeeCalendar('emp-2', 2026, 7, {
        sub: 'admin-1',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company-a',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an employee to view their own calendar', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      userId: 'user-1',
      companyId: 'company-a',
    });

    await expect(
      service.getEmployeeCalendar('emp-1', 2026, 7, {
        sub: 'user-1',
        role: UserRole.EMPLOYEE,
        companyId: 'company-a',
      }),
    ).resolves.toEqual(expect.objectContaining({ year: 2026, month: 7 }));
  });

  it('returns not found for missing employees', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(
      service.getEmployeeCalendar('missing', 2026, 7, {
        sub: 'admin-1',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
