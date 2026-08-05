import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, EmploymentType, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from '../email/email.service';
import { LocationService } from '../location/location.service';
import { generateEmployeeNumber } from '../hrm/hrm.helpers';
import {
  AcceptInvitationDto,
  BulkImportRowDto,
  CreateEmployeeDto,
} from './dto/invitation.dto';

const INVITATION_DAYS = 7;

export type InvitationRow = {
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  position: string | null;
  status: EmploymentStatus;
  invitedAt: Date | null;
  lastEmailAt: Date | null;
  expiresAt: Date | null;
  acceptedAt: Date | null;
};

@Injectable()
export class EmployeeInvitationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private locationService: LocationService,
  ) {}

  private newToken() {
    return randomBytes(32).toString('hex');
  }

  private expiresAt() {
    return new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
  }

  async expireStaleInvitations(companyId?: string) {
    const now = new Date();
    await this.prisma.employee.updateMany({
      where: {
        ...(companyId && { companyId }),
        employmentStatus: { in: [EmploymentStatus.INVITATION_SENT, EmploymentStatus.INVITATION_PENDING] },
        invitationExpiresAt: { lt: now },
      },
      data: { employmentStatus: EmploymentStatus.INVITATION_EXPIRED },
    });
  }

  private async assertCompanyCapacity(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: 'ACTIVE' },
    });
    const employeeCount = await this.prisma.employee.count({ where: { companyId } });
    if (subscription?.plan === 'FREE' && employeeCount >= 10) {
      throw new ForbiddenException('Free plan limit reached (10 employees). Upgrade to Pro.');
    }
  }

  async createEmployee(companyId: string, dto: CreateEmployeeDto) {
    await this.assertCompanyCapacity(companyId);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, companyId },
      });
      if (!manager) throw new BadRequestException('Invalid reporting manager');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId },
      });
      if (!dept) throw new BadRequestException('Invalid department');
    }

    const token = this.newToken();
    const invitationExpiresAt = this.expiresAt();
    const employeeNumber = await generateEmployeeNumber(this.prisma, companyId);
    const sendNow = dto.sendInvitation !== false;

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: UserRole.EMPLOYEE,
        companyId,
        passwordHash: null,
        emailVerified: false,
        isActive: false,
        employee: {
          create: {
            companyId,
            departmentId: dto.departmentId,
            managerId: dto.managerId,
            position: dto.position,
            employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
            joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
            employeeNumber,
            employmentStatus: sendNow
              ? EmploymentStatus.INVITATION_SENT
              : EmploymentStatus.INVITATION_PENDING,
            onboardingComplete: false,
            invitationToken: token,
            invitationExpiresAt,
            invitationSentAt: sendNow ? new Date() : null,
            lastInvitationEmailAt: sendNow ? new Date() : null,
          },
        },
      },
      include: {
        employee: { include: { department: true } },
      },
    });

    if (sendNow) {
      await this.email.sendInvitationActivation(
        email,
        dto.firstName.trim(),
        company?.name ?? 'your company',
        token,
      );
    }

    const created = await this.prisma.employee.findUnique({
      where: { id: user.employee!.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        department: true,
      },
    });

    return this.formatInvitation(created!);
  }

  async resendInvitation(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { user: true, company: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (
      employee.employmentStatus === EmploymentStatus.ACTIVE ||
      employee.employmentStatus === EmploymentStatus.RESIGNED ||
      employee.employmentStatus === EmploymentStatus.TERMINATED
    ) {
      throw new BadRequestException('This employee has already activated their account');
    }

    const token = this.newToken();
    const invitationExpiresAt = this.expiresAt();
    const now = new Date();

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        invitationToken: token,
        invitationExpiresAt,
        invitationSentAt: employee.invitationSentAt ?? now,
        lastInvitationEmailAt: now,
        employmentStatus: EmploymentStatus.INVITATION_SENT,
      },
      include: { user: true, department: true },
    });

    await this.email.sendInvitationActivation(
      updated.user.email,
      updated.user.firstName ?? 'there',
      employee.company.name,
      token,
    );

    return this.formatInvitation(updated);
  }

  async listInvitations(companyId: string): Promise<InvitationRow[]> {
    await this.expireStaleInvitations(companyId);

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: {
          in: [
            EmploymentStatus.INVITATION_PENDING,
            EmploymentStatus.INVITATION_SENT,
            EmploymentStatus.INVITATION_EXPIRED,
            EmploymentStatus.ACTIVE,
            EmploymentStatus.INACTIVE,
            EmploymentStatus.SUSPENDED,
            EmploymentStatus.PROBATION,
          ],
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return employees.map((e) => this.formatInvitation(e));
  }

  private formatInvitation(
    e: {
      id: string;
      position: string | null;
      employmentStatus: EmploymentStatus | null;
      invitationSentAt: Date | null;
      lastInvitationEmailAt: Date | null;
      invitationExpiresAt: Date | null;
      invitationAcceptedAt: Date | null;
      createdAt: Date;
      department: { name: string } | null;
      user: { firstName: string | null; lastName: string | null; email: string };
    },
  ): InvitationRow {
    const name = `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim() || e.user.email;
    let status = e.employmentStatus ?? EmploymentStatus.INVITATION_PENDING;
    if (
      status === EmploymentStatus.INVITATION_SENT &&
      e.invitationExpiresAt &&
      e.invitationExpiresAt < new Date() &&
      !e.invitationAcceptedAt
    ) {
      status = EmploymentStatus.INVITATION_EXPIRED;
    }

    return {
      employeeId: e.id,
      name,
      email: e.user.email,
      department: e.department?.name ?? null,
      position: e.position,
      status,
      invitedAt: e.invitationSentAt ?? e.createdAt,
      lastEmailAt: e.lastInvitationEmailAt,
      expiresAt: e.invitationExpiresAt,
      acceptedAt: e.invitationAcceptedAt,
    };
  }

  parseCsv(csv: string) {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
    const col = (names: string[]) => {
      for (const n of names) {
        const i = headers.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };

    const firstNameIdx = col(['first name', 'firstname', 'first_name']);
    const lastNameIdx = col(['last name', 'lastname', 'last_name']);
    const emailIdx = col(['email', 'email address', 'email_address']);
    const deptIdx = col(['department', 'dept']);
    const positionIdx = col(['designation', 'position', 'title']);
    const typeIdx = col(['employment type', 'employment_type', 'type']);
    const joinIdx = col(['joining date', 'joining_date', 'start date', 'start_date']);

    if (firstNameIdx < 0 || lastNameIdx < 0 || emailIdx < 0) {
      throw new BadRequestException('CSV must include First Name, Last Name, and Email columns');
    }

    const rows: { rowNumber: number; data: Record<string, string> }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      rows.push({
        rowNumber: i + 1,
        data: {
          firstName: cells[firstNameIdx] ?? '',
          lastName: cells[lastNameIdx] ?? '',
          email: cells[emailIdx] ?? '',
          department: deptIdx >= 0 ? cells[deptIdx] ?? '' : '',
          position: positionIdx >= 0 ? cells[positionIdx] ?? '' : '',
          employmentType: typeIdx >= 0 ? cells[typeIdx] ?? '' : '',
          joiningDate: joinIdx >= 0 ? cells[joinIdx] ?? '' : '',
        },
      });
    }
    return rows;
  }

  private mapEmploymentType(value: string): EmploymentType | undefined {
    const v = value.trim().toUpperCase().replace(/\s+/g, '_');
    const map: Record<string, EmploymentType> = {
      FULL_TIME: EmploymentType.FULL_TIME,
      'FULL-TIME': EmploymentType.FULL_TIME,
      PART_TIME: EmploymentType.PART_TIME,
      'PART-TIME': EmploymentType.PART_TIME,
      CONTRACT: EmploymentType.CONTRACT,
      INTERNSHIP: EmploymentType.INTERNSHIP,
    };
    return map[v];
  }

  async previewBulkImport(companyId: string, csv: string) {
    const parsed = this.parseCsv(csv);
    const departments = await this.prisma.department.findMany({ where: { companyId } });
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

    const valid: (BulkImportRowDto & { rowNumber: number })[] = [];
    const invalid: { rowNumber: number; email?: string; errors: string[] }[] = [];
    const seenEmails = new Set<string>();

    for (const { rowNumber, data } of parsed) {
      const errors: string[] = [];
      const email = data.email.trim().toLowerCase();

      if (!data.firstName.trim()) errors.push('First name is required');
      if (!data.lastName.trim()) errors.push('Last name is required');
      if (!email) errors.push('Email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
      else if (seenEmails.has(email)) errors.push('Duplicate email in file');
      else {
        seenEmails.add(email);
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists) errors.push('Email already registered in the system');
      }

      let departmentId: string | undefined;
      if (data.department.trim()) {
        departmentId = deptByName.get(data.department.trim().toLowerCase());
        if (!departmentId) errors.push(`Unknown department: ${data.department}`);
      }

      let employmentType: EmploymentType | undefined;
      if (data.employmentType.trim()) {
        employmentType = this.mapEmploymentType(data.employmentType);
        if (!employmentType) errors.push(`Invalid employment type: ${data.employmentType}`);
      }

      if (errors.length) {
        invalid.push({ rowNumber, email, errors });
        continue;
      }

      valid.push({
        rowNumber,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        departmentId,
        position: data.position.trim() || undefined,
        employmentType,
        joiningDate: data.joiningDate.trim() || undefined,
        sendInvitation: true,
      });
    }

    return {
      totalRows: parsed.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      valid,
      invalid,
    };
  }

  async commitBulkImport(
    companyId: string,
    employees: BulkImportRowDto[],
    sendInvitations = true,
  ) {
    const created: InvitationRow[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const row of employees) {
      try {
        const result = await this.createEmployee(companyId, {
          ...row,
          sendInvitation: sendInvitations,
        });
        created.push(result);
      } catch (err) {
        failed.push({
          email: row.email,
          error: err instanceof Error ? err.message : 'Failed to create employee',
        });
      }
    }

    return { createdCount: created.length, failedCount: failed.length, created, failed };
  }

  async validateInvitationToken(token: string) {
    await this.expireStaleInvitations();

    const employee = await this.prisma.employee.findUnique({
      where: { invitationToken: token },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        company: { select: { name: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Invalid or expired invitation link');
    }

    if (employee.employmentStatus === EmploymentStatus.INVITATION_EXPIRED) {
      throw new BadRequestException('This invitation has expired. Please ask HR to resend it.');
    }

    if (
      employee.invitationExpiresAt &&
      employee.invitationExpiresAt < new Date() &&
      employee.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { employmentStatus: EmploymentStatus.INVITATION_EXPIRED },
      });
      throw new BadRequestException('This invitation has expired. Please ask HR to resend it.');
    }

    if (employee.employmentStatus === EmploymentStatus.ACTIVE && employee.onboardingComplete) {
      throw new BadRequestException('This invitation has already been accepted');
    }

    return {
      email: employee.user.email,
      firstName: employee.user.firstName,
      lastName: employee.user.lastName,
      companyName: employee.company.name,
      expiresAt: employee.invitationExpiresAt,
    };
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    if (!dto.acceptTerms || !dto.acceptPrivacy) {
      throw new BadRequestException('You must accept the Terms of Service and Privacy Policy');
    }

    await this.validateInvitationToken(token);

    const employee = await this.prisma.employee.findUnique({
      where: { invitationToken: token },
      include: { user: true },
    });
    if (!employee) throw new NotFoundException('Invalid invitation');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();

    await this.prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        phoneNumber: dto.phoneNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        emergencyContact: dto.emergencyContact,
        emergencyPhone: dto.emergencyPhone,
        employmentStatus: EmploymentStatus.ACTIVE,
        onboardingComplete: true,
        invitationAcceptedAt: now,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        invitationToken: null,
        invitationExpiresAt: null,
      },
    });

    if (dto.avatarUrl) {
      await this.prisma.user.update({
        where: { id: employee.userId },
        data: { avatarUrl: dto.avatarUrl },
      });
    }

    if (dto.address) {
      await this.locationService.geocodeAndUpdateEmployee(employee.id, dto.address);
    }

    return {
      userId: employee.userId,
      email: employee.user.email,
      message: 'Account activated successfully',
    };
  }
}
