import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailThreadStatus, UserRole } from '@prisma/client';
import { Public, Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { EmailsService, type InboundEmailPayload, type SendEmailDto } from './emails.service';

@ApiTags('Emails')
@Controller('emails')
export class EmailsController {
  constructor(
    private emails: EmailsService,
    private config: ConfigService,
  ) {}

  @Post('send')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send email to an employee (starts or continues a thread)' })
  send(
    @CurrentUser() user: JwtPayload,
    @Body() body: SendEmailDto & { companyId?: string },
  ) {
    const companyId = resolveCompanyId(user, body.companyId);
    return this.emails.sendEmail(user, companyId, body);
  }

  @Get('threads')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  listThreads(
    @CurrentUser() user: JwtPayload,
    @Query('companyId') companyId?: string,
    @Query('status') status?: EmailThreadStatus | 'UNREAD' | 'SENT',
    @Query('employeeId') employeeId?: string,
    @Query('q') q?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.emails.listThreads(user, cid, { status, employeeId, q });
  }

  @Get('search')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  search(
    @CurrentUser() user: JwtPayload,
    @Query('q') q: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.emails.search(user, cid, q ?? '');
  }

  @Get('thread/:id')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  getThread(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.emails.getThread(user, cid, id);
  }

  @Put('thread/:id/archive')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { archive?: boolean; companyId?: string },
  ) {
    const cid = resolveCompanyId(user, body.companyId);
    return this.emails.archiveThread(user, cid, id, body.archive !== false);
  }

  @Post('thread/:id/summary')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  summary(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { companyId?: string },
  ) {
    const cid = resolveCompanyId(user, body?.companyId);
    return this.emails.getSummary(user, cid, id);
  }

  @Post('thread/:id/simulate-reply')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Simulate employee reply (local/dev without inbound provider)' })
  simulateReply(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { bodyText: string; companyId?: string },
  ) {
    const cid = resolveCompanyId(user, body.companyId);
    return this.emails.simulateReply(user, cid, id, body.bodyText);
  }

  @Get('templates')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  listTemplates(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.emails.listTemplates(user, cid);
  }

  @Post('templates')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  createTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; subject: string; body: string; companyId?: string },
  ) {
    const cid = resolveCompanyId(user, body.companyId);
    return this.emails.createTemplate(user, cid, body);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Inbound email webhook (Resend / provider)' })
  webhook(
    @Headers('x-webhook-secret') secretHeader: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: InboundEmailPayload & { type?: string; data?: InboundEmailPayload },
  ) {
    const secret = this.config.get<string>('EMAIL_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new UnauthorizedException('EMAIL_WEBHOOK_SECRET is not configured');
    }
    const provided =
      secretHeader ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) ||
      '';
    if (provided !== secret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // Support Resend-style envelope: { type, data: { from, to, subject, text, html, ... } }
    const payload: InboundEmailPayload =
      body.data && (body.data.from || body.from)
        ? {
            from: body.data.from ?? body.from,
            to: body.data.to ?? body.to,
            subject: body.data.subject ?? body.subject,
            text: body.data.text ?? body.text,
            html: body.data.html ?? body.html,
            messageId: body.data.messageId ?? body.messageId,
            inReplyTo: body.data.inReplyTo ?? body.inReplyTo,
            headers: body.data.headers ?? body.headers,
          }
        : body;

    return this.emails.handleInbound(payload);
  }
}
