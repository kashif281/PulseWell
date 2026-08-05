import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, title, message },
    });
  }

  async sendCheckinReminder(userId: string, firstName: string) {
    return this.createNotification(
      userId,
      NotificationType.MORNING_CHECKIN,
      'Good morning!',
      `Hi ${firstName}, time for your daily wellness check-in. How are you feeling today?`,
    );
  }

  async sendWaterReminder(userId: string) {
    return this.createNotification(
      userId,
      NotificationType.WATER_REMINDER,
      'Stay Hydrated',
      'Remember to drink water! Aim for 2-3 liters today.',
    );
  }
}
