import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { SubscriptionPlan, SubscriptionStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [companies, users, employees, subscriptions] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.user.count(),
      this.prisma.employee.count(),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: true,
        where: { status: 'ACTIVE' },
      }),
    ]);

    const activeCompanies = await this.prisma.company.count({ where: { isActive: true } });

    return {
      totalCompanies: companies,
      activeCompanies,
      totalUsers: users,
      totalEmployees: employees,
      subscriptionsByPlan: subscriptions.map((s) => ({
        plan: s.plan,
        count: s._count,
      })),
    };
  }

  async listCompanies(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { employees: true, users: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { companies, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' } },
        departments: true,
        _count: { select: { employees: true, users: true, expenses: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompanyStatus(companyId: string, isActive: boolean) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { isActive },
    });
  }

  async updateSubscription(
    companyId: string,
    plan: SubscriptionPlan,
    status?: SubscriptionStatus,
  ) {
    const existing = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
    });

    if (existing) {
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: { plan, ...(status && { status }) },
      });
    }

    return this.prisma.subscription.create({
      data: { companyId, plan, status: status ?? 'ACTIVE' },
    });
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          company: { select: { id: true, name: true } },
          employee: { select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot deactivate super admin');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async getActivityLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.activityLog.count(),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
