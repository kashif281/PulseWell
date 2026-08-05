import { Controller, Get, Put, Post, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CompanyService } from './company.service';
import { CompanyPolicyService } from './company-policy.service';
import { CreateCompanyDto, UpdateCompanyDto, CreateDepartmentDto } from './dto/company.dto';
import { CreateCompanyPolicyDto, UpdateCompanyPolicyDto } from './dto/company-policy.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Company')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompanyController {
  constructor(
    private companyService: CompanyService,
    private policyService: CompanyPolicyService,
  ) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get company details' })
  getCompany(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.getCompany(cid);
  }

  @Put('settings')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update company settings' })
  updateCompany(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: UpdateCompanyDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.updateCompany(cid, dto);
  }

  @Get('departments')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List departments' })
  getDepartments(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.getDepartments(cid);
  }

  @Post('departments')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create department' })
  createDepartment(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: CreateDepartmentDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.createDepartment(cid, dto);
  }

  @Post('invite')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Invite employee (legacy)' })
  inviteEmployee(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() body: { email: string; firstName: string; lastName: string; departmentId?: string },
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.inviteEmployee(
      cid,
      body.email,
      body.firstName,
      body.lastName,
      body.departmentId,
    );
  }

  @Put('wellness-config')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update wellness score weights' })
  updateWellnessConfig(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body()
    weights: {
      sleepWeight?: number;
      exerciseWeight?: number;
      stressWeight?: number;
      nutritionWeight?: number;
      hydrationWeight?: number;
    },
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.companyService.updateWellnessConfig(cid, weights);
  }

  @Get('policies')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List company policies' })
  listPolicies(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    const onlyActive = user.role === UserRole.EMPLOYEE || activeOnly === 'true';
    return this.policyService.listPolicies(cid, onlyActive);
  }

  @Get('policies/:id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get a company policy' })
  getPolicy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.policyService.getPolicy(resolveCompanyId(user, companyId), id);
  }

  @Post('policies')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create company policy' })
  createPolicy(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: CreateCompanyPolicyDto,
  ) {
    return this.policyService.createPolicy(resolveCompanyId(user, companyId), dto);
  }

  @Put('policies/:id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update company policy' })
  updatePolicy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: UpdateCompanyPolicyDto,
  ) {
    return this.policyService.updatePolicy(resolveCompanyId(user, companyId), id, dto);
  }

  @Delete('policies/:id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete company policy' })
  deletePolicy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.policyService.deletePolicy(resolveCompanyId(user, companyId), id);
  }
}
