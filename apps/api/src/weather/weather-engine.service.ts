import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationType, WeatherAlertResponse } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { AttendanceService } from '../hrm/attendance.service';
import { WeatherApiService, WeatherSnapshot } from './weather-api.service';
import { WeatherRulesService } from './weather-rules.service';
import { UpdateWeatherSettingsDto } from './dto/weather.dto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

function todayDateOnly(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class WeatherEngineService {
  private readonly logger = new Logger(WeatherEngineService.name);

  constructor(
    private prisma: PrismaService,
    private weatherApi: WeatherApiService,
    private rules: WeatherRulesService,
    private notifications: NotificationsService,
    private attendance: AttendanceService,
    private config: ConfigService,
  ) {}

  async getOrCreateSettings(companyId: string) {
    return this.prisma.weatherSettings.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
  }

  async updateSettings(companyId: string, dto: UpdateWeatherSettingsDto) {
    await this.getOrCreateSettings(companyId);
    return this.prisma.weatherSettings.update({
      where: { companyId },
      data: dto,
    });
  }

  async getMyAlertToday(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.weatherAlert.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: todayDateOnly() },
      },
    });
  }

  async respondToAlert(userId: string, action: 'accept' | 'ignore') {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const alert = await this.prisma.weatherAlert.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: todayDateOnly() },
      },
    });
    if (!alert) throw new NotFoundException('No weather alert for today');
    if (alert.response !== WeatherAlertResponse.ACCEPTED) {
      throw new BadRequestException('WFH must be allowed by HR before you can check in remotely.');
    }

    if (action === 'ignore') {
      return alert;
    }

    try {
      await this.attendance.checkIn(userId, true);
    } catch {
      // already checked in or day ended — acceptable
    }

    return alert;
  }

  async allowWfhForAdmin(companyId: string, alertId: string) {
    const alert = await this.prisma.weatherAlert.findFirst({
      where: { id: alertId, companyId },
      include: { employee: { include: { user: true } } },
    });
    if (!alert) throw new NotFoundException('Weather alert not found');
    if (alert.response === WeatherAlertResponse.ACCEPTED) {
      return { alert, alreadyAllowed: true };
    }

    const updated = await this.prisma.weatherAlert.update({
      where: { id: alert.id },
      data: {
        response: WeatherAlertResponse.ACCEPTED,
        respondedAt: new Date(),
        reason: alert.eligible
          ? alert.reason
          : `${alert.reason} — HR allowed work from home`,
      },
    });

    await this.notifications.createNotification(
      alert.employee.userId,
      NotificationType.WEATHER_ALERT,
      'Work From Home Allowed',
      'HR has allowed you to work from home today. When you are ready, check in remotely from Attendance or your dashboard.',
    );

    return { alert: updated, alreadyAllowed: false };
  }

  async denyWfhForAdmin(companyId: string, alertId: string) {
    const alert = await this.prisma.weatherAlert.findFirst({
      where: { id: alertId, companyId },
      include: { employee: true },
    });
    if (!alert) throw new NotFoundException('Weather alert not found');
    if (alert.response === WeatherAlertResponse.IGNORED) {
      return alert;
    }

    const updated = await this.prisma.weatherAlert.update({
      where: { id: alert.id },
      data: { response: WeatherAlertResponse.IGNORED, respondedAt: new Date() },
    });

    await this.notifications.createNotification(
      alert.employee.userId,
      NotificationType.WEATHER_ALERT,
      'Please Come to Office',
      'HR requires you to come to the office today. Please commute if it is safe to do so.',
    );

    return updated;
  }

  /** @deprecated Use allowWfhForAdmin — kept for route compatibility */
  async approveAlertForAdmin(companyId: string, alertId: string) {
    return this.allowWfhForAdmin(companyId, alertId);
  }

  /** @deprecated Use denyWfhForAdmin */
  async revokeAlertForAdmin(companyId: string, alertId: string) {
    return this.denyWfhForAdmin(companyId, alertId);
  }

  async approveAlertsForAdmin(companyId: string, alertIds?: string[], date = todayDateOnly()) {
    const where = {
      companyId,
      date,
      response: WeatherAlertResponse.PENDING,
      ...(alertIds?.length ? { id: { in: alertIds } } : {}),
    };

    const pending = await this.prisma.weatherAlert.findMany({
      where,
      select: { id: true },
    });

    let allowed = 0;
    for (const row of pending) {
      const result = await this.allowWfhForAdmin(companyId, row.id);
      if (!result.alreadyAllowed) allowed++;
    }

    return { approved: allowed, total: pending.length };
  }

  async getCurrentOfficeWeather(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const settings = await this.getOrCreateSettings(companyId);

    if (!company.officeLatitude || !company.officeLongitude) {
      return {
        available: false,
        reason: 'Office location not configured. Set office address in company settings.',
        office: {
          address: company.officeAddress,
          city: company.officeCity,
          latitude: company.officeLatitude,
          longitude: company.officeLongitude,
        },
        settings: { minDistanceKm: settings.minDistanceKm },
      };
    }

    let snapshot = await this.weatherApi.fetchWeather(
      company.officeLatitude,
      company.officeLongitude,
    );
    let dataSource: 'live' | 'cached' | 'unavailable' = snapshot ? 'live' : 'unavailable';

    if (!snapshot) {
      const latest = await this.prisma.weatherAlert.findFirst({
        where: { companyId, weatherSnapshot: { not: { equals: null } } },
        orderBy: { updatedAt: 'desc' },
      });
      const cached = latest?.weatherSnapshot as WeatherSnapshot | null;
      if (cached) {
        snapshot = { ...cached, fetchedAt: latest?.updatedAt.toISOString() };
        dataSource = 'cached';
      }
    }

    const longCommuteCount = await this.prisma.employee.count({
      where: {
        companyId,
        employmentStatus: 'ACTIVE',
        commuteDistanceKm: { gte: settings.minDistanceKm },
      },
    });

    const withLocationCount = await this.prisma.employee.count({
      where: {
        companyId,
        employmentStatus: 'ACTIVE',
        latitude: { not: null },
        commuteDistanceKm: { not: null },
      },
    });

    return {
      available: !!snapshot,
      dataSource,
      reason: snapshot
        ? dataSource === 'cached'
          ? 'Live API unavailable — showing last seeded/checked weather data'
          : null
        : 'Weather API unavailable — check OPENWEATHER_API_KEY or run a weather check',
      office: {
        address: company.officeAddress,
        city: company.officeCity,
        latitude: company.officeLatitude,
        longitude: company.officeLongitude,
      },
      weather: snapshot,
      stats: {
        employeesWithCommuteData: withLocationCount,
        employeesAboveMinDistance: longCommuteCount,
        minDistanceKm: settings.minDistanceKm,
      },
    };
  }

  async getHrDashboard(companyId: string, date = todayDateOnly()) {
    const currentWeather = await this.getCurrentOfficeWeather(companyId);

    const alerts = await this.prisma.weatherAlert.findMany({
      where: { companyId, date },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const eligibleAlerts = alerts.filter((a) => a.eligible);
    const notEligibleAlerts = alerts.filter((a) => !a.eligible);
    const accepted = alerts.filter((a) => a.response === WeatherAlertResponse.ACCEPTED);
    const ignored = alerts.filter((a) => a.response === WeatherAlertResponse.IGNORED);
    const pending = alerts.filter((a) => a.response === WeatherAlertResponse.PENDING);

    const recommendation = await this.prisma.weatherRecommendation.findUnique({
      where: { companyId_date: { companyId, date } },
    });

    return {
      date,
      currentWeather,
      eligible: eligibleAlerts.length,
      notEligible: notEligibleAlerts.length,
      evaluated: alerts.length,
      accepted: accepted.length,
      ignored: ignored.length,
      pending: pending.length,
      alerts: eligibleAlerts,
      allAlerts: alerts,
      recommendation: recommendation?.content ?? null,
    };
  }

  async runDailyCheckForCompany(companyId: string, date = todayDateOnly()) {
    const settings = await this.getOrCreateSettings(companyId);
    if (!settings.enabled) return { skipped: true, reason: 'disabled' };

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.officeLatitude || !company.officeLongitude) {
      return { skipped: true, reason: 'office location not set' };
    }

    const snapshot = await this.weatherApi.fetchWeather(
      company.officeLatitude,
      company.officeLongitude,
    );
    if (!snapshot) return { skipped: true, reason: 'weather unavailable' };

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: 'ACTIVE',
        latitude: { not: null },
        longitude: { not: null },
      },
      include: { user: true },
    });

    let eligibleCount = 0;
    for (const emp of employees) {
      const evaluation = this.rules.evaluate(settings, snapshot, emp.commuteDistanceKm);
      const existing = await this.prisma.weatherAlert.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date } },
      });

      const alert = await this.prisma.weatherAlert.upsert({
        where: { employeeId_date: { employeeId: emp.id, date } },
        create: {
          companyId,
          employeeId: emp.id,
          date,
          eligible: evaluation.eligible,
          conditions: evaluation.triggeredConditions,
          reason: evaluation.reason,
          distanceKm: emp.commuteDistanceKm,
          temperatureC: snapshot.temperatureC,
          weatherSnapshot: snapshot as object,
        },
        update: {
          eligible: evaluation.eligible,
          conditions: evaluation.triggeredConditions,
          reason: evaluation.reason,
          distanceKm: emp.commuteDistanceKm,
          temperatureC: snapshot.temperatureC,
          weatherSnapshot: snapshot as object,
        },
      });

      if (evaluation.eligible && !existing?.notificationId) {
        const notif = await this.notifications.createNotification(
          emp.userId,
          NotificationType.WEATHER_ALERT,
          'Weather Alert',
          `Today's weather (${evaluation.reason}) and your ${emp.commuteDistanceKm?.toFixed(1) ?? '?'} km commute may qualify you for work from home. HR will confirm whether you should work from home or come to the office.`,
        );
        await this.prisma.weatherAlert.update({
          where: { id: alert.id },
          data: { notificationId: notif.id },
        });
        eligibleCount++;
      } else if (evaluation.eligible) {
        eligibleCount++;
      }
    }

    await this.generateHrRecommendation(companyId, date, snapshot, eligibleCount, employees.length);

    return {
      processed: employees.length,
      eligible: eligibleCount,
      notEligible: employees.length - eligibleCount,
      weather: {
        description: snapshot.description,
        main: snapshot.main,
        temperatureC: snapshot.temperatureC,
        conditions: snapshot.conditions,
      },
    };
  }

  async runDailyCheckAllCompanies() {
    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true, weatherSettings: true },
    });

    const now = new Date();
    const results: Array<{ companyId: string; result: unknown }> = [];

    for (const company of companies) {
      const settings = company.weatherSettings ?? (await this.getOrCreateSettings(company.id));
      const checkHour = settings.checkHour ?? 6;

      const localHour = this.getLocalHour(now, company.timezone);
      if (localHour !== checkHour) continue;

      const date = this.getLocalDateOnly(now, company.timezone);
      const alreadyRan = await this.prisma.weatherRecommendation.findUnique({
        where: { companyId_date: { companyId: company.id, date } },
      });
      if (alreadyRan) continue;

      const result = await this.runDailyCheckForCompany(company.id, date);
      results.push({ companyId: company.id, result });
    }

    return results;
  }

  private getLocalHour(date: Date, timezone: string): number {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(fmt.format(date), 10);
    } catch {
      return date.getUTCHours();
    }
  }

  private getLocalDateOnly(date: Date, timezone: string): Date {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [y, m, d] = fmt.format(date).split('-').map(Number);
      return new Date(y, m - 1, d);
    } catch {
      return todayDateOnly();
    }
  }

  private async generateHrRecommendation(
    companyId: string,
    date: Date,
    snapshot: { description: string; temperatureC: number },
    eligibleCount: number,
    totalEmployees: number,
  ) {
    const longCommute = await this.prisma.employee.count({
      where: { companyId, commuteDistanceKm: { gte: 30 } },
    });

    let content = `Today's weather: ${snapshot.description} (${snapshot.temperatureC}°C). ${eligibleCount} employee(s) are eligible for weather-based WFH. ${longCommute} employees commute more than 30 km.`;

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey && eligibleCount > 0) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash',
        });
        const prompt = `Write a one-sentence HR recommendation for work-from-home policy. Weather: ${snapshot.description}, ${snapshot.temperatureC}°C. ${eligibleCount} of ${totalEmployees} employees eligible. ${longCommute} commute over 30km. Be concise and actionable.`;
        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (text) content = text;
      } catch (err) {
        this.logger.warn(`AI recommendation failed: ${err}`);
      }
    }

    await this.prisma.weatherRecommendation.upsert({
      where: { companyId_date: { companyId, date } },
      create: { companyId, date, content, metadata: { eligibleCount, longCommute } },
      update: { content, metadata: { eligibleCount, longCommute } },
    });
  }
}
