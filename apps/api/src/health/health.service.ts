import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { HealthCheckinDto, CreateMetricDto } from './dto/health.dto';
import {
  calculateWellnessScores,
  stressLevelToNumber,
  startOfDay,
} from '@pulseai/utils';
import {
  MoodLevel,
  EnergyLevel,
  StressLevel,
  MetricType,
  ActivityType,
} from '@prisma/client';
import { FieldEncryptionService } from '../common/security/field-encryption.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private fields: FieldEncryptionService,
  ) {}

  async submitCheckin(userId: string, dto: HealthCheckinDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const today = startOfDay();

    const existing = await this.prisma.healthCheckin.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });

    const config = await this.prisma.wellnessScoreConfig.findUnique({
      where: { companyId: employee.companyId },
    });

    const scores = calculateWellnessScores(
      {
        sleepHours: dto.sleepHours,
        exerciseMinutes: dto.exerciseMinutes,
        stressLevel: dto.stress ? stressLevelToNumber(dto.stress) : undefined,
        mealsCount: dto.mealsCount,
        waterIntake: dto.waterIntake,
      },
      config
        ? {
            sleepWeight: config.sleepWeight,
            exerciseWeight: config.exerciseWeight,
            stressWeight: config.stressWeight,
            nutritionWeight: config.nutritionWeight,
            hydrationWeight: config.hydrationWeight,
          }
        : undefined,
    );

    const checkinData = {
      sleepHours: dto.sleepHours,
      mood: dto.mood as MoodLevel | undefined,
      energy: dto.energy as EnergyLevel | undefined,
      stress: dto.stress as StressLevel | undefined,
      exerciseMinutes: dto.exerciseMinutes,
      waterIntake: dto.waterIntake,
      mealsCount: dto.mealsCount,
      painLevel: dto.painLevel,
      symptoms: this.fields.encryptMany(dto.symptoms ?? []),
      medicineTaken: dto.medicineTaken ?? false,
      medicineNotes: this.fields.encrypt(dto.medicineNotes),
      weight: dto.weight,
      notes: this.fields.encrypt(dto.notes),
      healthScore: scores.overallScore,
    };

    const checkin = await this.prisma.$transaction(async (tx) => {
      const result = existing
        ? await tx.healthCheckin.update({
            where: { id: existing.id },
            data: checkinData,
          })
        : await tx.healthCheckin.create({
            data: {
              employeeId: employee.id,
              date: today,
              ...checkinData,
            },
          });

      await tx.wellnessScore.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        create: {
          employeeId: employee.id,
          date: today,
          overallScore: scores.overallScore,
          sleepScore: scores.sleepScore,
          exerciseScore: scores.exerciseScore,
          stressScore: scores.stressScore,
          nutritionScore: scores.nutritionScore,
          hydrationScore: scores.hydrationScore,
        },
        update: {
          overallScore: scores.overallScore,
          sleepScore: scores.sleepScore,
          exerciseScore: scores.exerciseScore,
          stressScore: scores.stressScore,
          nutritionScore: scores.nutritionScore,
          hydrationScore: scores.hydrationScore,
        },
      });

      if (dto.weight) {
        await tx.healthMetric.create({
          data: {
            employeeId: employee.id,
            type: MetricType.WEIGHT,
            value: dto.weight,
            unit: 'kg',
          },
        });

        await tx.employee.update({
          where: { id: employee.id },
          data: { weight: dto.weight },
        });
      }

      await tx.activityLog.create({
        data: {
          userId,
          type: ActivityType.CHECK_IN,
          title: existing ? 'Daily check-in updated' : 'Daily check-in completed',
          description: `Wellness score: ${scores.overallScore}/100`,
          metadata: { score: scores.overallScore, updated: !!existing },
        },
      });

      return result;
    });

    return { checkin: this.decryptCheckin(checkin), scores, updated: !!existing };
  }

  async getTodayCheckin(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const checkin = await this.prisma.healthCheckin.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: startOfDay() } },
    });
    return checkin ? this.decryptCheckin(checkin) : null;
  }

  async getCheckinHistory(userId: string, days = 30) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const checkins = await this.prisma.healthCheckin.findMany({
      where: { employeeId: employee.id, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
    return checkins.map((checkin) => this.decryptCheckin(checkin));
  }

  async createMetric(userId: string, dto: CreateMetricDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const metric = await this.prisma.healthMetric.create({
      data: {
        employeeId: employee.id,
        type: dto.type as MetricType,
        value: dto.value,
        unit: dto.unit,
        notes: this.fields.encrypt(dto.notes),
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        type: ActivityType.WEIGHT_UPDATE,
        title: `${dto.type} recorded`,
        description: `${dto.value} ${dto.unit ?? ''}`,
      },
    });

    return this.decryptMetric(metric);
  }

  async getMetrics(userId: string, type?: string, period = 'weekly') {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const since = new Date();
    const periodDays: Record<string, number> = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    };
    since.setDate(since.getDate() - (periodDays[period] ?? 7));

    const metrics = await this.prisma.healthMetric.findMany({
      where: {
        employeeId: employee.id,
        ...(type && { type: type as MetricType }),
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });
    return metrics.map((metric) => this.decryptMetric(metric));
  }

  async getWellnessScore(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const today = startOfDay();
    const score = await this.prisma.wellnessScore.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });

    if (score) return score;

    const latest = await this.prisma.wellnessScore.findFirst({
      where: { employeeId: employee.id },
      orderBy: { date: 'desc' },
    });

    return latest ?? { overallScore: 0, sleepScore: 0, exerciseScore: 0, stressScore: 0, nutritionScore: 0, hydrationScore: 0 };
  }

  private decryptCheckin<T extends { symptoms: string[]; medicineNotes: string | null; notes: string | null }>(
    checkin: T,
  ): T {
    return {
      ...checkin,
      symptoms: this.fields.decryptMany(checkin.symptoms),
      medicineNotes: this.fields.decrypt(checkin.medicineNotes) ?? null,
      notes: this.fields.decrypt(checkin.notes) ?? null,
    };
  }

  private decryptMetric<T extends { notes: string | null }>(metric: T): T {
    return {
      ...metric,
      notes: this.fields.decrypt(metric.notes) ?? null,
    };
  }
}
