import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { LocationService } from '../location/location.service';
import { UpdateEmployeeProfileDto, CreateGoalDto } from './dto/employee.dto';
import {
  UserRole,
} from '@prisma/client';
import { FieldEncryptionService } from '../common/security/field-encryption.service';

export type WellnessSeverity = 'low' | 'moderate' | 'high';

function scoreToSeverity(score: number): WellnessSeverity {
  if (score >= 75) return 'low';
  if (score >= 50) return 'moderate';
  return 'high';
}

function maxSeverity(...levels: (WellnessSeverity | null | undefined)[]): WellnessSeverity {
  const rank = { low: 0, moderate: 1, high: 2 };
  let max = 0;
  for (const level of levels) {
    if (level && rank[level] > max) max = rank[level];
  }
  return max === 2 ? 'high' : max === 1 ? 'moderate' : 'low';
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private locationService: LocationService,
    private fields: FieldEncryptionService,
  ) {}

  async listEmployees(companyId?: string, search?: string) {
    const employees = await this.prisma.employee.findMany({
      where: {
        ...(companyId && { companyId }),
        ...(search && {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        }),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, isActive: true, lastLoginAt: true } },
        department: true,
        company: { select: { id: true, name: true } },
        manager: { include: { user: { select: { firstName: true, lastName: true } } } },
        salaryStructure: { select: { baseSalary: true, allowances: true, deductions: true, currency: true } },
        payrollItems: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            payroll: { select: { periodStart: true, periodEnd: true, status: true, paidAt: true } },
            salaryPayment: { select: { status: true, paidAt: true } },
          },
        },
      },
    });

    // Never serialize bank/tax identifiers or legacy health profile fields in employee lists.
    return employees.map(
      ({
        bankName: _bankName,
        accountNumber: _accountNumber,
        taxNumber: _taxNumber,
        age: _age,
        height: _height,
        weight: _weight,
        bloodGroup: _bloodGroup,
        allergies: _allergies,
        existingConditions: _existingConditions,
        smokingStatus: _smokingStatus,
        alcoholConsumption: _alcoholConsumption,
        exerciseFrequency: _exerciseFrequency,
        ...safe
      }) => safe,
    );
  }

  async getWellnessMonitor(user: { role: UserRole; companyId?: string | null }, companyId?: string) {
    const filterCompanyId =
      user.role === UserRole.SUPER_ADMIN ? companyId : user.companyId ?? undefined;

    if (user.role === UserRole.COMPANY_ADMIN && !filterCompanyId) {
      throw new BadRequestException('Company not found for this admin account');
    }

    const employees = await this.prisma.employee.findMany({
      where: filterCompanyId ? { companyId: filterCompanyId } : {},
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        department: true,
        company: { select: { id: true, name: true } },
        wellnessScores: { orderBy: { date: 'desc' }, take: 1 },
        healthCheckins: { orderBy: { date: 'desc' }, take: 1 },
      },
      orderBy: { user: { lastName: 'asc' } },
    });

    const userIds = employees.map((e) => e.userId);
    const documents = userIds.length
      ? await this.prisma.document.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, analysisSummary: true, fileName: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const reportByUser = new Map<string, { severity: WellnessSeverity; fileName: string }>();
    for (const doc of documents) {
      if (reportByUser.has(doc.userId)) continue;
      if (!doc.analysisSummary) continue;
      const summary = doc.analysisSummary as { overallSeverity?: string } | null;
      const sev = summary?.overallSeverity?.toLowerCase();
      if (sev === 'high' || sev === 'moderate' || sev === 'low') {
        reportByUser.set(doc.userId, { severity: sev, fileName: doc.fileName });
      }
    }

    const rows = employees.map((emp) => {
      const wellnessScore = emp.wellnessScores[0]?.overallScore ?? 0;
      const wellnessSeverity = scoreToSeverity(wellnessScore);
      const report = reportByUser.get(emp.userId);
      const checkin = emp.healthCheckins[0];

      return {
        id: emp.id,
        userId: emp.userId,
        name: `${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim() || emp.user.email,
        email: emp.user.email,
        department: emp.department?.name ?? null,
        company: emp.company?.name ?? null,
        companyId: emp.companyId,
        position: emp.position,
        isActive: emp.user.isActive,
        wellnessScore,
        wellnessSeverity,
        reportSeverity: report?.severity ?? null,
        reportFileName: report?.fileName ?? null,
        overallSeverity: maxSeverity(wellnessSeverity, report?.severity),
        sleepHours: checkin?.sleepHours ?? null,
        stress: checkin?.stress ?? null,
        mood: checkin?.mood ?? null,
        lastCheckin: checkin?.date ?? null,
      };
    });

    rows.sort((a, b) => {
      const rank = { high: 0, moderate: 1, low: 2 };
      return rank[a.overallSeverity] - rank[b.overallSeverity] || a.wellnessScore - b.wellnessScore;
    });

    return {
      companyId: filterCompanyId ?? null,
      total: rows.length,
      highRisk: rows.filter((r) => r.overallSeverity === 'high').length,
      moderateRisk: rows.filter((r) => r.overallSeverity === 'moderate').length,
      lowRisk: rows.filter((r) => r.overallSeverity === 'low').length,
      employees: rows,
    };
  }

  async getEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        department: true,
        manager: { include: { user: { select: { firstName: true, lastName: true } } } },
        goals: { where: { completed: false } },
        achievements: { orderBy: { earnedAt: 'desc' }, take: 5 },
      },
    });

    if (!employee) throw new NotFoundException('Employee profile not found');
    const {
      age: _age,
      height: _height,
      weight: _weight,
      bloodGroup: _bloodGroup,
      allergies: _allergies,
      existingConditions: _existingConditions,
      smokingStatus: _smokingStatus,
      alcoholConsumption: _alcoholConsumption,
      exerciseFrequency: _exerciseFrequency,
      ...safe
    } = employee;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateEmployeeProfileDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    if (dto.firstName || dto.lastName) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.lastName && { lastName: dto.lastName }),
        },
      });
    }

    const updated = await this.prisma.employee.update({
      where: { userId },
      data: {
        departmentId: dto.departmentId,
        position: dto.position,
        managerId: dto.managerId,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        address: dto.address,
        city: dto.city,
        homeCountry: dto.homeCountry,
        onboardingComplete: true,
      },
      include: { user: true, department: true },
    });

    if (dto.address) {
      await this.locationService.geocodeAndUpdateEmployee(
        updated.id,
        dto.address,
        dto.city ?? updated.city,
        dto.homeCountry ?? updated.homeCountry,
      );
    }

    return this.getEmployee(userId);
  }

  async setLocationFromCoordinates(userId: string, latitude: number, longitude: number) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    await this.locationService.updateEmployeeFromCoordinates(employee.id, latitude, longitude);
    return this.getEmployee(userId);
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.goal.create({
      data: {
        employeeId: employee.id,
        title: dto.title,
        description: dto.description,
        targetValue: dto.targetValue,
        unit: dto.unit,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async getGoals(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.goal.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivityTimeline(userId: string, limit = 20) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getEmployeeDetailForAdmin(
    requester: { role: UserRole; companyId?: string | null },
    employeeId: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        department: true,
        company: { select: { id: true, name: true } },
        manager: { include: { user: { select: { firstName: true, lastName: true } } } },
        goals: { orderBy: { createdAt: 'desc' } },
        achievements: { orderBy: { earnedAt: 'desc' }, take: 10 },
        wellnessScores: { orderBy: { date: 'desc' }, take: 14 },
        healthCheckins: { orderBy: { date: 'desc' }, take: 14 },
        healthMetrics: { orderBy: { recordedAt: 'desc' }, take: 20 },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    if (
      requester.role === UserRole.COMPANY_ADMIN &&
      employee.companyId !== requester.companyId
    ) {
      throw new ForbiddenException('You can only view employees in your company');
    }

    employee.bankName = this.fields.decrypt(employee.bankName) ?? null;
    employee.accountNumber = this.maskAccount(this.fields.decrypt(employee.accountNumber));
    employee.taxNumber = this.maskAccount(this.fields.decrypt(employee.taxNumber));
    employee.healthCheckins = employee.healthCheckins.map((checkin) => ({
      ...checkin,
      symptoms: this.fields.decryptMany(checkin.symptoms),
      medicineNotes: this.fields.decrypt(checkin.medicineNotes) ?? null,
      notes: this.fields.decrypt(checkin.notes) ?? null,
    }));
    employee.healthMetrics = employee.healthMetrics.map((metric) => ({
      ...metric,
      notes: this.fields.decrypt(metric.notes) ?? null,
    }));

    const documents = await this.prisma.document.findMany({
      where: { userId: employee.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        type: true,
        createdAt: true,
        analysisSummary: true,
      },
    });

    const insights = await this.prisma.aiInsight.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const [attendances, leaveRequests, payrollItems, salaryStructure] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: employee.id },
        orderBy: { date: 'desc' },
        take: 14,
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        include: { leaveType: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.payrollItem.findMany({
        where: { employeeId: employee.id },
        include: { payroll: true, salaryPayment: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.salaryStructure.findUnique({ where: { employeeId: employee.id } }),
    ]);

    const latestScore = employee.wellnessScores[0];
    const wellnessScore = latestScore?.overallScore ?? 0;
    const wellnessSeverity = scoreToSeverity(wellnessScore);

    let reportSeverity: WellnessSeverity | null = null;
    let latestReport: { fileName: string; analysis: Record<string, unknown> } | null = null;
    for (const doc of documents) {
      if (!doc.analysisSummary) continue;
      const summary = doc.analysisSummary as { overallSeverity?: string };
      const sev = summary?.overallSeverity?.toLowerCase();
      if (sev === 'high' || sev === 'moderate' || sev === 'low') {
        reportSeverity = sev;
        latestReport = { fileName: doc.fileName, analysis: doc.analysisSummary as Record<string, unknown> };
        break;
      }
    }

    const overallSeverity = maxSeverity(wellnessSeverity, reportSeverity);
    const issues = this.buildEmployeeIssues(employee, documents);

    return {
      profile: {
        id: employee.id,
        userId: employee.userId,
        name: `${employee.user.firstName ?? ''} ${employee.user.lastName ?? ''}`.trim() || employee.user.email,
        email: employee.user.email,
        isActive: employee.user.isActive,
        lastLoginAt: employee.user.lastLoginAt,
        company: employee.company,
        department: employee.department?.name ?? null,
        position: employee.position,
        employeeNumber: employee.employeeNumber,
        team: employee.team,
        phoneNumber: employee.phoneNumber,
        joiningDate: employee.joiningDate,
        employmentType: employee.employmentType,
        employmentStatus: employee.employmentStatus,
        baseSalary: employee.baseSalary ? Number(employee.baseSalary) : null,
        currency: employee.currency,
        payrollType: employee.payrollType,
        paymentFrequency: employee.paymentFrequency,
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        taxNumber: employee.taxNumber,
        age: employee.age,
        gender: employee.gender,
        height: employee.height,
        weight: employee.weight,
        bloodGroup: employee.bloodGroup,
        allergies: employee.allergies,
        existingConditions: employee.existingConditions,
        smokingStatus: employee.smokingStatus,
        alcoholConsumption: employee.alcoholConsumption,
        exerciseFrequency: employee.exerciseFrequency,
        emergencyContact: employee.emergencyContact,
        emergencyPhone: employee.emergencyPhone,
        manager: employee.manager
          ? `${employee.manager.user.firstName ?? ''} ${employee.manager.user.lastName ?? ''}`.trim()
          : null,
      },
      summary: {
        wellnessScore,
        wellnessSeverity,
        reportSeverity,
        overallSeverity,
        latestReport,
      },
      issues,
      wellnessScores: employee.wellnessScores,
      checkins: employee.healthCheckins,
      healthMetrics: employee.healthMetrics,
      goals: employee.goals,
      achievements: employee.achievements,
      documents,
      insights,
      hrm: { attendances, leaveRequests, payrollItems, salaryStructure },
    };
  }

  private buildEmployeeIssues(
    employee: {
      existingConditions: string[];
      allergies: string[];
      wellnessScores: { overallScore: number; sleepScore: number | null; stressScore: number | null }[];
      healthCheckins: {
        sleepHours: number | null;
        stress: string | null;
        mood: string | null;
        symptoms: string[];
        painLevel: number | null;
      }[];
    },
    documents: { fileName: string; analysisSummary: unknown }[],
  ) {
    type Issue = { category: string; severity: WellnessSeverity; description: string };
    const issues: Issue[] = [];
    const rank = { low: 0, moderate: 1, high: 2 };

    const latestScore = employee.wellnessScores[0];
    if (latestScore) {
      if (latestScore.overallScore < 50) {
        issues.push({
          category: 'Wellness',
          severity: 'high',
          description: `Low wellness score (${latestScore.overallScore}/100)`,
        });
      } else if (latestScore.overallScore < 75) {
        issues.push({
          category: 'Wellness',
          severity: 'moderate',
          description: `Below-target wellness score (${latestScore.overallScore}/100)`,
        });
      }
      if (latestScore.sleepScore != null && latestScore.sleepScore < 60) {
        issues.push({
          category: 'Sleep',
          severity: 'moderate',
          description: 'Poor sleep score in wellness tracking',
        });
      }
      if (latestScore.stressScore != null && latestScore.stressScore < 60) {
        issues.push({
          category: 'Stress',
          severity: 'moderate',
          description: 'Elevated stress in wellness tracking',
        });
      }
    }

    const checkin = employee.healthCheckins[0];
    if (checkin) {
      if (checkin.sleepHours != null && checkin.sleepHours < 6) {
        issues.push({
          category: 'Sleep',
          severity: checkin.sleepHours < 5 ? 'high' : 'moderate',
          description: `Only ${checkin.sleepHours}h sleep reported on last check-in`,
        });
      }
      if (checkin.stress === 'HIGH' || checkin.stress === 'VERY_HIGH') {
        issues.push({
          category: 'Stress',
          severity: 'high',
          description: `High stress level reported (${checkin.stress.replace(/_/g, ' ').toLowerCase()})`,
        });
      } else if (checkin.stress === 'MODERATE') {
        issues.push({
          category: 'Stress',
          severity: 'moderate',
          description: 'Moderate stress reported on last check-in',
        });
      }
      if (checkin.mood === 'LOW' || checkin.mood === 'VERY_LOW') {
        issues.push({
          category: 'Mood',
          severity: 'moderate',
          description: `Low mood reported (${checkin.mood.replace(/_/g, ' ').toLowerCase()})`,
        });
      }
      if (checkin.symptoms.length > 0) {
        issues.push({
          category: 'Symptoms',
          severity: 'moderate',
          description: `Reported symptoms: ${checkin.symptoms.join(', ')}`,
        });
      }
      if (checkin.painLevel != null && checkin.painLevel >= 7) {
        issues.push({
          category: 'Pain',
          severity: 'high',
          description: `High pain level reported (${checkin.painLevel}/10)`,
        });
      }
    }

    for (const condition of employee.existingConditions) {
      issues.push({
        category: 'Medical history',
        severity: 'moderate',
        description: condition,
      });
    }
    for (const allergy of employee.allergies) {
      issues.push({
        category: 'Allergy',
        severity: 'low',
        description: allergy,
      });
    }

    for (const doc of documents) {
      if (!doc.analysisSummary || typeof doc.analysisSummary !== 'object') continue;
      const analysis = doc.analysisSummary as {
        overallSeverity?: string;
        summary?: string;
        priorityFindings?: { finding: string; severity: string; needsAttention?: boolean }[];
      };
      const sev = analysis.overallSeverity?.toLowerCase();
      if (sev === 'high' || sev === 'moderate') {
        issues.push({
          category: 'Medical report',
          severity: sev,
          description: `${doc.fileName}: ${analysis.summary?.slice(0, 150) ?? 'Abnormal findings'}`,
        });
      }
      for (const finding of analysis.priorityFindings ?? []) {
        if (!finding.finding) continue;
        const fSev = finding.severity?.toLowerCase();
        if (fSev === 'high' || fSev === 'moderate' || finding.needsAttention) {
          issues.push({
            category: 'Lab finding',
            severity: fSev === 'high' ? 'high' : 'moderate',
            description: finding.finding,
          });
        }
      }
    }

    issues.sort((a, b) => rank[b.severity] - rank[a.severity]);
    return issues;
  }

  private maskAccount(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = value.replace(/\s+/g, '');
    if (digits.length <= 4) return '****';
    return `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
  }
}
