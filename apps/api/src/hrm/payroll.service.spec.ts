import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.module';
import { FieldEncryptionService } from '../common/security/field-encryption.service';

describe('PayrollService tenant isolation', () => {
  const prisma = {
    payroll: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payrollItem: {
      findUnique: jest.fn(),
    },
  };

  let service: PayrollService;
  const fields = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn((value: string | null) => value),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayrollService(
      prisma as unknown as PrismaService,
      fields as unknown as FieldEncryptionService,
    );
  });

  it('scopes payroll detail queries to the requesting company', async () => {
    prisma.payroll.findFirst.mockResolvedValue(null);

    await expect(service.getPayroll('payroll-1', 'company-a')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.payroll.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payroll-1', companyId: 'company-a' },
      }),
    );
  });

  it('does not approve a payroll owned by another company', async () => {
    prisma.payroll.findFirst.mockResolvedValue(null);

    await expect(service.approvePayroll('payroll-1', 'company-a')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.payroll.update).not.toHaveBeenCalled();
  });

  it('hides another company salary slip from a company admin', async () => {
    prisma.payrollItem.findUnique.mockResolvedValue({
      id: 'item-1',
      employeeId: 'employee-1',
      breakdown: {},
      payroll: {
        companyId: 'company-b',
        company: { name: 'Other company' },
        status: 'PAID',
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-30'),
      },
      employee: {
        employeeNumber: 'E-1',
        currency: 'USD',
        user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
        department: null,
      },
      salaryPayment: null,
    });

    await expect(
      service.getSalarySlip('item-1', {
        sub: 'admin-1',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
