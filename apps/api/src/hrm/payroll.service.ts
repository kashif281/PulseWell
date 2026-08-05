import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { getEmployeeByUserId } from './hrm.helpers';
import { formatPayPeriodMonth } from '../common/utils/pay-period';
import { FieldEncryptionService } from '../common/security/field-encryption.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private fields: FieldEncryptionService,
  ) {}

  async ensureSalaryStructure(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return null;
    const existing = await this.prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (existing) return existing;

    const base = employee.baseSalary ?? 5000;
    return this.prisma.salaryStructure.create({
      data: {
        employeeId,
        baseSalary: base,
        allowances: [
          { type: 'TRANSPORT', amount: 200 },
          { type: 'MEDICAL', amount: 150 },
        ],
        deductions: [{ type: 'INSURANCE', amount: 100 }],
        currency: employee.currency ?? 'USD',
      },
    });
  }

  async generatePayroll(companyId: string, year: number, month: number) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const existing = await this.prisma.payroll.findFirst({
      where: { companyId, periodStart, periodEnd, status: { not: 'CANCELLED' } },
    });
    if (existing) throw new BadRequestException('Payroll already exists for this period');

    const employees = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
    });

    const payroll = await this.prisma.payroll.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        status: PayrollStatus.GENERATED,
        generatedAt: new Date(),
      },
    });

    let totalGross = 0;
    let totalNet = 0;

    for (const emp of employees) {
      const structure = await this.ensureSalaryStructure(emp.id);
      if (!structure) continue;

      const baseSalary = Number(structure.baseSalary);
      const allowances = (structure.allowances as { amount: number }[]).reduce((s, a) => s + (a.amount ?? 0), 0);
      const structDeductions = (structure.deductions as { amount: number }[]).reduce((s, d) => s + (d.amount ?? 0), 0);

      const monthStart = periodStart;
      const monthEnd = periodEnd;
      const attendance = await this.prisma.attendance.findMany({
        where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
      });
      const lateDays = attendance.filter((a) => (a.lateMinutes ?? 0) > 15).length;
      const latePenalty = lateDays * 25;
      const overtimeHours = attendance.reduce((s, a) => s + (a.overtimeHours ?? 0), 0);
      const hourlyRate = Number(emp.hourlySalary ?? baseSalary / 160);
      const overtimePay = overtimeHours * hourlyRate * 1.5;

      const activeLoan = await this.prisma.employeeLoan.findFirst({
        where: { employeeId: emp.id, status: 'ACTIVE' },
      });
      const loanDeduction = activeLoan ? Number(activeLoan.monthlyDeduction) : 0;

      const tax = baseSalary * 0.1;
      const totalDeductions = structDeductions + tax + loanDeduction + latePenalty;
      const gross = baseSalary + allowances + overtimePay;
      const net = gross - totalDeductions;

      await this.prisma.payrollItem.create({
        data: {
          payrollId: payroll.id,
          employeeId: emp.id,
          baseSalary,
          totalAllowances: allowances,
          overtimePay,
          totalDeductions,
          tax,
          loanDeduction,
          latePenalty,
          netSalary: net,
          breakdown: { allowances: structure.allowances, deductions: structure.deductions, lateDays, overtimeHours },
        },
      });

      if (activeLoan && loanDeduction > 0) {
        const newBalance = Math.max(0, Number(activeLoan.remainingBalance) - loanDeduction);
        await this.prisma.employeeLoan.update({
          where: { id: activeLoan.id },
          data: {
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'PAID' : 'ACTIVE',
          },
        });
        await this.prisma.loanPayment.create({
          data: { loanId: activeLoan.id, amount: loanDeduction, payrollId: payroll.id },
        });
      }

      totalGross += gross;
      totalNet += net;
    }

    await this.prisma.payroll.update({
      where: { id: payroll.id },
      data: { totalGross, totalNet },
    });

    await this.prisma.approvalRequest.create({
      data: {
        companyId,
        type: 'PAYROLL',
        referenceId: payroll.id,
        title: `Payroll ${month}/${year}`,
        metadata: { totalGross, totalNet, employeeCount: employees.length },
      },
    });

    return this.getPayroll(payroll.id, companyId);
  }

  async getPayroll(payrollId: string, companyId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: {
        items: {
          include: {
            employee: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
            salaryPayment: true,
          },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Payroll not found');
    return payroll;
  }

  async listPayrolls(companyId: string) {
    return this.prisma.payroll.findMany({
      where: { companyId },
      orderBy: { periodStart: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async approvePayroll(payrollId: string, companyId: string) {
    await this.requireCompanyPayroll(payrollId, companyId);
    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: PayrollStatus.APPROVED, approvedAt: new Date() },
    });
  }

  async markPayrollPaid(payrollId: string, companyId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, companyId },
      include: { items: true },
    });
    if (!payroll) throw new NotFoundException('Payroll not found');

    for (const item of payroll.items) {
      await this.prisma.salaryPayment.upsert({
        where: { payrollItemId: item.id },
        create: {
          payrollItemId: item.id,
          employeeId: item.employeeId,
          amount: item.netSalary,
          status: 'PAID',
          paidAt: new Date(),
        },
        update: { status: 'PAID', paidAt: new Date() },
      });

      const emp = await this.prisma.employee.findUnique({ where: { id: item.employeeId } });
      if (emp) {
        await this.prisma.notification.create({
          data: {
            userId: emp.userId,
            type: 'SALARY_PAID',
            title: 'Salary paid',
            message: `Your salary for ${formatPayPeriodMonth(payroll.periodStart, payroll.periodEnd)} has been marked as paid.`,
          },
        });
      }
    }

    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: PayrollStatus.PAID, paidAt: new Date() },
    });
  }

  private async requireCompanyPayroll(payrollId: string, companyId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, companyId },
      select: { id: true },
    });
    if (!payroll) throw new NotFoundException('Payroll not found');
    return payroll;
  }

  async getMySalarySlips(userId: string) {
    const employee = await getEmployeeByUserId(this.prisma, userId);
    return this.prisma.payrollItem.findMany({
      where: {
        employeeId: employee.id,
        OR: [
          { salaryPayment: { status: 'PAID' } },
          { payroll: { status: PayrollStatus.PAID } },
        ],
      },
      include: {
        payroll: true,
        salaryPayment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
  }

  private formatSalarySlip(item: Awaited<ReturnType<typeof this.loadPayrollItem>>) {
    const breakdown = (item.breakdown ?? {}) as {
      allowances?: { type: string; amount: number }[];
      deductions?: { type: string; amount: number }[];
      lateDays?: number;
      overtimeHours?: number;
    };

    const periodStart = item.payroll.periodStart.toISOString().split('T')[0];
    const periodEnd = item.payroll.periodEnd.toISOString().split('T')[0];

    return {
      id: item.id,
      employeeName: `${item.employee.user.firstName ?? ''} ${item.employee.user.lastName ?? ''}`.trim(),
      employeeNumber: item.employee.employeeNumber,
      department: item.employee.department?.name ?? null,
      company: item.payroll.company.name,
      payPeriod: formatPayPeriodMonth(item.payroll.periodStart, item.payroll.periodEnd),
      periodStart,
      periodEnd,
      paidAt:
        item.salaryPayment?.paidAt?.toISOString() ??
        item.payroll.paidAt?.toISOString() ??
        null,
      currency: item.employee.currency ?? 'USD',
      baseSalary: Number(item.baseSalary),
      allowances: Number(item.totalAllowances),
      bonuses: Number(item.totalBonuses),
      overtime: Number(item.overtimePay),
      deductions: Number(item.totalDeductions),
      tax: Number(item.tax),
      loanDeduction: Number(item.loanDeduction),
      latePenalty: Number(item.latePenalty),
      leaveDeduction: Number(item.leaveDeduction),
      netSalary: Number(item.netSalary),
      allowanceItems: breakdown.allowances ?? [],
      deductionItems: breakdown.deductions ?? [],
      lateDays: breakdown.lateDays,
      overtimeHours: breakdown.overtimeHours,
    };
  }

  private async loadPayrollItem(itemId: string) {
    const item = await this.prisma.payrollItem.findUnique({
      where: { id: itemId },
      include: {
        payroll: { include: { company: true } },
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: true,
          },
        },
        salaryPayment: true,
      },
    });
    if (!item) throw new NotFoundException('Salary slip not found');
    return item;
  }

  private isSlipPaid(item: { payroll: { status: PayrollStatus }; salaryPayment?: { status: string } | null }) {
    return (
      item.salaryPayment?.status === 'PAID' || item.payroll.status === PayrollStatus.PAID
    );
  }

  async getSalarySlip(
    itemId: string,
    requester?: { sub: string; role: UserRole; companyId?: string | null },
  ) {
    const item = await this.loadPayrollItem(itemId);

    if (requester?.role === UserRole.EMPLOYEE) {
      const employee = await getEmployeeByUserId(this.prisma, requester.sub);
      if (item.employeeId !== employee.id) {
        throw new ForbiddenException('You can only view your own salary slips');
      }
      if (!this.isSlipPaid(item)) {
        throw new NotFoundException('Salary slip not found');
      }
    } else if (
      requester?.role === UserRole.COMPANY_ADMIN &&
      item.payroll.companyId !== requester.companyId
    ) {
      throw new NotFoundException('Salary slip not found');
    }

    return this.formatSalarySlip(item);
  }

  async createLoan(
    companyId: string,
    dto: { employeeId: string; amount: number; reason?: string; installments: number; interestRate?: number },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const monthlyDeduction = dto.amount / dto.installments;
    const loan = await this.prisma.employeeLoan.create({
      data: {
        employeeId: dto.employeeId,
        amount: dto.amount,
        reason: dto.reason,
        interestRate: dto.interestRate,
        installments: dto.installments,
        monthlyDeduction,
        remainingBalance: dto.amount,
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
    });

    await this.prisma.approvalRequest.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        type: 'LOAN',
        referenceId: loan.id,
        title: `Loan request: $${dto.amount}`,
        status: 'APPROVED',
        metadata: { amount: dto.amount, installments: dto.installments },
      },
    });

    return loan;
  }

  async getCompanyLoans(companyId: string) {
    const employees = await this.prisma.employee.findMany({ where: { companyId }, select: { id: true } });
    return this.prisma.employeeLoan.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) } },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateEmployeeSalary(
    employeeId: string,
    data: {
      baseSalary?: number;
      allowances?: unknown;
      deductions?: unknown;
      bankName?: string;
      accountNumber?: string;
      taxNumber?: string;
    },
    requester?: { role: UserRole; companyId?: string | null },
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (
      requester?.role === UserRole.COMPANY_ADMIN &&
      employee.companyId !== requester.companyId
    ) {
      throw new ForbiddenException('You can only update salaries for employees in your company');
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(data.baseSalary != null && { baseSalary: data.baseSalary }),
        ...(data.bankName !== undefined && {
          bankName: data.bankName ? this.fields.encrypt(data.bankName) : null,
        }),
        ...(data.accountNumber !== undefined && {
          accountNumber: data.accountNumber ? this.fields.encrypt(data.accountNumber) : null,
        }),
        ...(data.taxNumber !== undefined && {
          taxNumber: data.taxNumber ? this.fields.encrypt(data.taxNumber) : null,
        }),
      },
    });

    return this.prisma.salaryStructure.upsert({
      where: { employeeId },
      create: {
        employeeId,
        baseSalary: data.baseSalary ?? Number(employee.baseSalary ?? 5000),
        allowances: (data.allowances as object) ?? [
          { type: 'TRANSPORT', amount: 200 },
          { type: 'MEDICAL', amount: 150 },
        ],
        deductions: (data.deductions as object) ?? [{ type: 'INSURANCE', amount: 100 }],
        currency: employee.currency ?? 'USD',
      },
      update: {
        ...(data.baseSalary != null && { baseSalary: data.baseSalary }),
        ...(data.allowances != null && { allowances: data.allowances as object }),
        ...(data.deductions != null && { deductions: data.deductions as object }),
      },
    });
  }

  async getEmployeeSalary(employeeId: string, requester?: { role: UserRole; companyId?: string | null }) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        salaryStructure: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        department: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (
      requester?.role === UserRole.COMPANY_ADMIN &&
      employee.companyId !== requester.companyId
    ) {
      throw new ForbiddenException('Not authorized');
    }

    const structure = employee.salaryStructure;
    const allowances = (structure?.allowances as { type: string; amount: number }[]) ?? [];
    const deductions = (structure?.deductions as { type: string; amount: number }[]) ?? [];

    const lastPayrollItem = await this.prisma.payrollItem.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        payroll: { select: { periodStart: true, periodEnd: true, status: true, paidAt: true } },
        salaryPayment: { select: { status: true, paidAt: true } },
      },
    });

    return {
      employeeId: employee.id,
      name: `${employee.user.firstName ?? ''} ${employee.user.lastName ?? ''}`.trim(),
      department: employee.department?.name ?? null,
      baseSalary: Number(structure?.baseSalary ?? employee.baseSalary ?? 0),
      payrollType: employee.payrollType,
      paymentFrequency: employee.paymentFrequency,
      currency: employee.currency ?? structure?.currency ?? 'USD',
      bankName: this.fields.decrypt(employee.bankName),
      accountNumber: this.fields.decrypt(employee.accountNumber),
      taxNumber: this.fields.decrypt(employee.taxNumber),
      allowances,
      deductions,
      totalAllowances: allowances.reduce((s, a) => s + (a.amount ?? 0), 0),
      totalDeductions: deductions.reduce((s, d) => s + (d.amount ?? 0), 0),
      lastPayroll: lastPayrollItem
        ? {
            id: lastPayrollItem.id,
            periodStart: lastPayrollItem.payroll.periodStart,
            periodEnd: lastPayrollItem.payroll.periodEnd,
            baseSalary: Number(lastPayrollItem.baseSalary),
            totalAllowances: Number(lastPayrollItem.totalAllowances),
            totalBonuses: Number(lastPayrollItem.totalBonuses),
            overtimePay: Number(lastPayrollItem.overtimePay),
            totalDeductions: Number(lastPayrollItem.totalDeductions),
            tax: Number(lastPayrollItem.tax),
            loanDeduction: Number(lastPayrollItem.loanDeduction),
            latePenalty: Number(lastPayrollItem.latePenalty),
            leaveDeduction: Number(lastPayrollItem.leaveDeduction),
            netSalary: Number(lastPayrollItem.netSalary),
            status: lastPayrollItem.salaryPayment?.status ?? lastPayrollItem.payroll.status,
            paidAt:
              lastPayrollItem.salaryPayment?.paidAt?.toISOString() ??
              lastPayrollItem.payroll.paidAt?.toISOString() ??
              null,
          }
        : null,
    };
  }
}
