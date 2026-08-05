import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFile {
  key: string;
  url: string;
  storage: 's3' | 'local';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private bucket: string;
  private useS3: boolean;
  private localDir: string;

  constructor(private config: ConfigService) {
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') || 'pulseai-documents';
    this.useS3 = !!(accessKey && secretKey);

    if (this.useS3) {
      this.s3 = new S3Client({
        region: this.config.get<string>('AWS_REGION') || 'us-east-1',
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      });
      this.logger.log('Using AWS S3 for document storage');
    } else {
      this.localDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
      this.logger.log('Using local filesystem for document storage');
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'documents',
  ): Promise<StoredFile> {
    const key = `${folder}/${uuidv4()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (this.useS3 && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ServerSideEncryption: 'AES256',
        }),
      );
      return { key, url: `s3://${this.bucket}/${key}`, storage: 's3' };
    }

    const filePath = path.join(this.localDir, path.basename(key));
    fs.writeFileSync(filePath, buffer);
    return { key: path.basename(key), url: `/uploads/${path.basename(key)}`, storage: 'local' };
  }

  async delete(storedKey: string, storage: 's3' | 'local'): Promise<void> {
    if (storage === 's3' && this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storedKey }));
      return;
    }
    const filePath = path.join(this.localDir, path.basename(storedKey));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async getDownloadUrl(storedKey: string, storage: 's3' | 'local'): Promise<string> {
    if (storage === 's3' && this.s3) {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: storedKey }),
        { expiresIn: 3600 },
      );
    }
    return `/uploads/${path.basename(storedKey)}`;
  }

  get isS3Enabled(): boolean {
    return this.useS3;
  }

  async readFile(
    fileUrl: string,
    mimeType?: string | null,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    if (fileUrl.startsWith('s3://') && this.s3) {
      const key = fileUrl.replace(/^s3:\/\/[^/]+\//, '');
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error('Empty file from S3');
      return {
        buffer: Buffer.from(bytes),
        mimeType: mimeType || response.ContentType || 'application/octet-stream',
      };
    }

    const fileName = path.basename(fileUrl.replace('/uploads/', ''));
    const filePath = path.join(this.localDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${fileName}`);
    }
    return {
      buffer: fs.readFileSync(filePath),
      mimeType: mimeType || 'application/octet-stream',
    };
  }
}
