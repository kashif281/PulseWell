import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { CompanyPolicyService } from '../company/company-policy.service';
import { ConversationService } from './conversation.service';
import { HrPolicyPdfService } from './hr-policy-pdf.service';
import type { HrPolicyDraft } from './ai-agent.types';
import {
  extractDraftFromMetadata,
  extractDraftFromMessages,
  normalizePolicyCategory,
} from './hr-policy-draft.util';

@Injectable()
export class HrPolicyActionsService {
  constructor(
    private policyService: CompanyPolicyService,
    private hrPdf: HrPolicyPdfService,
    private conversation: ConversationService,
  ) {}

  async resolveDraft(
    userId: string,
    sessionId: string,
    explicitDraft?: HrPolicyDraft,
  ): Promise<HrPolicyDraft> {
    if (explicitDraft?.title && explicitDraft?.content) {
      return explicitDraft;
    }

    const session = await this.conversation.getSessionMessages(userId, sessionId, AgentType.HR);

    const fromMeta = extractDraftFromMetadata(session.metadata);
    if (fromMeta) return fromMeta;

    const fromMessages = extractDraftFromMessages(session.messages);
    if (fromMessages) {
      await this.conversation.updateSessionMetadata(session.id, {
        ...(typeof session.metadata === 'object' && session.metadata !== null
          ? (session.metadata as Record<string, unknown>)
          : {}),
        draftPolicy: fromMessages,
      });
      return fromMessages;
    }

    throw new BadRequestException(
      'No policy draft found. Ask the HR Agent to create a policy first, then say "save this to policies".',
    );
  }

  async publishDraft(companyId: string, userId: string, sessionId: string, draft?: HrPolicyDraft) {
    const resolved = await this.resolveDraft(userId, sessionId, draft);

    const policy = await this.policyService.createPolicy(companyId, {
      title: resolved.title,
      category: normalizePolicyCategory(resolved.category),
      content: resolved.content,
      isActive: true,
      version: resolved.version,
      effectiveDate: resolved.effectiveDate,
    });

    let pdfUrl: string | null = null;
    try {
      const pdf = await this.hrPdf.generateForPolicy(companyId, policy.id);
      pdfUrl = pdf.pdfUrl;
    } catch {
      // Policy is saved even if PDF generation fails
    }

    await this.conversation.updateSessionMetadata(sessionId, {
      draftPolicy: resolved,
      publishedPolicyId: policy.id,
      publishedAt: new Date().toISOString(),
    });

    return { policy: { ...policy, pdfUrl }, pdfUrl };
  }
}
