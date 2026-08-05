import { Injectable } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { WellnessAgent } from '../ai/agents/wellness.agent';

@Injectable()
export class AiService {
  constructor(
    private gateway: AiGatewayService,
    private wellnessAgent: WellnessAgent,
  ) {}

  chat(
    userId: string,
    message: string,
    options: {
      sessionId?: string;
      documentId?: string;
      contextDocumentId?: string;
      analyzeDocument?: boolean;
      forceReanalyze?: boolean;
    } = {},
  ) {
    return this.gateway.chat(userId, AgentType.WELLNESS, message, options);
  }

  getSessions(userId: string) {
    return this.gateway.getSessions(userId, AgentType.WELLNESS);
  }

  getSessionMessages(userId: string, sessionId: string) {
    return this.gateway.getSessionMessages(userId, sessionId, AgentType.WELLNESS);
  }

  analyzeDocumentForUser(
    userId: string,
    documentId: string,
    healthContext?: string,
    forceReanalyze = false,
  ) {
    return this.wellnessAgent.analyzeDocumentForUser(
      userId,
      documentId,
      healthContext,
      forceReanalyze,
    );
  }

  generateInsights(employeeId: string) {
    return this.wellnessAgent.generateInsights(employeeId);
  }
}
