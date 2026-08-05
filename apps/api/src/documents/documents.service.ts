import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, ActivityType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { StorageService } from '../storage/storage.service';
import { API_PREFIX } from '@pulseai/config';
import type { JwtPayload } from '@pulseai/types';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  private authenticatedFilePath(documentId: string): string {
    return `/${API_PREFIX}/documents/${documentId}/file`;
  }

  private resolveDownloadUrl(
    documentId: string,
    downloadUrl: string,
    storage: 's3' | 'local',
  ): string {
    if (storage === 's3' || downloadUrl.startsWith('http')) {
      return downloadUrl;
    }
    const port = this.config.get<string>('API_PORT') || '5002';
    const base = this.config.get<string>('API_PUBLIC_URL') || `http://localhost:${port}`;
    const path = this.authenticatedFilePath(documentId);
    return `${base}${path}`;
  }

  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP');
    }

    const stored = await this.storage.upload(file.buffer, file.originalname, file.mimetype);

    const document = await this.prisma.document.create({
      data: {
        userId,
        type,
        fileName: file.originalname,
        fileUrl: stored.url,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        type: ActivityType.REPORT_UPLOADED,
        title: 'Document uploaded',
        description: file.originalname,
        metadata: { documentId: document.id, type, storage: stored.storage },
      },
    });

    const downloadUrl = this.resolveDownloadUrl(
      document.id,
      await this.storage.getDownloadUrl(stored.key, stored.storage),
      stored.storage,
    );

    return { ...document, downloadUrl };
  }

  async getDocuments(userId: string) {
    const docs = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      docs.map(async (doc) => {
        const isS3 = doc.fileUrl.startsWith('s3://');
        const key = isS3
          ? doc.fileUrl.replace(/^s3:\/\/[^/]+\//, '')
          : doc.fileUrl.replace('/uploads/', '');
        const storage = isS3 ? ('s3' as const) : ('local' as const);
        const downloadUrl = this.resolveDownloadUrl(
          doc.id,
          await this.storage.getDownloadUrl(key, storage),
          storage,
        );
        return { ...doc, fileUrl: undefined, downloadUrl };
      }),
    );
  }

  async getDocumentFile(requester: JwtPayload, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { user: { select: { id: true, companyId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const isOwner = doc.userId === requester.sub;
    const isCompanyAdmin =
      requester.role === UserRole.COMPANY_ADMIN &&
      !!requester.companyId &&
      doc.user.companyId === requester.companyId;
    const isSuperAdmin = requester.role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isCompanyAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Not authorized to access this document');
    }

    const file = await this.storage.readFile(doc.fileUrl, doc.mimeType);
    return {
      buffer: file.buffer,
      mimeType: file.mimeType,
      fileName: doc.fileName,
    };
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const isS3 = doc.fileUrl.startsWith('s3://');
    const key = isS3
      ? doc.fileUrl.replace(/^s3:\/\/[^/]+\//, '')
      : doc.fileUrl.replace('/uploads/', '');

    await this.storage.delete(key, isS3 ? 's3' : 'local');
    return this.prisma.document.delete({ where: { id: documentId } });
  }
}
