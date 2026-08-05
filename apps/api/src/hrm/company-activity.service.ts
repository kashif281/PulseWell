import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { AttendanceEventsService } from './attendance-events.service';

@Injectable()
export class CompanyActivityService {
  constructor(
    private prisma: PrismaService,
    private events: AttendanceEventsService,
  ) {}

  async log(
    companyId: string,
    employeeId: string | null,
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const activity = await this.prisma.companyActivity.create({
      data: {
        companyId,
        employeeId,
        type,
        message,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            department: true,
          },
        },
      },
    });

    this.events.publish(companyId, {
      type: 'activity',
      companyId,
      payload: activity,
    });

    return activity;
  }

  async getFeed(companyId: string, limit = 30) {
    return this.prisma.companyActivity.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            department: true,
          },
        },
      },
    });
  }
}
