import { AgentType } from '@prisma/client';
import type { ReportAnalysis } from '../chat/report-analysis.types';

export interface AgentChatOptions {
  sessionId?: string;
  documentId?: string;
  contextDocumentId?: string;
  analyzeDocument?: boolean;
  forceReanalyze?: boolean;
  companyId?: string;
}

export interface AgentMessage {
  role: string;
  content: string;
}

export interface AgentSession {
  id: string;
  userId: string;
  agentType: AgentType;
  title: string | null;
  metadata: unknown;
  messages: AgentMessage[];
}

export interface HrPolicyDraft {
  title: string;
  category: string;
  content: string;
  version?: string;
  effectiveDate?: string;
}

export interface AgentResponse {
  message: string;
  reportAnalysis?: ReportAnalysis;
  draftPolicy?: HrPolicyDraft;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  userId: string;
  companyId?: string;
  message: string;
  session: AgentSession;
  options: AgentChatOptions;
}

export interface IAgent {
  readonly type: AgentType;
  canAccess(userId: string, companyId?: string): Promise<boolean>;
  handle(context: AgentContext): Promise<AgentResponse>;
}
