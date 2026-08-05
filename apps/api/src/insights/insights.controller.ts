import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InsightsService } from './insights.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Insights')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get personal AI insights' })
  getMyInsights(@CurrentUser('sub') userId: string) {
    return this.insightsService.getEmployeeInsights(userId);
  }

  @Get('company')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get company-wide AI insights' })
  getCompanyInsights(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
  ) {
    return this.insightsService.getEmployerInsights(resolveCompanyId(user, companyId));
  }
}
