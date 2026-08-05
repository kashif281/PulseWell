import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const configured = config.get<string>('DATA_ENCRYPTION_KEY')?.trim();
    this.key = configured ? this.parseKey(configured) : null;

    if (!this.key && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('DATA_ENCRYPTION_KEY is required in production');
    }
  }

  encrypt(value: string | null | undefined): string | null | undefined {
    if (!value || value.startsWith(PREFIX)) return value;
    // Local development remains usable, but production startup requires a key.
    if (!this.key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
  }

  decrypt(value: string | null | undefined): string | null | undefined {
    if (!value || !value.startsWith(PREFIX)) return value;
    if (!this.key) throw new Error('DATA_ENCRYPTION_KEY is required to decrypt sensitive data');

    const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
    if (payload.length < 29) throw new Error('Invalid encrypted field payload');

    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  encryptMany(values: string[]): string[] {
    return values.map((value) => this.encrypt(value) ?? '');
  }

  decryptMany(values: string[]): string[] {
    return values.map((value) => this.decrypt(value) ?? '');
  }

  private parseKey(value: string): Buffer {
    const key = /^[a-f0-9]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
    if (key.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64 or 64 hex characters');
    }
    return key;
  }
}
