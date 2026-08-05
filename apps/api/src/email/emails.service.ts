import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ActivityType,
  EmailDirection,
  EmailSenderType,
  EmailThreadStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from './email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LlmGateway } from '../ai/llm.gateway';
import { AgentType } from '@prisma/client';
import { IntegrationsService } from '../integrations/integrations.service';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface SendEmailDto {
  employeeId: string;
  subject: string;
  bodyHtml?: string;
  bodyText: string;
  threadId?: string;
  templateId?: string;
  attachments?: Array<{ fileName: string; url: string; size?: number; mimeType?: string }>;
}

export interface InboundEmailPayload {
  from: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
    private llm: LlmGateway,
    private integrations: IntegrationsService,
  ) {}

  private assertCompanyAccess(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
  ) {
    if (requester.role === UserRole.SUPER_ADMIN) return;
    if (requester.role === UserRole.COMPANY_ADMIN && requester.companyId === companyId) return;
    throw new ForbiddenException('Not authorized to access company emails');
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private textToHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div style="font-family: sans-serif; white-space: pre-wrap;">${escaped}</div>`;
  }

  private validateAttachments(
    attachments?: Array<{ fileName: string; url: string; size?: number; mimeType?: string }>,
  ) {
    if (!attachments?.length) return;
    for (const a of attachments) {
      if (a.size != null && a.size > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException(`Attachment ${a.fileName} exceeds 5MB limit`);
      }
      if (a.mimeType && !ALLOWED_MIME.has(a.mimeType)) {
        throw new BadRequestException(`Attachment type not allowed: ${a.mimeType}`);
      }
    }
  }

  async sendEmail(
    requester: { sub: string; role: UserRole; companyId?: string | null },
    companyId: string,
    dto: SendEmailDto,
  ) {
    this.assertCompanyAccess(requester, companyId);
    this.validateAttachments(dto.attachments);

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
      include: { user: { select: { email: true, firstName: true, lastName: true, id: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    let subject = dto.subject;
    let bodyText = dto.bodyText;
    let bodyHtml = dto.bodyHtml ?? this.textToHtml(dto.bodyText);

    if (dto.templateId) {
      const template = await this.prisma.emailTemplate.findFirst({
        where: { id: dto.templateId, companyId },
      });
      if (!template) throw new NotFoundException('Template not found');
      const firstName = employee.user.firstName ?? 'there';
      subject = template.subject.replace(/\{\{firstName\}\}/g, firstName);
      bodyText = template.body.replace(/\{\{firstName\}\}/g, firstName);
      bodyHtml = this.textToHtml(bodyText);
    }

    let thread =
      dto.threadId
        ? await this.prisma.emailThread.findFirst({
            where: { id: dto.threadId, companyId, employeeId: employee.id },
            include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
          })
        : null;

    if (dto.threadId && !thread) throw new NotFoundException('Thread not found');

    const isNewThread = !thread;
    if (!thread) {
      thread = await this.prisma.emailThread.create({
        data: {
          companyId,
          employeeId: employee.id,
          subject,
          createdById: requester.sub,
          lastMessageAt: new Date(),
        },
        include: { messages: true },
      });
    }

    const lastOutbound = thread.messages?.[0];
    const localMessageId = `thread-${thread.id}.${Date.now()}`;
    const rfcMessageId = this.email.buildMessageId(localMessageId);
    // Use dedicated inbound address only when a real domain is configured; otherwise reply to HR inbox
    const replyTo = this.email.replyToForThread(thread.id);
    const outboundSubject = dto.threadId
      ? thread.subject.startsWith('Re:')
        ? thread.subject
        : `Re: ${thread.subject}`
      : subject;

    let sendResult: { messageId: string };
    try {
      sendResult = await this.email.sendOutbound({
        to: employee.user.email,
        subject: outboundSubject,
        html: bodyHtml,
        text: bodyText,
        messageId: rfcMessageId,
        inReplyTo: lastOutbound?.messageId ?? undefined,
        references: lastOutbound?.messageId ?? undefined,
        replyTo,
      });
    } catch (error) {
      if (isNewThread) {
        await this.prisma.emailThread.delete({ where: { id: thread.id } }).catch(() => undefined);
      }
      throw error;
    }

    const message = await this.prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        senderType: EmailSenderType.HR,
        senderEmail: this.email.fromAddress,
        recipientEmail: employee.user.email,
        subject: outboundSubject,
        bodyHtml,
        bodyText,
        messageId: sendResult.messageId,
        inReplyTo: lastOutbound?.messageId ?? null,
        direction: EmailDirection.OUTBOUND,
        isRead: true,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((a) => ({
                fileName: a.fileName,
                url: a.url,
                size: a.size,
                mimeType: a.mimeType,
              })),
            }
          : undefined,
      },
      include: { attachments: true },
    });

    await this.prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        status: EmailThreadStatus.OPEN,
        subject: thread.subject || subject,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: employee.userId,
        type: ActivityType.EMAIL_SENT,
        title: 'HR sent email',
        description: subject,
        metadata: { threadId: thread.id, messageId: message.id },
      },
    });

    void this.integrations.emit(companyId, 'email.sent', {
      threadId: thread.id,
      messageId: message.id,
      subject: outboundSubject,
      preview: bodyText.slice(0, 280),
      employee: {
        id: employee.id,
        email: employee.user.email,
        firstName: employee.user.firstName,
        lastName: employee.user.lastName,
      },
      sentByUserId: requester.sub,
      direction: 'OUTBOUND',
    });

    return this.getThread(requester, companyId, thread.id);
  }

  async listThreads(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    opts: {
      status?: EmailThreadStatus | 'UNREAD' | 'SENT';
      employeeId?: string;
      q?: string;
      limit?: number;
    } = {},
  ) {
    this.assertCompanyAccess(requester, companyId);
    const limit = Math.min(opts.limit ?? 50, 100);

    const where: Record<string, unknown> = { companyId };
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.status === EmailThreadStatus.ARCHIVED) {
      where.status = EmailThreadStatus.ARCHIVED;
    } else if (opts.status === EmailThreadStatus.OPEN || opts.status === 'SENT') {
      where.status = EmailThreadStatus.OPEN;
    }

    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        {
          messages: {
            some: {
              OR: [
                { bodyText: { contains: q, mode: 'insensitive' } },
                { subject: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          employee: {
            user: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const threads = await this.prisma.emailThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: { where: { isRead: false, direction: EmailDirection.INBOUND } },
          },
        },
      },
    });

    let result = threads.map((t) => ({
      ...t,
      unreadCount: t._count.messages,
      preview: t.messages[0]?.bodyText?.slice(0, 160) ?? '',
    }));

    if (opts.status === 'UNREAD') {
      result = result.filter((t) => t.unreadCount > 0);
    }

    return result;
  }

  async getThread(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    threadId: string,
  ) {
    this.assertCompanyAccess(requester, companyId);
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, companyId },
      include: {
        employee: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: true },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    await this.prisma.emailMessage.updateMany({
      where: { threadId, direction: EmailDirection.INBOUND, isRead: false },
      data: { isRead: true },
    });

    return thread;
  }

  async archiveThread(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    threadId: string,
    archive = true,
  ) {
    this.assertCompanyAccess(requester, companyId);
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, companyId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    return this.prisma.emailThread.update({
      where: { id: threadId },
      data: { status: archive ? EmailThreadStatus.ARCHIVED : EmailThreadStatus.OPEN },
    });
  }

  async search(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    q: string,
  ) {
    return this.listThreads(requester, companyId, { q, limit: 50 });
  }

  async listTemplates(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
  ) {
    this.assertCompanyAccess(requester, companyId);
    return this.prisma.emailTemplate.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    data: { name: string; subject: string; body: string },
  ) {
    this.assertCompanyAccess(requester, companyId);
    return this.prisma.emailTemplate.create({
      data: { companyId, name: data.name, subject: data.subject, body: data.body },
    });
  }

  private extractThreadIdFromRecipients(to: string | string[] | undefined): string | null {
    const list = Array.isArray(to) ? to : to ? [to] : [];
    for (const addr of list) {
      const match = addr.match(/reply\+([a-z0-9]+)@/i);
      if (match) return match[1];
    }
    return null;
  }

  async handleInbound(payload: InboundEmailPayload) {
    const from = (payload.from || '').replace(/.*<([^>]+)>.*/, '$1').trim().toLowerCase();
    if (!from) throw new BadRequestException('Missing from address');

    const headers = payload.headers ?? {};
    const inReplyTo =
      payload.inReplyTo || headers['in-reply-to'] || headers['In-Reply-To'] || undefined;
    const messageId =
      payload.messageId || headers['message-id'] || headers['Message-ID'] || undefined;

    let thread = null as Awaited<ReturnType<typeof this.prisma.emailThread.findFirst>>;

    const threadIdFromTo = this.extractThreadIdFromRecipients(payload.to);
    if (threadIdFromTo) {
      thread = await this.prisma.emailThread.findUnique({ where: { id: threadIdFromTo } });
    }

    if (!thread && inReplyTo) {
      const prior = await this.prisma.emailMessage.findFirst({
        where: { messageId: inReplyTo },
        include: { thread: true },
      });
      thread = prior?.thread ?? null;
    }

    if (!thread) {
      const employee = await this.prisma.employee.findFirst({
        where: { user: { email: { equals: from, mode: 'insensitive' } } },
        include: { user: true },
      });
      if (!employee) {
        this.logger.warn(`Inbound email from unknown address: ${from}`);
        return { ok: false, reason: 'unknown_sender' };
      }
      const subject = (payload.subject || '').replace(/^Re:\s*/i, '').trim();
      thread = await this.prisma.emailThread.findFirst({
        where: {
          employeeId: employee.id,
          status: EmailThreadStatus.OPEN,
          ...(subject ? { subject: { contains: subject, mode: 'insensitive' } } : {}),
        },
        orderBy: { lastMessageAt: 'desc' },
      });
      if (!thread) {
        thread = await this.prisma.emailThread.create({
          data: {
            companyId: employee.companyId,
            employeeId: employee.id,
            subject: payload.subject || '(no subject)',
            lastMessageAt: new Date(),
          },
        });
      }
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: thread.employeeId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found for thread');

    const bodyText = payload.text?.trim() || this.htmlToText(payload.html || '');
    const bodyHtml = payload.html || this.textToHtml(bodyText);

    if (messageId) {
      const existing = await this.prisma.emailMessage.findUnique({ where: { messageId } });
      if (existing) return { ok: true, duplicate: true, threadId: thread.id };
    }

    const message = await this.prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        senderType: EmailSenderType.EMPLOYEE,
        senderEmail: from,
        recipientEmail: this.email.fromAddress,
        subject: payload.subject || `Re: ${thread.subject}`,
        bodyHtml,
        bodyText,
        messageId: messageId ?? this.email.buildMessageId(`inbound-${Date.now()}`),
        inReplyTo: inReplyTo ?? null,
        direction: EmailDirection.INBOUND,
        isRead: false,
      },
    });

    await this.prisma.emailThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), status: EmailThreadStatus.OPEN },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: employee.userId,
        type: ActivityType.EMAIL_RECEIVED,
        title: 'Employee replied',
        description: bodyText.slice(0, 200),
        metadata: { threadId: thread.id, messageId: message.id },
      },
    });

    await this.notifyHrOfReply(thread.companyId, employee, thread.subject, bodyText);
    void this.integrations.emit(thread.companyId, 'email.replied', {
      threadId: thread.id,
      messageId: message.id,
      subject: payload.subject || `Re: ${thread.subject}`,
      preview: bodyText.slice(0, 280),
      employee: {
        id: employee.id,
        email: employee.user.email,
        firstName: employee.user.firstName,
        lastName: employee.user.lastName,
      },
      from,
      direction: 'INBOUND',
    });
    void this.generateSummary(thread.id).catch((err) =>
      this.logger.warn(`Summary generation failed: ${err}`),
    );

    return { ok: true, threadId: thread.id, messageId: message.id };
  }

  /** Dev/admin helper: simulate an employee reply without a real inbound provider. */
  async simulateReply(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    threadId: string,
    bodyText: string,
  ) {
    this.assertCompanyAccess(requester, companyId);
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, companyId },
      include: {
        employee: { include: { user: { select: { email: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    return this.handleInbound({
      from: thread.employee.user.email,
      to: this.email.replyToForThread(thread.id),
      subject: `Re: ${thread.subject}`,
      text: bodyText,
      inReplyTo: thread.messages[0]?.messageId ?? undefined,
      messageId: this.email.buildMessageId(`sim-${Date.now()}`),
    });
  }

  private async notifyHrOfReply(
    companyId: string,
    employee: { user: { firstName: string | null; lastName: string | null; email: string } },
    subject: string,
    preview: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { companyId, role: UserRole.COMPANY_ADMIN, isActive: true },
      select: { id: true },
    });
    const name =
      `${employee.user.firstName ?? ''} ${employee.user.lastName ?? ''}`.trim() ||
      employee.user.email;
    await Promise.all(
      admins.map((a) =>
        this.notifications.createNotification(
          a.id,
          NotificationType.EMAIL_REPLY,
          `Reply from ${name}`,
          `${subject}: ${preview.slice(0, 120)}`,
        ),
      ),
    );
  }

  async generateSummary(threadId: string) {
    const thread = await this.prisma.emailThread.findUnique({
      where: { id: threadId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!thread || thread.messages.length === 0) return null;

    const transcript = thread.messages
      .map(
        (m) =>
          `${m.senderType === EmailSenderType.HR ? 'HR' : 'Employee'} (${m.createdAt.toISOString()}):\n${m.bodyText}`,
      )
      .join('\n\n');

    const name =
      `${thread.employee.user.firstName ?? ''} ${thread.employee.user.lastName ?? ''}`.trim() ||
      'Employee';

    const fallback = `Conversation with ${name} about "${thread.subject}" (${thread.messages.length} messages).`;

    const summary = await this.llm.chat(
      'You summarize HR–employee email conversations for wellness and HR follow-up. Be concise, factual, and professional. Output 3–6 short bullet points covering: key topics, employee wellbeing signals, requests, and recommended follow-up.',
      [],
      `Summarize this email thread.\n\nSubject: ${thread.subject}\nEmployee: ${name}\n\n${transcript}`,
      '',
      {
        agentType: AgentType.HR,
        userId: thread.createdById ?? thread.employee.userId,
        companyId: thread.companyId,
        maxTokens: 400,
        temperature: 0.2,
        fallback,
      },
    );

    return this.prisma.emailThread.update({
      where: { id: threadId },
      data: { summary },
    });
  }

  async getSummary(
    requester: { role: UserRole; companyId?: string | null },
    companyId: string,
    threadId: string,
  ) {
    this.assertCompanyAccess(requester, companyId);
    const thread = await this.prisma.emailThread.findFirst({
      where: { id: threadId, companyId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.summary) return { summary: thread.summary };
    const updated = await this.generateSummary(threadId);
    return { summary: updated?.summary ?? null };
  }
}
