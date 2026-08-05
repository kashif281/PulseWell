import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const config = (values: Record<string, string>) =>
    ({
      get: jest.fn((name: string) => values[name]),
    }) as unknown as ConfigService;

  it('encrypts with AES-GCM and decrypts the original value', () => {
    const service = new FieldEncryptionService(config({ DATA_ENCRYPTION_KEY: key }));

    const encrypted = service.encrypt('sensitive-value')!;

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('sensitive-value');
    expect(service.decrypt(encrypted)).toBe('sensitive-value');
  });

  it('keeps legacy plaintext readable during migration', () => {
    const service = new FieldEncryptionService(config({ DATA_ENCRYPTION_KEY: key }));
    expect(service.decrypt('legacy-plaintext')).toBe('legacy-plaintext');
  });

  it('requires an encryption key in production', () => {
    expect(
      () => new FieldEncryptionService(config({ NODE_ENV: 'production' })),
    ).toThrow('DATA_ENCRYPTION_KEY is required in production');
  });
});
