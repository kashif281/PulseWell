import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateSession(
    userId: string,
    agentType: AgentType,
    message: string,
    sessionId?: string,
  ) {
    if (sessionId) {
      const existing = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, agentType },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
      if (existing) {
        await this.prisma.message.create({
          data: { sessionId: existing.id, role: 'user', content: message },
        });
        return existing;
      }
    }

    return this.prisma.chatSession.create({
      data: {
        userId,
        agentType,
        title: message.slice(0, 50),
        messages: { create: { role: 'user', content: message } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async addAssistantMessage(sessionId: string, content: string) {
    await this.prisma.message.create({
      data: { sessionId, role: 'assistant', content },
    });
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  async updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>) {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { metadata: metadata as object },
    });
  }

  getSessions(userId: string, agentType: AgentType) {
    return this.prisma.chatSession.findMany({
      where: { userId, agentType },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
  }

  async getSessionMessages(userId: string, sessionId: string, agentType: AgentType) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId, agentType },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }
}
