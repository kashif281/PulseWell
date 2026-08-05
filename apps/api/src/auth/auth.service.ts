import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { EmploymentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from '../email/email.service';
import { EmployeeInvitationService } from '../employees/employee-invitation.service';
import { AcceptInvitationDto } from '../employees/dto/invitation.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from '@pulseai/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private invitationService: EmployeeInvitationService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const isCompanyAdmin = !!dto.companyName;

    const result = await this.prisma.$transaction(async (tx) => {
      let companyId: string | undefined;

      if (dto.companyName) {
        const company = await tx.company.create({
          data: {
            name: dto.companyName,
            subscriptions: {
              create: { plan: 'FREE', status: 'ACTIVE' },
            },
            wellnessConfig: { create: {} },
          },
        });
        companyId = company.id;
      }

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: isCompanyAdmin ? UserRole.COMPANY_ADMIN : UserRole.EMPLOYEE,
          companyId,
          emailVerifyToken: uuidv4(),
        },
      });

      if (companyId) {
        await tx.employee.create({
          data: {
            userId: user.id,
            companyId,
            onboardingComplete: false,
          },
        });
      }

      return user;
    });

    const tokens = await this.generateTokens({
      sub: result.id,
      email: result.email,
      role: result.role as JwtPayload['role'],
      companyId: result.companyId ?? undefined,
    });

    return {
      user: this.sanitizeUser(result),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: true },
    });
    if (!user || !user.passwordHash) {
      if (user && !user.passwordHash) {
        throw new UnauthorizedException(
          'Please activate your account using the invitation link sent to your email',
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (user.employee) {
      const status = user.employee.employmentStatus;
      if (status === EmploymentStatus.SUSPENDED) {
        throw new UnauthorizedException('Your account has been suspended. Contact HR.');
      }
      if (status === EmploymentStatus.INACTIVE) {
        throw new UnauthorizedException('Your account is inactive. Contact HR.');
      }
      if (
        status === EmploymentStatus.INVITATION_PENDING ||
        status === EmploymentStatus.INVITATION_SENT ||
        status === EmploymentStatus.INVITATION_EXPIRED
      ) {
        throw new UnauthorizedException(
          'Please complete account activation using your invitation link',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      companyId: user.companyId ?? undefined,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens({
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role as JwtPayload['role'],
      companyId: stored.user.companyId ?? undefined,
    });

    return tokens;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await this.emailService.sendPasswordReset(user.email, resetToken, user.firstName ?? undefined);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async getInvitation(token: string) {
    return this.invitationService.validateInvitationToken(token);
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const result = await this.invitationService.acceptInvitation(token, dto);
    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
      include: { employee: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      companyId: user.companyId ?? undefined,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: { include: { department: true } },
        company: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private async generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = uuidv4();
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const days = parseInt(expiresIn) || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.sub,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: Record<string, unknown>) {
    const { passwordHash, resetToken, resetTokenExpiry, emailVerifyToken, ...safe } = user;
    return safe;
  }
}
