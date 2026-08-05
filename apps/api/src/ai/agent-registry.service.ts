import { Injectable, OnModuleInit } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import type { IAgent } from './ai-agent.types';
import { HrAgent } from './agents/hr.agent';
import { LearningAgent } from './agents/learning.agent';

@Injectable()
export class AgentRegistryService implements OnModuleInit {
  private agents = new Map<AgentType, IAgent>();

  constructor(
    private hrAgent: HrAgent,
    private learningAgent: LearningAgent,
  ) {}

  onModuleInit() {
    this.register(this.hrAgent);
    this.register(this.learningAgent);
  }

  register(agent: IAgent) {
    this.agents.set(agent.type, agent);
  }

  get(type: AgentType): IAgent {
    const agent = this.agents.get(type);
    if (!agent) throw new Error(`Agent not registered: ${type}`);
    return agent;
  }

  list(): AgentType[] {
    return Array.from(this.agents.keys());
  }
}
