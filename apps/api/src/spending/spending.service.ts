import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { CreateExpenseDto } from './dto/spending.dto';
import { ExpenseCategory } from '@prisma/client';

@Injectable()
export class SpendingService {
  constructor(private prisma: PrismaService) {}

  async createExpense(companyId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        companyId,
        category: dto.category as ExpenseCategory,
        amount: dto.amount,
        description: dto.description,
        department: dto.department,
        employeeId: dto.employeeId,
        date: new Date(dto.date),
      },
    });
  }

  async getExpenses(companyId: string, period = 'monthly') {
    const since = new Date();
    const periodDays: Record<string, number> = {
      monthly: 30,
      quarterly: 90,
      annual: 365,
    };
    since.setDate(since.getDate() - (periodDays[period] ?? 30));

    return this.prisma.expense.findMany({
      where: { companyId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
  }

  async getSpendingSummary(companyId: string) {
    const expenses = await this.prisma.expense.findMany({ where: { companyId } });

    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const e of expenses) {
      const amount = Number(e.amount);
      total += amount;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + amount;
    }

    const byDepartment: Record<string, number> = {};
    for (const e of expenses) {
      const dept = e.department ?? 'General';
      byDepartment[dept] = (byDepartment[dept] ?? 0) + Number(e.amount);
    }

    return {
      total,
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount,
      })),
      byDepartment: Object.entries(byDepartment).map(([department, amount]) => ({
        department,
        amount,
      })),
    };
  }
}
