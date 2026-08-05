import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssetIssueStatus, AssetStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { AssetsService } from './assets.service';
import {
  AssignAssetDto,
  CreateAssetDto,
  ReportAssetIssueDto,
  ResolveIssueDto,
  ReturnAssetDto,
  UpdateAssetDto,
} from './dto/asset.dto';

@ApiTags('Assets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private assets: AssetsService) {}

  @Get('me')
  @ApiOperation({ summary: 'My assigned equipment' })
  myEquipment(@CurrentUser('sub') userId: string) {
    return this.assets.getMyEquipment(userId);
  }

  @Post('me/:assetId/report')
  @ApiOperation({ summary: 'Report damage, loss, or request repair' })
  reportIssue(
    @CurrentUser('sub') userId: string,
    @Param('assetId') assetId: string,
    @Body() dto: ReportAssetIssueDto,
  ) {
    return this.assets.reportIssue(userId, assetId, dto);
  }

  @Get('dashboard')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Asset inventory dashboard' })
  dashboard(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.getDashboard(cid);
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List company assets' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('status') status?: AssetStatus,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.listAssets(cid, status);
  }

  @Get('issues')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List asset issue reports' })
  listIssues(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('status') status?: AssetIssueStatus,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.listIssues(cid, status);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create asset' })
  create(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: CreateAssetDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.createAsset(cid, dto, user.sub);
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Asset detail with history' })
  getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.getAsset(cid, id);
  }

  @Put(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update asset' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: UpdateAssetDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.updateAsset(cid, id, dto, user.sub);
  }

  @Post(':id/assign')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign asset to employee' })
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: AssignAssetDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.assignAsset(cid, id, dto, user.sub);
  }

  @Post(':id/return')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record asset return' })
  returnAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: ReturnAssetDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.returnAsset(cid, id, dto, user.sub);
  }

  @Post(':id/retire')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retire asset (soft archive)' })
  retire(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId: string | undefined,
    @Body() body?: { reason?: string },
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.retireAsset(cid, id, user.sub, body?.reason);
  }

  @Put('issues/:issueId/resolve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resolve employee asset issue' })
  resolveIssue(
    @CurrentUser() user: JwtPayload,
    @Param('issueId') issueId: string,
    @Query('companyId') companyId: string | undefined,
    @Body() dto: ResolveIssueDto,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.assets.resolveIssue(cid, issueId, dto, user.sub);
  }
}
