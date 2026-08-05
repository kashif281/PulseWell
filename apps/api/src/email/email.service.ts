import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { readFile } from 'fs/promises';

export interface OutboundEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content?: Buffer | string; path?: string; contentType?: string }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private brevoApiKey: string | null = null;

  constructor(private config: ConfigService) {
    // Brevo's HTTP API (port 443) is preferred over SMTP: many hosts (e.g. Railway)
    // block outbound SMTP ports 25/465/587 by default, which makes nodemailer hang
    // until connection timeout with no way around it short of a platform exception.
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (apiKey) {
      this.brevoApiKey = apiKey;
      this.logger.log('Brevo HTTP API email service configured');
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') || 587,
        secure: false,
        auth: { user, pass },
      });
      this.logger.log('SMTP email service configured');
    } else {
      this.logger.warn('SMTP not configured — emails will be logged to console');
    }
  }

  get fromAddress(): string {
    return this.config.get<string>('EMAIL_FROM') || 'noreply@nura.app';
  }

  get fromName(): string {
    return this.config.get<string>('EMAIL_FROM_NAME') || 'Nura';
  }

  get replyDomain(): string {
    return this.config.get<string>('EMAIL_REPLY_DOMAIN') || '';
  }

  /** Only use Reply-To threading when a real inbound domain is configured (not .local). */
  replyToForThread(threadId: string): string | undefined {
    const domain = this.replyDomain.trim();
    if (!domain || domain.endsWith('.local')) return undefined;
    return `reply+${threadId}@${domain}`;
  }

  buildMessageId(localPart: string): string {
    // Never use gmail.com/outlook.com — forged Message-IDs get dropped by providers.
    const configured = this.config.get<string>('EMAIL_MESSAGE_DOMAIN')?.trim();
    const fromDomain = this.fromAddress.split('@')[1] || '';
    const publicMailbox = /^(gmail|googlemail|outlook|hotmail|yahoo|icloud)\.com$/i.test(fromDomain);
    const domain = configured || (publicMailbox ? 'mail.nura.app' : fromDomain) || 'mail.nura.app';
    const safeLocal = localPart.replace(/[^a-zA-Z0-9._+-]/g, '').slice(0, 80) || `msg-${Date.now()}`;
    return `<${safeLocal}@${domain}>`;
  }

  private async sendViaBrevoApi(
    options: OutboundEmailOptions,
    from: string,
    messageId: string,
  ): Promise<{ messageId: string }> {
    const attachment = options.attachments?.length
      ? await Promise.all(
          options.attachments.map(async (a) => {
            let content = a.content;
            if (!content && a.path) {
              content = await readFile(a.path);
            }
            const base64 =
              typeof content === 'string' ? Buffer.from(content).toString('base64') : (content as Buffer).toString('base64');
            return { name: a.filename, content: base64 };
          }),
        )
      : undefined;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.brevoApiKey!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: from },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text,
        replyTo: { email: options.replyTo || from },
        headers: {
          'Message-Id': messageId,
          ...(options.inReplyTo ? { 'In-Reply-To': options.inReplyTo } : {}),
          ...(options.references ? { References: options.references } : {}),
        },
        attachment,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const reason = `${res.status} ${res.statusText} ${body}`.trim();
      this.logger.error(`Brevo API send failed to ${options.to}: ${reason}`);
      if (res.status === 401) {
        throw new BadRequestException(
          'Email delivery failed: Brevo API key is invalid. Check BREVO_API_KEY (Settings → SMTP & API → API keys & MCP).',
        );
      }
      if (/sender|not.*valid|not.*verified/i.test(body)) {
        throw new BadRequestException(
          `Email delivery failed: sender ${from} is not verified in Brevo. Verify it under Senders & IPs, then set EMAIL_FROM to that address.`,
        );
      }
      throw new BadRequestException(`Email delivery failed: ${reason}`);
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    return { messageId: data.messageId || messageId };
  }

  async sendOutbound(options: OutboundEmailOptions): Promise<{ messageId: string }> {
    const from = this.fromAddress;
    const messageId = options.messageId ?? this.buildMessageId(`msg-${Date.now()}`);

    if (this.brevoApiKey) {
      return this.sendViaBrevoApi(options, from, messageId);
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: { name: this.fromName, address: from },
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          messageId,
          inReplyTo: options.inReplyTo,
          references: options.references,
          // Prefer real HR inbox for replies when no inbound domain is configured
          replyTo: options.replyTo || from,
          attachments: options.attachments,
        });
        this.logger.log(`Email sent to ${options.to}: ${options.subject} (${info.response ?? 'ok'})`);
        return { messageId: info.messageId || messageId };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown SMTP error';
        this.logger.error(`SMTP send failed to ${options.to}: ${reason}`);
        if (/authentication failed|invalid login|535/i.test(reason)) {
          throw new BadRequestException(
            'Email delivery failed: Brevo SMTP authentication failed. Check SMTP_USER and SMTP_PASS (use the SMTP key from Brevo → SMTP & API).',
          );
        }
        if (/sender|from address|not verified|550/i.test(reason)) {
          throw new BadRequestException(
            `Email delivery failed: sender ${from} is not verified in Brevo. Verify it under Senders & IPs, then set EMAIL_FROM to that address.`,
          );
        }
        throw new BadRequestException(`Email delivery failed: ${reason}`);
      }
    }

    this.logger.log(`[DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`);
    this.logger.log(`[DEV EMAIL] Message-ID: ${messageId} | Reply-To: ${options.replyTo ?? from}`);
    this.logger.debug(options.html);
    return { messageId };
  }

  async sendPasswordReset(email: string, resetToken: string, firstName?: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:4000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const name = firstName || 'there';

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Nura Password Reset</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <p style="color: #64748b; font-size: 12px;">Or copy this link: ${resetUrl}</p>
      </div>
    `;

    await this.sendOutbound({ to: email, subject: 'Reset your Nura password', html });
  }

  async sendInvitationActivation(
    email: string,
    firstName: string,
    companyName: string,
    invitationToken: string,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:4000';
    const activateUrl = `${frontendUrl}/invite/accept?token=${invitationToken}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Welcome to ${companyName}!</h2>
        <p>Hi ${firstName},</p>
        <p>Your company has invited you to join the employee portal on <strong>Nura</strong>.</p>
        <p>Click the button below to activate your account and complete your profile.</p>
        <a href="${activateUrl}" style="display: inline-block; background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 20px 0; font-weight: 600;">
          Activate Account
        </a>
        <p style="color: #64748b; font-size: 14px;">This link expires in 7 days. If you didn't expect this email, you can ignore it.</p>
        <p style="color: #64748b; font-size: 12px;">Or copy this link: ${activateUrl}</p>
      </div>
    `;

    await this.sendOutbound({
      to: email,
      subject: `Welcome to ${companyName} — Activate your account`,
      html,
    });
  }

  async sendEmployeeInvite(
    email: string,
    firstName: string,
    tempPassword: string,
    companyName: string,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:4000';

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Welcome to Nura</h2>
        <p>Hi ${firstName},</p>
        <p>You've been invited to join <strong>${companyName}</strong> on Nura.</p>
        <p>Sign in at <a href="${frontendUrl}/login">${frontendUrl}/login</a></p>
        <p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>
        <p style="color: #64748b; font-size: 14px;">Please change your password after signing in.</p>
      </div>
    `;

    await this.sendOutbound({
      to: email,
      subject: `You've been invited to ${companyName} on Nura`,
      html,
    });
  }
}
