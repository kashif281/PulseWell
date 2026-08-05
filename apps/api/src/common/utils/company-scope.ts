import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@pulseai/types';

export function resolveCompanyId(user: JwtPayload, queryCompanyId?: string): string {
  if (user.role === UserRole.SUPER_ADMIN) {
    if (!queryCompanyId) {
      throw new BadRequestException('companyId query parameter is required');
    }
    return queryCompanyId;
  }

  if (!user.companyId) {
    throw new BadRequestException('Company not found for this account');
  }

  return user.companyId;
}
