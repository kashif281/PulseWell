import { Injectable } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import type { AgentChatOptions } from './ai-agent.types';
import { AgentRouterService } from './agent-router.service';
import { ConversationService } from './conversation.service';

@Injectable()
export class AiGatewayService {
  constructor(
    private router: AgentRouterService,
    private conversation: ConversationService,
  ) {}

  chat(userId: string, agentType: AgentType, message: string, options: AgentChatOptions = {}) {
    return this.router.route(userId, agentType, message, options);
  }

  getSessions(userId: string, agentType: AgentType) {
    return this.conversation.getSessions(userId, agentType);
  }

  getSessionMessages(userId: string, sessionId: string, agentType: AgentType) {
    return this.conversation.getSessionMessages(userId, sessionId, agentType);
  }
}
