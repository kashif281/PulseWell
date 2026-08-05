import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import type { Part } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.module';
import { StorageService } from '../../storage/storage.service';
import { LlmGateway } from '../llm.gateway';
import type { AgentContext, AgentResponse, IAgent } from '../ai-agent.types';
import {
  WELLNESS_SYSTEM_PROMPT,
  REPORT_JSON_PROMPT,
  REPORT_FOLLOWUP_INSTRUCTION,
} from '../prompts/wellness.prompt';
import {
  type ReportAnalysis,
  formatAnalysisMessage,
  formatReportContextForChat,
  parseReportAnalysis,
  isFailedAnalysis,
} from '../../chat/report-analysis.types';
import { extractPdfText } from '../../chat/pdf-text.util';

@Injectable()
export class WellnessAgent implements IAgent {
  readonly type = AgentType.WELLNESS;
  private readonly logger = new Logger(WellnessAgent.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmGateway,
    private storage: StorageService,
  ) {}

  async canAccess(): Promise<boolean> {
    return true;
  }

  async handle(context: AgentContext): Promise<AgentResponse> {
    const { userId, message, session, options } = context;
    const { documentId, contextDocumentId, analyzeDocument, forceReanalyze } = options;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: {
            healthCheckins: { orderBy: { date: 'desc' }, take: 3 },
            wellnessScores: { orderBy: { date: 'desc' }, take: 1 },
          },
        },
        documents: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    const contextSummary = this.buildHealthContext(user);
    const documentSummary = this.buildDocumentContext(user?.documents ?? []);
    const firstName = user?.firstName ?? 'there';

    const shouldAnalyze = Boolean(documentId && (analyzeDocument || forceReanalyze));
    const reportContextId = contextDocumentId || (shouldAnalyze ? undefined : documentId);

    if (shouldAnalyze && documentId) {
      const docResult = await this.analyzeDocumentForUser(
        userId,
        documentId,
        contextSummary,
        forceReanalyze,
      );
      return { message: docResult.message, reportAnalysis: docResult.analysis };
    }

    const reportContext = await this.loadReportContext(userId, reportContextId);
    const fullContext = reportContext
      ? `${contextSummary}\n\n${documentSummary}\n\n${reportContext}\n\n${REPORT_FOLLOWUP_INSTRUCTION}`
      : `${contextSummary}\n\n${documentSummary}`;

    const assistantMessage = await this.llm.chat(
      WELLNESS_SYSTEM_PROMPT,
      session.messages,
      message,
      fullContext,
      {
        agentType: AgentType.WELLNESS,
        userId,
        fallback: this.getFallbackResponse(message, firstName, reportContext),
      },
    );

    return { message: assistantMessage };
  }

  async analyzeDocumentForUser(
    userId: string,
    documentId: string,
    healthContext?: string,
    forceReanalyze = false,
  ): Promise<{ message: string; analysis: ReportAnalysis }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.analysisSummary && !forceReanalyze) {
      const cached = doc.analysisSummary as unknown as ReportAnalysis;
      if (!isFailedAnalysis(cached)) {
        return {
          message: formatAnalysisMessage(doc.fileName, cached),
          analysis: cached,
        };
      }
    }

    const { buffer, mimeType } = await this.storage.readFile(doc.fileUrl, doc.mimeType);
    const analysis = await this.extractReportAnalysis(
      buffer,
      mimeType,
      doc.fileName,
      healthContext ?? '',
    );

    if (!isFailedAnalysis(analysis)) {
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { analysisSummary: analysis as object },
      });
    }

    return {
      message: formatAnalysisMessage(doc.fileName, analysis),
      analysis,
    };
  }

  async generateInsights(employeeId: string) {
    const checkins = await this.prisma.healthCheckin.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 14,
    });

    if (checkins.length < 2) return [];

    const insights: string[] = [];
    const thisWeek = checkins.slice(0, 7);
    const lastWeek = checkins.slice(7, 14);

    const avgSleep = (arr: typeof checkins) => {
      const vals = arr.filter((c) => c.sleepHours).map((c) => c.sleepHours!);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const thisSleep = avgSleep(thisWeek);
    const lastSleep = avgSleep(lastWeek);
    if (thisSleep && lastSleep) {
      const diff = Math.round((thisSleep - lastSleep) * 60);
      if (Math.abs(diff) >= 15) {
        insights.push(
          diff > 0
            ? `You slept ${diff} minutes longer this week. Great improvement!`
            : `Your sleep decreased by ${Math.abs(diff)} minutes this week. Consider an earlier bedtime.`,
        );
      }
    }

    const exerciseDays = thisWeek.filter((c) => (c.exerciseMinutes ?? 0) >= 30).length;
    if (exerciseDays >= 4) {
      insights.push(`You exercised ${exerciseDays} days this week. Excellent consistency!`);
    }

    const skippedBreakfast = thisWeek.filter((c) => (c.mealsCount ?? 3) < 2).length;
    if (skippedBreakfast >= 3) {
      insights.push(
        `You skipped breakfast ${skippedBreakfast} times this week. A balanced breakfast fuels your day.`,
      );
    }

    return insights;
  }

  private async extractReportAnalysis(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    healthContext: string,
  ): Promise<ReportAnalysis> {
    if (this.llm.isConfigured) {
      const text = await this.extractDocumentText(buffer, mimeType);

      if (text.length > 50) {
        try {
          const fromText = await this.analyzeWithText(text, fileName, healthContext);
          if (fromText) return fromText;
        } catch (error) {
          this.logger.warn(`Text analysis failed: ${error}`);
        }
      }

      try {
        const fromPdf = await this.analyzeWithVision(buffer, mimeType, fileName, healthContext);
        if (fromPdf) return fromPdf;
      } catch (error) {
        this.logger.warn(`Vision analysis failed: ${error}`);
      }
    }

    return this.getDefaultAnalysis(fileName);
  }

  private async extractDocumentText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf' || buffer.slice(0, 5).toString() === '%PDF-') {
      return extractPdfText(buffer);
    }
    return '';
  }

  private async analyzeWithText(
    documentText: string,
    fileName: string,
    healthContext: string,
  ): Promise<ReportAnalysis | null> {
    const text = await this.llm.generateJson(
      WELLNESS_SYSTEM_PROMPT,
      `${REPORT_JSON_PROMPT}\n\nDocument: ${fileName}\nEmployee context (supplementary only — do not override document severity):\n${healthContext}\n\n--- REPORT TEXT ---\n${documentText.slice(0, 30000)}`,
    );
    return parseReportAnalysis(text);
  }

  private async analyzeWithVision(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    healthContext: string,
  ): Promise<ReportAnalysis | null> {
    const parts: Part[] = [];
    const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const effectiveMime = supported.includes(mimeType) ? mimeType : 'application/pdf';

    parts.push({
      inlineData: {
        mimeType: effectiveMime,
        data: buffer.toString('base64'),
      },
    });
    parts.push({
      text: `${REPORT_JSON_PROMPT}\n\nDocument: ${fileName}\nEmployee context (supplementary only — do not override document severity):\n${healthContext}`,
    });

    const text = await this.llm.generateWithParts(WELLNESS_SYSTEM_PROMPT, parts);
    const parsed = parseReportAnalysis(text);
    if (!parsed) {
      this.logger.warn(`Could not parse vision JSON for ${fileName}: ${text.slice(0, 200)}`);
    }
    return parsed;
  }

  private async loadReportContext(userId: string, documentId?: string): Promise<string | null> {
    if (!documentId) return null;

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) return null;

    const cached = doc.analysisSummary as unknown as ReportAnalysis | null;
    if (cached && !isFailedAnalysis(cached)) {
      return formatReportContextForChat(doc.fileName, cached);
    }

    return `Report file: ${doc.fileName} (not yet analyzed — ask the user to click Analyze first).`;
  }

  private getDefaultAnalysis(fileName: string): ReportAnalysis {
    return {
      summary: `I reviewed ${fileName} but could not extract detailed values. Please share key results or try re-uploading a clearer PDF.`,
      overallSeverity: 'moderate',
      priorityFindings: [],
      precautions: [
        'Share key lab values with your doctor if the PDF could not be read.',
        'Keep a copy of your report for your next appointment.',
      ],
      supplementsAndWellness: [],
      medicationsToDiscuss: [],
      sleep: {
        recommendation: 'Aim for 7–9 hours of consistent sleep nightly.',
        reason: 'Good sleep supports recovery and metabolic health.',
      },
      stress: {
        recommendation: 'Use 10-minute daily breathing or walking breaks.',
        reason: 'Stress management supports overall wellness markers.',
      },
      nutrition: {
        recommendation: 'Focus on whole foods, fiber, and adequate protein.',
        reason: 'Balanced nutrition supports healthy lab trends.',
      },
      actionItems: [
        'Discuss this report with your healthcare provider',
        'Track sleep and meals for 2 weeks and re-check in',
      ],
    };
  }

  private buildHealthContext(user: {
    firstName?: string | null;
    employee?: {
      healthCheckins: Array<{
        sleepHours?: number | null;
        mood?: string | null;
        stress?: string | null;
        exerciseMinutes?: number | null;
      }>;
      wellnessScores: Array<{ overallScore: number }>;
    } | null;
  } | null): string {
    if (!user?.employee) return 'No health data available yet.';

    const latest = user.employee.healthCheckins[0];
    const score = user.employee.wellnessScores[0];

    const parts = [`Name: ${user.firstName ?? 'Employee'}`];
    if (score) parts.push(`Latest wellness score: ${score.overallScore}/100`);
    if (latest) {
      if (latest.sleepHours) parts.push(`Last sleep: ${latest.sleepHours}h`);
      if (latest.mood) parts.push(`Last mood: ${latest.mood}`);
      if (latest.stress) parts.push(`Last stress: ${latest.stress}`);
      if (latest.exerciseMinutes) parts.push(`Last exercise: ${latest.exerciseMinutes} min`);
    }
    return parts.join('\n');
  }

  private buildDocumentContext(
    documents: Array<{ fileName: string; type: string; createdAt: Date }>,
  ): string {
    if (!documents.length) {
      return 'Uploaded documents: none yet. The employee can upload medical reports on the Documents page.';
    }
    const list = documents
      .map(
        (doc) =>
          `- ${doc.fileName} (${doc.type.replace(/_/g, ' ')}, uploaded ${doc.createdAt.toISOString().split('T')[0]})`,
      )
      .join('\n');
    return `Uploaded documents available for discussion:\n${list}\nSelect a report in the coach sidebar to analyze it for sleep, stress, and nutrition recommendations with severity flags.`;
  }

  private getFallbackResponse(message: string, name: string, reportContext?: string | null): string {
    const lower = message.toLowerCase();

    if (reportContext) {
      if (lower.includes('medicine') || lower.includes('medication') || lower.includes('drug')) {
        return `Hi ${name}! Based on your report, I can share what doctors commonly discuss for similar results — but only your physician can prescribe. Ask them which options fit your history. Would you like guidance on lifestyle steps first while you wait for your appointment?`;
      }
      if (lower.includes('precaution') || lower.includes('avoid') || lower.includes('should i')) {
        return `Hi ${name}! I have your report in context. Tell me which result concerns you most (e.g. cholesterol, blood sugar, blood pressure) and I'll give specific precautions and daily habits to follow. Always confirm with your doctor.`;
      }
      return `Hi ${name}! I have your medical report loaded. Ask me about specific results, precautions, supplements, or what to discuss with your doctor — I'll give tailored guidance based on your labs.`;
    }

    if (lower.includes('sleep')) {
      return `Hi ${name}! Getting 7-9 hours of quality sleep is essential for your wellness. Try maintaining a consistent bedtime routine and limiting screens before bed. How did you sleep last night?`;
    }
    if (lower.includes('stress') || lower.includes('anxious')) {
      return `I hear you, ${name}. Stress management is important. Try taking a few deep breaths, a short walk, or a 5-minute meditation. Remember, if stress feels overwhelming, speaking with a professional can help. How are you feeling right now?`;
    }
    if (lower.includes('water') || lower.includes('hydrat')) {
      return `Great reminder, ${name}! Aim for 2-3 liters of water daily. Keeping a water bottle at your desk makes it easier to stay hydrated throughout the day.`;
    }
    if (lower.includes('exercise') || lower.includes('workout')) {
      return `That's wonderful, ${name}! Regular exercise boosts both physical and mental health. Even 30 minutes of moderate activity daily makes a big difference. What type of exercise do you enjoy?`;
    }
    if (
      lower.includes('report') ||
      lower.includes('document') ||
      lower.includes('blood') ||
      lower.includes('upload')
    ) {
      return `Thanks ${name}! Upload your medical report on the Documents page, then tell me the key values or what you'd like help understanding. I'll provide general wellness guidance — always confirm important results with your doctor.`;
    }
    return `Hello ${name}! I'm your Nura wellness assistant. I can help with sleep tips, stress management, nutrition advice, exercise suggestions, and daily check-ins. What would you like to focus on today? Remember, I'm here for wellness guidance — always consult a doctor for medical concerns.`;
  }
}
