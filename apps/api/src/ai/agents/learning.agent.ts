import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { LlmGateway } from '../llm.gateway';
import { LearningService } from '../../learning/learning.service';
import type { AgentContext, AgentResponse, IAgent } from '../ai-agent.types';
import { LEARNING_SYSTEM_PROMPT } from '../prompts/learning.prompt';
import {
  isQuizIntent,
  isCodeChallengeIntent,
  isMockInterviewIntent,
  isStudyPlanIntent,
  parseQuizBlock,
  parseCodeChallengeBlock,
} from '../../learning/learning-draft.util';

@Injectable()
export class LearningAgent implements IAgent {
  readonly type = AgentType.LEARNING;

  constructor(
    private llm: LlmGateway,
    @Inject(forwardRef(() => LearningService))
    private learning: LearningService,
  ) {}

  async canAccess(): Promise<boolean> {
    return true;
  }

  async handle(context: AgentContext): Promise<AgentResponse> {
    const { userId, message, session } = context;
    const learningContext = await this.learning.buildLearningContext(userId);

    let extraInstruction = '';
    if (isQuizIntent(message)) {
      extraInstruction =
        'The user wants a quiz. Generate 5 multiple-choice questions with the QUIZ_DRAFT block format.';
    } else if (isCodeChallengeIntent(message)) {
      extraInstruction =
        'The user wants a coding challenge. Generate one problem with the CODE_CHALLENGE block format.';
    } else if (isMockInterviewIntent(message)) {
      extraInstruction =
        'Run a mock technical interview. Ask one focused question at a time based on their role. Do not reveal answers immediately.';
    } else if (isStudyPlanIntent(message)) {
      extraInstruction =
        'Create a practical 2-week study plan based on their skill gaps and recommended topics.';
    }

    const rawMessage = await this.llm.chat(
      LEARNING_SYSTEM_PROMPT,
      session.messages,
      extraInstruction ? `${message}\n\n[Instruction: ${extraInstruction}]` : message,
      learningContext,
      {
        agentType: AgentType.LEARNING,
        userId,
        maxTokens: 4096,
        temperature: 0.6,
        fallback:
          'I am your learning tutor. Ask me to explain a topic, quiz you, start a mock interview, or build a study plan.',
      },
    );

    const { message: quizMsg, quiz } = parseQuizBlock(rawMessage);
    const { message: cleanMessage, challenge } = parseCodeChallengeBlock(quizMsg);

    const metadata: Record<string, unknown> = {};
    let quizId: string | undefined;
    let challengeId: string | undefined;

    if (quiz) {
      const saved = await this.learning.saveQuizDraft(userId, session.id, quiz);
      quizId = saved.id;
      metadata.activeQuizId = saved.id;
      metadata.quizDraft = quiz;
    }

    if (challenge) {
      const employee = await this.learning.getEmployeeByUserId(userId);
      const saved = await this.learning.saveChallengeDraft(employee.companyId, challenge);
      challengeId = saved.id;
      metadata.activeChallengeId = saved.id;
      metadata.codeChallenge = challenge;
    }

    await this.learning.touchStreak(
      (await this.learning.getEmployeeByUserId(userId)).id,
      3,
    );

    return {
      message: cleanMessage || rawMessage,
      metadata: {
        ...metadata,
        ...(quizId ? { quizId } : {}),
        ...(challengeId ? { challengeId } : {}),
      },
    };
  }
}
