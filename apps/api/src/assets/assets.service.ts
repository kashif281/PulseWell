import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AssetAuditAction,
  AssetCondition,
  AssetIssueStatus,
  AssetStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  AssignAssetDto,
  CreateAssetDto,
  ReportAssetIssueDto,
  ResolveIssueDto,
  ReturnAssetDto,
  UpdateAssetDto,
} from './dto/asset.dto';
import type { JwtPayload } from '@pulseai/types';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(companyId: string) {
    const [total, assigned, available, inRepair, lost, retired] = await Promise.all([
      this.prisma.asset.count({ where: { companyId } }),
      this.prisma.asset.count({ where: { companyId, status: AssetStatus.ASSIGNED } }),
      this.prisma.asset.count({ where: { companyId, status: AssetStatus.AVAILABLE } }),
      this.prisma.asset.count({ where: { companyId, status: AssetStatus.IN_REPAIR } }),
      this.prisma.asset.count({ where: { companyId, condition: AssetCondition.LOST } }),
      this.prisma.asset.count({ where: { companyId, status: AssetStatus.RETIRED } }),
    ]);
    return { total, assigned, available, inRepair, lost, retired };
  }

  async listAssets(companyId: string, status?: AssetStatus) {
    return this.prisma.asset.findMany({
      where: { companyId, ...(status && { status }) },
      include: {
        assignments: {
          where: { returnedAt: null },
          take: 1,
          include: {
            employee: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
      orderBy: { assetTag: 'asc' },
    });
  }

  async getAsset(companyId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, companyId },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            employee: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        issueReports: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async createAsset(companyId: string, dto: CreateAssetDto, userId?: string) {
    const asset = await this.prisma.asset.create({
      data: {
        companyId,
        assetTag: dto.assetTag,
        name: dto.name,
        category: dto.category,
        barcode: dto.barcode,
        serialNumber: dto.serialNumber,
        brand: dto.brand,
        model: dto.model,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        purchasePrice: dto.purchasePrice,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
        vendor: dto.vendor,
        condition: dto.condition ?? AssetCondition.NEW,
        notes: dto.notes,
      },
    });

    await this.logAudit(asset.id, userId, AssetAuditAction.CREATED, null, asset);
    return asset;
  }

  async updateAsset(companyId: string, assetId: string, dto: UpdateAssetDto, userId?: string) {
    const existing = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!existing) throw new NotFoundException('Asset not found');

    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        name: dto.name,
        status: dto.status,
        condition: dto.condition,
        serialNumber: dto.serialNumber,
        notes: dto.notes,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
      },
    });

    await this.logAudit(asset.id, userId, AssetAuditAction.STATUS_CHANGED, existing, asset);
    return asset;
  }

  async assignAsset(
    companyId: string,
    assetId: string,
    dto: AssignAssetDto,
    assignedById?: string,
  ) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException('Asset is already assigned');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const assignment = await this.prisma.$transaction(async (tx) => {
      const a = await tx.assetAssignment.create({
        data: {
          assetId,
          employeeId: dto.employeeId,
          expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : undefined,
          conditionAtAssignment: dto.conditionAtAssignment ?? asset.condition,
          notes: dto.notes,
          assignedById,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.ASSIGNED },
      });
      return a;
    });

    await this.logAudit(assetId, assignedById, AssetAuditAction.ASSIGNED, asset, {
      employeeId: dto.employeeId,
      assignmentId: assignment.id,
    });
    return assignment;
  }

  async returnAsset(companyId: string, assetId: string, dto: ReturnAssetDto, userId?: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const open = await this.prisma.assetAssignment.findFirst({
      where: { assetId, returnedAt: null },
    });
    if (!open) throw new BadRequestException('No active assignment');

    const assignment = await this.prisma.$transaction(async (tx) => {
      const a = await tx.assetAssignment.update({
        where: { id: open.id },
        data: {
          returnedAt: new Date(),
          conditionAtReturn: dto.conditionAtReturn ?? open.conditionAtAssignment,
          missingAccessories: dto.missingAccessories,
          damageNotes: dto.damageNotes,
          notes: dto.notes ?? open.notes,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.AVAILABLE },
      });
      return a;
    });

    await this.logAudit(assetId, userId, AssetAuditAction.RETURNED, open, assignment);
    return assignment;
  }

  async getMyEquipment(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.assetAssignment.findMany({
      where: { employeeId: employee.id, returnedAt: null },
      include: {
        asset: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async reportIssue(userId: string, assetId: string, dto: ReportAssetIssueDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { assetId, employeeId: employee.id, returnedAt: null },
      include: { asset: true },
    });
    if (!assignment) throw new ForbiddenException('You do not have this asset assigned');

    const report = await this.prisma.assetIssueReport.create({
      data: {
        assetId,
        employeeId: employee.id,
        type: dto.type,
        description: dto.description,
      },
    });

    if (dto.type === 'LOSS') {
      await this.prisma.asset.update({
        where: { id: assetId },
        data: { condition: AssetCondition.LOST, status: AssetStatus.IN_REPAIR },
      });
      await this.logAudit(assetId, userId, AssetAuditAction.LOST_REPORTED, null, report);
    } else {
      await this.logAudit(assetId, userId, AssetAuditAction.ISSUE_REPORTED, null, report);
    }

    return report;
  }

  async listIssues(companyId: string, status?: AssetIssueStatus) {
    return this.prisma.assetIssueReport.findMany({
      where: {
        asset: { companyId },
        ...(status && { status }),
      },
      include: {
        asset: { select: { assetTag: true, name: true, category: true } },
        employee: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveIssue(
    companyId: string,
    issueId: string,
    dto: ResolveIssueDto,
    userId?: string,
  ) {
    const issue = await this.prisma.assetIssueReport.findFirst({
      where: { id: issueId, asset: { companyId } },
      include: { asset: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const status = dto.approved === false ? AssetIssueStatus.REJECTED : AssetIssueStatus.RESOLVED;
    const updated = await this.prisma.assetIssueReport.update({
      where: { id: issueId },
      data: { status, resolvedAt: new Date(), resolvedBy: userId },
    });

    if (issue.type === 'REPAIR' && status === AssetIssueStatus.RESOLVED) {
      await this.prisma.asset.update({
        where: { id: issue.assetId },
        data: { status: AssetStatus.IN_REPAIR, condition: AssetCondition.UNDER_REPAIR },
      });
      await this.logAudit(issue.assetId, userId, AssetAuditAction.REPAIRED, issue.asset, updated);
    }

    return updated;
  }

  async retireAsset(companyId: string, assetId: string, userId?: string, reason?: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, companyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.RETIRED, condition: AssetCondition.RETIRED },
    });

    await this.logAudit(assetId, userId, AssetAuditAction.ARCHIVED, asset, updated, reason);
    return updated;
  }

  assertCompanyAccess(user: JwtPayload, companyId: string) {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.companyId !== companyId) throw new ForbiddenException('Access denied');
  }

  private async logAudit(
    assetId: string,
    userId: string | undefined,
    action: AssetAuditAction,
    previous: unknown,
    next: unknown,
    reason?: string,
  ) {
    await this.prisma.assetAuditLog.create({
      data: {
        assetId,
        userId,
        action,
        previousValue: previous ? (previous as object) : undefined,
        newValue: next as object,
        reason,
      },
    });
  }
}
