import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { IntegrationProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

export type PlatformEventType =
  | 'email.sent'
  | 'email.replied'
  | 'leave.requested'
  | 'leave.reviewed'
  | 'checkin.completed'
  | 'wellness.risk_high'
  | 'employee.invited'
  | 'integration.test';

export interface PlatformEventPayload {
  event: PlatformEventType;
  occurredAt: string;
  companyId: string;
  companyName?: string;
  data: Record<string, unknown>;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.companyIntegration.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        name: true,
        webhookUrl: true,
        isActive: true,
        events: true,
        lastFiredAt: true,
        lastStatus: true,
        createdAt: true,
        updatedAt: true,
        // never return secret in full — only whether set
        secret: true,
      },
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        hasSecret: Boolean(r.secret),
        secret: undefined,
      })),
    );
  }

  async upsertMakeWebhook(
    companyId: string,
    data: {
      webhookUrl: string;
      name?: string;
      events?: string[];
      isActive?: boolean;
      regenerateSecret?: boolean;
      id?: string;
    },
  ) {
    const secret =
      data.regenerateSecret || !data.id
        ? randomBytes(24).toString('hex')
        : undefined;

    if (data.id) {
      return this.prisma.companyIntegration.update({
        where: { id: data.id },
        data: {
          webhookUrl: data.webhookUrl,
          name: data.name ?? 'Make.com',
          events: data.events,
          isActive: data.isActive,
          ...(secret ? { secret } : {}),
        },
      });
    }

    return this.prisma.companyIntegration.create({
      data: {
        companyId,
        provider: IntegrationProvider.MAKE,
        name: data.name ?? 'Make.com',
        webhookUrl: data.webhookUrl,
        secret: secret ?? randomBytes(24).toString('hex'),
        events: data.events ?? ['email.sent', 'email.replied'],
        isActive: data.isActive ?? true,
      },
    });
  }

  async delete(companyId: string, id: string) {
    await this.prisma.companyIntegration.deleteMany({
      where: { id, companyId },
    });
    return { ok: true };
  }

  /**
   * Fire-and-forget outbound webhooks to Make.com / custom endpoints.
   * Never throws to callers — automation failures must not break core product flows.
   */
  async emit(companyId: string, event: PlatformEventType, data: Record<string, unknown>) {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      if (!company) return;

      const integrations = await this.prisma.companyIntegration.findMany({
        where: {
          companyId,
          isActive: true,
          events: { has: event },
        },
      });

      if (!integrations.length) return;

      const payload: PlatformEventPayload = {
        event,
        occurredAt: new Date().toISOString(),
        companyId: company.id,
        companyName: company.name,
        data,
      };

      await Promise.allSettled(
        integrations.map((integration) => this.postWebhook(integration, payload)),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to emit ${event} for company ${companyId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async testWebhook(companyId: string, integrationId: string) {
    const integration = await this.prisma.companyIntegration.findFirst({
      where: { id: integrationId, companyId },
    });
    if (!integration) throw new Error('Integration not found');

    const payload: PlatformEventPayload = {
      event: 'integration.test',
      occurredAt: new Date().toISOString(),
      companyId,
      data: {
        message: 'Test event from Nura — Make.com connection is working.',
        source: 'nura-platform',
      },
    };

    // Temporarily allow test even if not in events list
    await this.postWebhook(integration, payload, true);
    return { ok: true };
  }

  private async postWebhook(
    integration: {
      id: string;
      webhookUrl: string;
      secret: string | null;
    },
    payload: PlatformEventPayload,
    force = false,
  ) {
    if (!force && !(await this.shouldFire(integration.id, payload.event))) {
      return;
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Nura-Integrations/1.0',
      'X-Nura-Event': payload.event,
      'X-Nura-Company-Id': payload.companyId,
    };

    if (integration.secret) {
      const signature = createHmac('sha256', integration.secret).update(body).digest('hex');
      headers['X-Nura-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const status = `${res.status} ${res.statusText}`;
      await this.prisma.companyIntegration.update({
        where: { id: integration.id },
        data: { lastFiredAt: new Date(), lastStatus: status },
      });
      if (!res.ok) {
        this.logger.warn(`Webhook ${integration.id} returned ${status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.companyIntegration.update({
        where: { id: integration.id },
        data: { lastFiredAt: new Date(), lastStatus: `error: ${msg}` },
      });
      this.logger.warn(`Webhook ${integration.id} failed: ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async shouldFire(integrationId: string, event: string) {
    const row = await this.prisma.companyIntegration.findUnique({
      where: { id: integrationId },
      select: { events: true, isActive: true },
    });
    return Boolean(row?.isActive && row.events.includes(event));
  }
}
