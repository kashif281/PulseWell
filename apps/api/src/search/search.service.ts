import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import type { JwtPayload } from '@pulseai/types';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(user: JwtPayload, query: string) {
    const q = query.trim();
    if (!q || !user.companyId) {
      return { employees: [], departments: [], documents: [], chats: [] };
    }

    const [employees, departments] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          companyId: user.companyId,
          user: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        select: {
          id: true,
          position: true,
          employeeNumber: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          department: { select: { id: true, name: true } },
        },
        take: 10,
      }),
      this.prisma.department.findMany({
        where: { companyId: user.companyId, name: { contains: q, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 10,
      }),
    ]);

    return { employees, departments, documents: [], chats: [] };
  }
}
