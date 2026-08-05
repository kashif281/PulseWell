import { Controller, Get, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole, ReportType, ReportFormat } from '@prisma/client';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('generate')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate a wellness report (CSV, Excel, PDF)' })
  generate(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser('sub') userId: string,
    @Body() body: { type: ReportType; format: ReportFormat },
  ) {
    return this.reportsService.generateReport(
      resolveCompanyId(user, companyId),
      userId,
      body.type,
      body.format,
    );
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List generated reports' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
  ) {
    return this.reportsService.listReports(resolveCompanyId(user, companyId));
  }

  @Get(':id/file')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Download generated report file' })
  async downloadFile(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Param('id') reportId: string,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.getReportFile(
      reportId,
      resolveCompanyId(user, companyId),
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.send(file.buffer);
  }

  @Get(':id/download')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get report download URL' })
  download(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId: string | undefined,
    @Param('id') reportId: string,
  ) {
    return this.reportsService.getReportDownload(reportId, resolveCompanyId(user, companyId));
  }
}
