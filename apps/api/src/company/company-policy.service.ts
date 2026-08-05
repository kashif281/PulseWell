import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { CreateCompanyPolicyDto, UpdateCompanyPolicyDto } from './dto/company-policy.dto';

@Injectable()
export class CompanyPolicyService {
  constructor(private prisma: PrismaService) {}

  listPolicies(companyId: string, activeOnly = false) {
    return this.prisma.companyPolicy.findMany({
      where: {
        companyId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async getPolicy(companyId: string, id: string) {
    const policy = await this.prisma.companyPolicy.findFirst({
      where: { id, companyId },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  createPolicy(companyId: string, dto: CreateCompanyPolicyDto) {
    return this.prisma.companyPolicy.create({
      data: {
        companyId,
        title: dto.title,
        category: dto.category,
        content: dto.content,
        version: dto.version ?? '1.0',
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePolicy(companyId: string, id: string, dto: UpdateCompanyPolicyDto) {
    await this.getPolicy(companyId, id);
    return this.prisma.companyPolicy.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        content: dto.content,
        version: dto.version,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deletePolicy(companyId: string, id: string) {
    await this.getPolicy(companyId, id);
    await this.prisma.companyPolicy.delete({ where: { id } });
    return { deleted: true };
  }
}
