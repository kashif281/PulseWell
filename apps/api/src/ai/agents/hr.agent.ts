import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AgentType, PolicyCategory, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { LlmGateway } from '../llm.gateway';
import { HrPolicyActionsService } from '../hr-policy-actions.service';
import type { AgentContext, AgentResponse, IAgent } from '../ai-agent.types';
import { HR_SYSTEM_PROMPT } from '../prompts/hr.prompt';
import { isSaveToPoliciesIntent, parsePolicyDraftBlock } from '../hr-policy-draft.util';

@Injectable()
export class HrAgent implements IAgent {
  readonly type = AgentType.HR;

  constructor(
    private prisma: PrismaService,
    private llm: LlmGateway,
    private policyActions: HrPolicyActionsService,
  ) {}

  async canAccess(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.COMPANY_ADMIN;
  }

  async handle(context: AgentContext): Promise<AgentResponse> {
    const { userId, companyId, message, session } = context;
    if (!(await this.canAccess(userId))) {
      throw new ForbiddenException('HR Agent is only available to administrators');
    }

    const resolvedCompanyId = companyId ?? (await this.resolveCompanyId(userId));

    if (isSaveToPoliciesIntent(message)) {
      try {
        const result = await this.policyActions.publishDraft(
          resolvedCompanyId,
          userId,
          session.id,
        );
        return {
          message: `Done! I saved "${result.policy.title}" to your company policies (version ${result.policy.version}). View it under Admin → Policies. A PDF has also been generated.`,
          metadata: { publishedPolicyId: result.policy.id, draftPolicy: undefined },
        };
      } catch (error) {
        if (error instanceof BadRequestException) {
          return { message: error.message };
        }
        return {
          message:
            'Could not save the policy. Please ask me to draft a policy first, then say "save this to policies".',
        };
      }
    }

    const hrContext = await this.buildHrContext(resolvedCompanyId);

    const rawMessage = await this.llm.chat(
      HR_SYSTEM_PROMPT,
      session.messages,
      message,
      hrContext,
      {
        agentType: AgentType.HR,
        userId,
        companyId: resolvedCompanyId,
        maxTokens: 4096,
        temperature: 0.5,
        fallback:
          'I can help draft company policies, handbook sections, HR letters, and announcements. Try: "Create an attendance policy for our office."',
      },
    );

    const { message: cleanMessage, draft } = parsePolicyDraftBlock(rawMessage);

    return {
      message: cleanMessage || rawMessage,
      draftPolicy: draft,
    };
  }

  private async resolveCompanyId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (user?.companyId) return user.companyId;
    if (user?.employee?.companyId) return user.employee.companyId;
    throw new ForbiddenException('Company not found for HR Agent');
  }

  private async buildHrContext(companyId: string): Promise<string> {
    const [company, policies, leaveTypes, weatherSettings] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.companyPolicy.findMany({
        where: { companyId, isActive: true },
        orderBy: { title: 'asc' },
        select: { title: true, category: true, version: true },
      }),
      this.prisma.leaveType.findMany({
        where: { companyId },
        select: { name: true, daysPerYear: true, isPaid: true },
      }),
      this.prisma.weatherSettings.findUnique({ where: { companyId } }),
    ]);

    const parts: string[] = [];
    if (company) {
      parts.push(`Company: ${company.name}`);
      if (company.timezone) parts.push(`Timezone: ${company.timezone}`);
      if (company.businessHoursStart && company.businessHoursEnd) {
        parts.push(`Business hours: ${company.businessHoursStart} – ${company.businessHoursEnd}`);
      }
      if (company.workingDays?.length) {
        parts.push(`Working days: ${company.workingDays.join(', ')}`);
      }
    }

    if (policies.length) {
      parts.push(
        'Existing active policies:\n' +
          policies.map((p) => `- ${p.title} (${p.category}, v${p.version})`).join('\n'),
      );
    } else {
      parts.push('Existing active policies: none yet.');
    }

    if (leaveTypes.length) {
      parts.push(
        'Leave types:\n' +
          leaveTypes
            .map((l) => `- ${l.name}: ${l.daysPerYear} days/year${l.isPaid ? ' (paid)' : ''}`)
            .join('\n'),
      );
    }

    if (weatherSettings) {
      parts.push(
        `WFH weather rules: heat threshold ${weatherSettings.heatThresholdC}°C, auto-approve WFH: ${weatherSettings.autoApproveWfh}, manager approval required: ${weatherSettings.requireManagerApproval}`,
      );
    }

    return parts.join('\n');
  }

  normalizeCategory(category: string): PolicyCategory {
    const upper = category.toUpperCase() as PolicyCategory;
    const valid = Object.values(PolicyCategory);
    return valid.includes(upper) ? upper : PolicyCategory.GENERAL;
  }
}
