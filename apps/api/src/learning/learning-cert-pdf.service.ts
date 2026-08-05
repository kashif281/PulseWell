import { Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class LearningCertPdfService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async generateForEmployeeCert(employeeCertId: string): Promise<{ pdfUrl: string }> {
    const record = await this.prisma.employeeCertification.findUnique({
      where: { id: employeeCertId },
      include: {
        certification: true,
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            company: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Certificate not found');

    const buffer = await this.render({
      companyName: record.employee.company.name,
      employeeName: `${record.employee.user.firstName ?? ''} ${record.employee.user.lastName ?? ''}`.trim(),
      title: record.certification.title,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
    });

    const stored = await this.storage.upload(
      buffer,
      `certificate-${record.id}.pdf`,
      'application/pdf',
      `learning-certificates/${record.employee.companyId}`,
    );

    await this.prisma.employeeCertification.update({
      where: { id: record.id },
      data: { certificateUrl: stored.url },
    });

    return { pdfUrl: stored.url };
  }

  private render(input: {
    companyName: string;
    employeeName: string;
    title: string;
    issuedAt: Date;
    expiresAt: Date | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).fillColor('#6366f1').text(input.companyName, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(32).fillColor('#0f172a').text('Certificate of Completion', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).fillColor('#64748b').text('This certifies that', { align: 'center' });
      doc.moveDown();
      doc.fontSize(26).fillColor('#059669').text(input.employeeName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).fillColor('#64748b').text('has successfully completed', { align: 'center' });
      doc.moveDown();
      doc.fontSize(22).fillColor('#0f172a').text(input.title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(11).fillColor('#64748b');
      doc.text(`Issued: ${input.issuedAt.toLocaleDateString()}`, { align: 'center' });
      if (input.expiresAt) {
        doc.text(`Valid until: ${input.expiresAt.toLocaleDateString()}`, { align: 'center' });
      }
      doc.moveDown(3);
      doc.fontSize(10).fillColor('#94a3b8').text('Nura Learning Platform', { align: 'center' });
      doc.end();
    });
  }
}
