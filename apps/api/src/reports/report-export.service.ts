import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

interface ReportData {
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
export class ReportExportService {
  toCsv(data: ReportData): string {
    const lines = [
      'Nura Report',
      `Company: ${data.company ?? 'N/A'}`,
      `Type: ${data.type}`,
      `Generated: ${data.generatedAt}`,
      `Employees: ${data.employeeCount}`,
      `Average Wellness: ${data.averageWellness}/100`,
      '',
      'Department,Average Score,Employee Count',
    ];

    for (const d of data.departmentBreakdown) {
      lines.push(`${d.department},${d.averageScore},${d.count}`);
    }

    if (data.spending?.length) {
      lines.push('', 'Spending', 'Category,Amount,Description,Date');
      for (const e of data.spending) {
        lines.push(
          `${e.category},${e.amount},${e.description ?? ''},${new Date(e.date).toLocaleDateString()}`,
        );
      }
    }

    return lines.join('\n');
  }

  async toPdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).fillColor('#059669').text('Nura Wellness Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).fillColor('#334155');
      doc.text(`Company: ${data.company ?? 'N/A'}`);
      doc.text(`Report Type: ${data.type}`);
      doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
      doc.text(`Total Employees: ${data.employeeCount}`);
      doc.text(`Average Wellness Score: ${data.averageWellness}/100`);
      doc.moveDown();

      doc.fontSize(16).fillColor('#059669').text('Department Breakdown');
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#334155');

      if (data.departmentBreakdown.length === 0) {
        doc.text('No department data available.');
      } else {
        for (const d of data.departmentBreakdown) {
          doc.text(`${d.department}: ${d.averageScore}/100 (${d.count} employees)`);
        }
      }

      if (data.spending?.length) {
        doc.moveDown();
        doc.fontSize(16).fillColor('#059669').text('Spending Summary');
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#334155');
        const total = data.spending.reduce((sum, e) => sum + Number(e.amount), 0);
        doc.text(`Total Spending: $${total.toLocaleString()}`);
        doc.moveDown(0.5);
        for (const e of data.spending.slice(0, 20)) {
          doc.text(
            `${e.category}: $${Number(e.amount).toLocaleString()} — ${new Date(e.date).toLocaleDateString()}`,
          );
        }
      }

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#94a3b8').text('Nura — Wellness guidance only. Not medical advice.', {
        align: 'center',
      });

      doc.end();
    });
  }

  async toExcel(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nura';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    summary.addRows([
      { field: 'Company', value: data.company ?? 'N/A' },
      { field: 'Report Type', value: data.type },
      { field: 'Generated', value: new Date(data.generatedAt).toLocaleString() },
      { field: 'Employees', value: data.employeeCount },
      { field: 'Average Wellness', value: `${data.averageWellness}/100` },
    ]);

    const deptSheet = workbook.addWorksheet('Departments');
    deptSheet.columns = [
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Average Score', key: 'averageScore', width: 15 },
      { header: 'Employee Count', key: 'count', width: 15 },
    ];
    deptSheet.addRows(data.departmentBreakdown);

    if (data.spending?.length) {
      const spendSheet = workbook.addWorksheet('Spending');
      spendSheet.columns = [
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Date', key: 'date', width: 15 },
      ];
      spendSheet.addRows(
        data.spending.map((e) => ({
          category: e.category,
          amount: Number(e.amount),
          description: e.description ?? '',
          date: new Date(e.date).toLocaleDateString(),
        })),
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
