import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { ReportExportService } from './report-export.service';
import { StorageService } from '../storage/storage.service';
import { ReportType, ReportFormat } from '@prisma/client';
import { API_PREFIX } from '@pulseai/config';

export interface ReportData {
  company?: string;
  generatedAt: string;
  type: string;
  employeeCount: number;
  averageWellness: number;
  departmentBreakdown: Array<{
    department: string;
    averageScore: number;
    count: number;
  }>;
  spending?: Array<{
    category: string;
    amount: unknown;
    description?: string | null;
    date: Date | string;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private exportService: ReportExportService,
    private storage: StorageService,
  ) {}

  async generateReport(
    companyId: string,
    userId: string,
    type: ReportType,
    format: ReportFormat,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        employees: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: true,
            wellnessScores: { orderBy: { date: 'desc' }, take: 1 },
            healthCheckins: { orderBy: { date: 'desc' }, take: 30 },
          },
        },
        expenses: true,
        departments: true,
      },
    });

    const reportData: ReportData = {
      company: company?.name,
      generatedAt: new Date().toISOString(),
      type,
      employeeCount: company?.employees.length ?? 0,
      averageWellness: this.calcAvgWellness(company?.employees ?? []),
      departmentBreakdown: this.departmentReport(company?.employees ?? []),
      spending: company?.expenses ?? [],
    };

    const fileBuffer = await this.generateFile(reportData, format);
    const ext = format === 'PDF' ? 'pdf' : format === 'EXCEL' ? 'xlsx' : 'csv';
    const mimeType =
      format === 'PDF'
        ? 'application/pdf'
        : format === 'EXCEL'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';

    const stored = await this.storage.upload(
      fileBuffer,
      `${type.toLowerCase()}-report.${ext}`,
      mimeType,
      'reports',
    );

    const report = await this.prisma.report.create({
      data: {
        companyId,
        userId,
        type,
        format,
        title: `${type} Report - ${company?.name}`,
        fileUrl: stored.url,
        metadata: reportData as object,
      },
    });

    const downloadUrl =
      stored.storage === 's3'
        ? await this.storage.getDownloadUrl(stored.key, stored.storage)
        : `/${API_PREFIX}/reports/${report.id}/file`;

    return {
      report,
      data: reportData,
      downloadUrl,
      reportId: report.id,
      fileName: `${type.toLowerCase()}-report.${ext}`,
      content:
        format === 'CSV'
          ? this.exportService.toCsv(reportData)
          : undefined,
    };
  }

  async getReportFile(reportId: string, companyId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, companyId },
    });
    if (!report || !report.fileUrl) throw new NotFoundException('Report not found');

    const file = await this.storage.readFile(report.fileUrl);
    const ext =
      report.format === 'PDF' ? 'pdf' : report.format === 'EXCEL' ? 'xlsx' : 'csv';
    const mimeType =
      report.format === 'PDF'
        ? 'application/pdf'
        : report.format === 'EXCEL'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';

    return {
      buffer: file.buffer,
      mimeType: file.mimeType || mimeType,
      fileName: `${report.type.toLowerCase()}-report.${ext}`,
    };
  }

  async getReportDownload(reportId: string, companyId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, companyId },
    });
    if (!report || !report.fileUrl) throw new NotFoundException('Report not found');

    const isS3 = report.fileUrl.startsWith('s3://');
    if (isS3) {
      const key = report.fileUrl.replace(/^s3:\/\/[^/]+\//, '');
      const url = await this.storage.getDownloadUrl(key, 's3');
      return { downloadUrl: url, fileName: report.title };
    }

    return {
      downloadUrl: `/${API_PREFIX}/reports/${report.id}/file`,
      fileName: report.title,
    };
  }

  async listReports(companyId: string) {
    return this.prisma.report.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async generateFile(data: ReportData, format: ReportFormat): Promise<Buffer> {
    switch (format) {
      case 'PDF':
        return this.exportService.toPdf(data);
      case 'EXCEL':
        return this.exportService.toExcel(data);
      case 'CSV':
      default:
        return Buffer.from(this.exportService.toCsv(data), 'utf-8');
    }
  }

  private calcAvgWellness(
    employees: Array<{ wellnessScores: Array<{ overallScore: number }> }>,
  ) {
    const scores = employees
      .map((e) => e.wellnessScores[0]?.overallScore)
      .filter((s): s is number => s !== undefined);
    return scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }

  private departmentReport(
    employees: Array<{
      department?: { name: string } | null;
      wellnessScores: Array<{ overallScore: number }>;
    }>,
  ) {
    const map = new Map<string, number[]>();
    for (const e of employees) {
      const dept = e.department?.name ?? 'Unassigned';
      const score = e.wellnessScores[0]?.overallScore;
      if (score !== undefined) {
        const arr = map.get(dept) ?? [];
        arr.push(score);
        map.set(dept, arr);
      }
    }
    return Array.from(map.entries()).map(([department, scores]) => ({
      department,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      count: scores.length,
    }));
  }
}
