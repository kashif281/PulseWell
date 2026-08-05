import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from '../email/email.service';
import { EmployeeInvitationService } from '../employees/employee-invitation.service';
import { LocationService } from '../location/location.service';
import { CreateCompanyDto, UpdateCompanyDto, CreateDepartmentDto } from './dto/company.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private invitationService: EmployeeInvitationService,
    private locationService: LocationService,
  ) {}

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        departments: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        wellnessConfig: true,
        _count: { select: { employees: true } },
      },
    });

    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    const { officeLatitude, officeLongitude, ...rest } = dto;
    await this.prisma.company.update({
      where: { id: companyId },
      data: rest,
    });

    if (officeLatitude != null && officeLongitude != null) {
      await this.locationService.updateCompanyOfficeFromCoordinates(
        companyId,
        officeLatitude,
        officeLongitude,
      );
    } else if (dto.officeAddress) {
      await this.locationService.geocodeAndUpdateCompanyOffice(
        companyId,
        dto.officeAddress,
        dto.officeCity,
        dto.country,
      );
    }

    return this.getCompany(companyId);
  }

  async createDepartment(companyId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { name: dto.name, companyId },
    });
  }

  async getDepartments(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
    });
  }

  async inviteEmployee(
    companyId: string,
    email: string,
    firstName: string,
    lastName: string,
    departmentId?: string,
  ) {
    return this.invitationService.createEmployee(companyId, {
      email,
      firstName,
      lastName,
      departmentId,
      sendInvitation: true,
    });
  }

  async updateWellnessConfig(
    companyId: string,
    weights: {
      sleepWeight?: number;
      exerciseWeight?: number;
      stressWeight?: number;
      nutritionWeight?: number;
      hydrationWeight?: number;
    },
  ) {
    return this.prisma.wellnessScoreConfig.upsert({
      where: { companyId },
      create: { companyId, ...weights },
      update: weights,
    });
  }
}
