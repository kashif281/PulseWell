import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AgentRegistryService } from './agent-registry.service';
import { AgentRouterService } from './agent-router.service';
import { ConversationService } from './conversation.service';
import { LlmGateway } from './llm.gateway';
import { HrAgent } from './agents/hr.agent';
import { LearningAgent } from './agents/learning.agent';
import { HrPolicyPdfService } from './hr-policy-pdf.service';
import { HrPolicyActionsService } from './hr-policy-actions.service';
import { StorageModule } from '../storage/storage.module';
import { CompanyModule } from '../company/company.module';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [StorageModule, CompanyModule, forwardRef(() => LearningModule)],
  controllers: [AiController],
  providers: [
    LlmGateway,
    ConversationService,
    AgentRegistryService,
    AgentRouterService,
    AiGatewayService,
    HrAgent,
    LearningAgent,
    HrPolicyPdfService,
    HrPolicyActionsService,
  ],
  exports: [AiGatewayService, LlmGateway],
})
export class AiModule {}
