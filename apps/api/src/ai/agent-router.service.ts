import { ForbiddenException, Injectable } from '@nestjs/common';
import { AgentType, ActivityType } from '@prisma/client';
import type { AgentChatOptions, AgentContext, AgentResponse } from './ai-agent.types';
import { AgentRegistryService } from './agent-registry.service';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AgentRouterService {
  constructor(
    private registry: AgentRegistryService,
    private conversation: ConversationService,
    private prisma: PrismaService,
  ) {}

  async route(
    userId: string,
    agentType: AgentType,
    message: string,
    options: AgentChatOptions = {},
  ): Promise<AgentResponse & { sessionId: string }> {
    const agent = this.registry.get(agentType);
    const allowed = await agent.canAccess(userId, options.companyId);
    if (!allowed) {
      throw new ForbiddenException(`You do not have access to the ${agentType} agent`);
    }

    const session = await this.conversation.getOrCreateSession(
      userId,
      agentType,
      message,
      options.sessionId,
    );

    const context: AgentContext = {
      userId,
      companyId: options.companyId,
      message,
      session: {
        id: session.id,
        userId: session.userId,
        agentType: session.agentType,
        title: session.title,
        metadata: session.metadata,
        messages: session.messages,
      },
      options,
    };

    const response = await agent.handle(context);

    let displayMessage = response.message;
    if (response.draftPolicy) {
      displayMessage = response.message;
    }

    await this.conversation.addAssistantMessage(session.id, displayMessage || response.message);

    if (response.metadata || response.draftPolicy) {
      const metadata = {
        ...(typeof session.metadata === 'object' && session.metadata !== null
          ? (session.metadata as Record<string, unknown>)
          : {}),
        ...response.metadata,
      };
      if (response.draftPolicy) {
        metadata.draftPolicy = response.draftPolicy;
      } else if ('draftPolicy' in metadata && metadata.draftPolicy === undefined) {
        delete metadata.draftPolicy;
      }
      await this.conversation.updateSessionMetadata(session.id, metadata);
    }

    if (agentType === AgentType.WELLNESS) {
      await this.prisma.activityLog.create({
        data: {
          userId,
          type: ActivityType.CHAT,
          title: 'AI chat conversation',
          description: message.slice(0, 100),
        },
      });
    }

    return {
      sessionId: session.id,
      message: displayMessage || response.message,
      reportAnalysis: response.reportAnalysis,
      draftPolicy: response.draftPolicy,
      metadata: response.metadata,
    };
  }
}
