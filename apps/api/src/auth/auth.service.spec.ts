import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from '../email/email.service';
import { EmployeeInvitationService } from '../employees/employee-invitation.service';

const mockPrisma: Record<string, unknown> = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  company: { create: jest.fn() },
  employee: { create: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockPrisma)),
};

const mockJwt = { sign: jest.fn().mockReturnValue('access-token') };
const mockConfig = { get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'secret' : '7d')) };
const mockEmail = { sendPasswordReset: jest.fn() };
const mockInvitationService = { acceptInvitation: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
        { provide: EmployeeInvitationService, useValue: mockInvitationService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should throw on invalid credentials', async () => {
      (mockPrisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should throw if email already exists', async () => {
      (mockPrisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ id: '1' });
      await expect(
        service.register({
          email: 'test@test.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('forgotPassword', () => {
    it('should send reset email when user exists', async () => {
      (mockPrisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        firstName: 'Test',
      });
      (mockPrisma.user as { update: jest.Mock }).update.mockResolvedValue({});

      const result = await service.forgotPassword('test@test.com');

      expect(result.message).toContain('reset link');
      expect(mockEmail.sendPasswordReset).toHaveBeenCalled();
      expect(result).not.toHaveProperty('resetToken');
    });

    it('should not reveal if email does not exist', async () => {
      (mockPrisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('missing@test.com');
      expect(result.message).toContain('reset link');
      expect(mockEmail.sendPasswordReset).not.toHaveBeenCalled();
    });
  });
});
