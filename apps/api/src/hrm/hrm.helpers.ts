import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export async function getEmployeeByUserId(prisma: PrismaService, userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      department: true,
      company: true,
    },
  });
  if (!employee) throw new NotFoundException('Employee profile not found');
  return employee;
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseTimeOnDate(date: Date, timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
}

export function calcWorkingHours(checkIn: Date, checkOut: Date) {
  return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
}

export async function generateEmployeeNumber(
  prisma: PrismaService,
  companyId: string,
): Promise<string> {
  const count = await prisma.employee.count({ where: { companyId } });
  const prefix = 'EMP';
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}
