import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SpendingService } from './spending.service';
import { CreateExpenseDto } from './dto/spending.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Spending')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('spending')
export class SpendingController {
  constructor(private spendingService: SpendingService) {}

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record healthcare spending' })
  create(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.spendingService.createExpense(resolveCompanyId(user, companyId), dto);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List expenses' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Query('period') period?: string,
  ) {
    return this.spendingService.getExpenses(resolveCompanyId(user, companyId), period);
  }

  @Get('summary')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get spending summary' })
  summary(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
  ) {
    return this.spendingService.getSpendingSummary(resolveCompanyId(user, companyId));
  }
}
