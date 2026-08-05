import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import type { HrPolicyDraft } from './ai-agent.types';

interface PolicyPdfInput {
  companyName: string;
  logoUrl?: string | null;
  title: string;
  content: string;
  version: string;
  effectiveDate?: Date | null;
}

@Injectable()
export class HrPolicyPdfService {
  private readonly logger = new Logger(HrPolicyPdfService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async generateForPolicy(companyId: string, policyId: string): Promise<{ pdfUrl: string }> {
    const policy = await this.prisma.companyPolicy.findFirst({
      where: { id: policyId, companyId },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const buffer = await this.renderPdf({
      companyName: company.name,
      logoUrl: company.logoUrl,
      title: policy.title,
      content: policy.content,
      version: policy.version,
      effectiveDate: policy.effectiveDate,
    });

    const stored = await this.storage.upload(
      buffer,
      `${policy.title.replace(/[^a-zA-Z0-9._-]/g, '_')}-v${policy.version}.pdf`,
      'application/pdf',
      `company-policies/${companyId}`,
    );

    await this.prisma.companyPolicy.update({
      where: { id: policy.id },
      data: { pdfUrl: stored.url },
    });

    return { pdfUrl: stored.url };
  }

  async generateFromDraft(companyId: string, draft: HrPolicyDraft): Promise<Buffer> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    return this.renderPdf({
      companyName: company.name,
      logoUrl: company.logoUrl,
      title: draft.title,
      content: draft.content,
      version: draft.version ?? '1.0',
      effectiveDate: draft.effectiveDate ? new Date(draft.effectiveDate) : new Date(),
    });
  }

  private async renderPdf(input: PolicyPdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, input);
      doc.moveDown();
      doc.fontSize(20).fillColor('#0f172a').text(input.title, { align: 'center' });
      doc.moveDown(0.5);

      if (input.effectiveDate) {
        doc
          .fontSize(10)
          .fillColor('#64748b')
          .text(`Effective date: ${input.effectiveDate.toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();
      }

      doc.fontSize(11).fillColor('#334155');
      const paragraphs = input.content.split(/\n\n+/);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed) {
          doc.text(trimmed, { align: 'left', lineGap: 4 });
          doc.moveDown(0.5);
        }
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const pageNum = i - range.start + 1;
        const bottom = doc.page.height - 40;
        doc.fontSize(9).fillColor('#64748b');
        doc.text(
          `${input.companyName}  |  Version ${input.version}  |  Page ${pageNum} of ${range.count}`,
          50,
          bottom,
          { align: 'center', width: doc.page.width - 100, lineBreak: false },
        );
      }

      doc.end();
    });
  }

  private drawHeader(doc: InstanceType<typeof PDFDocument>, input: PolicyPdfInput) {
    const logoBuffer = this.tryLoadLogo(input.logoUrl);
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 40, { width: 48, height: 48 });
        doc.fontSize(14).fillColor('#059669').text(input.companyName, 110, 52);
      } catch (error) {
        this.logger.warn(`Could not embed logo: ${error}`);
        doc.fontSize(16).fillColor('#059669').text(input.companyName, { align: 'left' });
      }
    } else {
      doc.fontSize(16).fillColor('#059669').text(input.companyName, { align: 'left' });
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown();
  }

  private tryLoadLogo(logoUrl?: string | null): Buffer | null {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return null;
    }
    const localPath = logoUrl.startsWith('/uploads/')
      ? path.join(process.cwd(), logoUrl.replace(/^\//, ''))
      : logoUrl.startsWith('uploads/')
        ? path.join(process.cwd(), logoUrl)
        : logoUrl;
    try {
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    } catch {
      return null;
    }
    return null;
  }
}
