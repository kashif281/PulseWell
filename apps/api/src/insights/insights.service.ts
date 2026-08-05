import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { AiService } from '../chat/ai.service';

@Injectable()
export class InsightsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async getEmployeeInsights(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) return { insights: [], recommendations: [] };

    const insights = await this.aiService.generateInsights(employee.id);
    const recommendations = await this.generateRecommendations(employee.id);

    return { insights, recommendations };
  }

  async getEmployerInsights(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      include: {
        department: true,
        healthCheckins: { orderBy: { date: 'desc' }, take: 7 },
        wellnessScores: { orderBy: { date: 'desc' }, take: 1 },
      },
    });

    const insights: string[] = [];

    const deptStress = new Map<string, number[]>();
    const deptSleep = new Map<string, number[]>();
    const deptBmi: Map<string, number[]> = new Map();

    for (const e of employees) {
      const dept = e.department?.name ?? 'Unassigned';
      const checkin = e.healthCheckins[0];
      if (checkin?.stress) {
        const stressMap: Record<string, number> = {
          VERY_LOW: 10, LOW: 30, MODERATE: 50, HIGH: 70, VERY_HIGH: 90,
        };
        const arr = deptStress.get(dept) ?? [];
        arr.push(stressMap[checkin.stress] ?? 50);
        deptStress.set(dept, arr);
      }
      if (checkin?.sleepHours) {
        const arr = deptSleep.get(dept) ?? [];
        arr.push(checkin.sleepHours);
        deptSleep.set(dept, arr);
      }
      if (e.weight && e.height) {
        const bmi = e.weight / Math.pow(e.height / 100, 2);
        const arr = deptBmi.get(dept) ?? [];
        arr.push(bmi);
        deptBmi.set(dept, arr);
      }
    }

    let highestStressDept = '';
    let highestStress = 0;
    for (const [dept, values] of deptStress) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > highestStress) {
        highestStress = avg;
        highestStressDept = dept;
      }
    }
    if (highestStressDept) {
      insights.push(`${highestStressDept} has the highest stress levels.`);
    }

    let lowestSleepDept = '';
    let lowestSleep = 24;
    for (const [dept, values] of deptSleep) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg < lowestSleep) {
        lowestSleep = avg;
        lowestSleepDept = dept;
      }
    }
    if (lowestSleepDept) {
      insights.push(`${lowestSleepDept} sleeps less on average (${lowestSleep.toFixed(1)}h).`);
    }

    let highestBmiDept = '';
    let highestBmi = 0;
    for (const [dept, values] of deptBmi) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > highestBmi) {
        highestBmi = avg;
        highestBmiDept = dept;
      }
    }
    if (highestBmiDept) {
      insights.push(`${highestBmiDept} has the highest average BMI.`);
    }

    const scores = employees
      .map((e) => e.wellnessScores[0]?.overallScore)
      .filter((s): s is number => s !== undefined);
    if (scores.length) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      insights.push(`Overall company wellness score: ${avg}/100.`);
    }

    const stored = await this.prisma.aiInsight.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    for (const row of stored) {
      insights.push(`${row.title}: ${row.content}`);
    }

    return { insights };
  }

  private async generateRecommendations(employeeId: string) {
    const checkin = await this.prisma.healthCheckin.findFirst({
      where: { employeeId },
      orderBy: { date: 'desc' },
    });

    const recommendations: string[] = [];
    if (!checkin) return recommendations;

    const stressMap: Record<string, number> = {
      VERY_LOW: 10, LOW: 30, MODERATE: 50, HIGH: 70, VERY_HIGH: 90,
    };
    const stressVal = checkin.stress ? stressMap[checkin.stress] : 0;
    if (stressVal > 80) recommendations.push('Consider meditation or mindfulness exercises to manage stress.');
    if ((checkin.sleepHours ?? 8) < 6) recommendations.push('Try to get at least 7 hours of sleep tonight.');
    if ((checkin.waterIntake ?? 3) < 1.5) recommendations.push('Increase your water intake — aim for 2-3 liters today.');
    if ((checkin.exerciseMinutes ?? 30) < 15) recommendations.push('A 30-minute walk can boost your energy and mood.');

    return recommendations;
  }
}
