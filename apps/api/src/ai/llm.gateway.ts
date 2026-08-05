import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, type Content, type Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { AgentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}

@Injectable()
export class LlmGateway {
  private readonly logger = new Logger(LlmGateway.name);
  private gemini: GoogleGenerativeAI | null = null;
  private geminiModel = 'gemini-2.5-flash';
  private openai: OpenAI | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
      this.geminiModel = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.gemini || this.openai);
  }

  async logUsage(userId: string, agentType: AgentType, companyId?: string, model?: string) {
    await this.prisma.aiUsageLog.create({
      data: { userId, agentType, companyId, model },
    });
  }

  toGeminiHistory(
    messages: Array<{ role: string; content: string }>,
    currentMessage: string,
  ): Content[] {
    const history: Content[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (role === 'user' && msg.content === currentMessage) continue;
      history.push({ role, parts: [{ text: msg.content }] });
    }
    return history;
  }

  async chat(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    message: string,
    contextSummary: string,
    options: {
      agentType: AgentType;
      userId: string;
      companyId?: string;
      maxTokens?: number;
      temperature?: number;
      fallback?: string;
    },
  ): Promise<string> {
    const fullSystem = `${systemPrompt}\n\nContext:\n${contextSummary}`;

    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: this.geminiModel,
          systemInstruction: fullSystem,
        });
        const chat = model.startChat({
          history: this.toGeminiHistory(messages, message),
          generationConfig: {
            maxOutputTokens: options.maxTokens ?? 1200,
            temperature: options.temperature ?? 0.7,
          },
        });
        const result = await chat.sendMessage(message);
        let text = '';
        try {
          text = result.response.text()?.trim() ?? '';
        } catch {
          text = '';
        }
        await this.logUsage(options.userId, options.agentType, options.companyId, this.geminiModel);
        return stripMarkdown(text) || options.fallback || '';
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown Gemini error';
        this.logger.warn(`Gemini request failed: ${reason}`);
      }
    }

    if (this.openai) {
      try {
        const history = messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));
        const lastHistory = history[history.length - 1];
        const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: fullSystem },
          ...history,
        ];
        if (!(lastHistory?.role === 'user' && lastHistory.content === message)) {
          chatMessages.push({ role: 'user', content: message });
        }
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: chatMessages,
          max_tokens: options.maxTokens ?? 800,
          temperature: options.temperature ?? 0.7,
        });
        await this.logUsage(options.userId, options.agentType, options.companyId, 'gpt-4o-mini');
        return stripMarkdown(
          response.choices[0]?.message?.content?.trim() || options.fallback || '',
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown OpenAI error';
        this.logger.warn(`OpenAI request failed: ${reason}`);
      }
    }

    return options.fallback || 'AI is not configured. Please add GEMINI_API_KEY or OPENAI_API_KEY.';
  }

  async generateJson(
    systemPrompt: string,
    prompt: string,
    options: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    if (this.gemini) {
      const model = this.gemini.getGenerativeModel({
        model: this.geminiModel,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: options.maxTokens ?? 8192,
          temperature: options.temperature ?? 0.3,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(prompt);
      return result.response.text()?.trim() ?? '';
    }

    if (this.openai) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.3,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content?.trim() ?? '';
    }

    return '';
  }

  async generateWithParts(
    systemPrompt: string,
    parts: Part[],
    options: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    if (!this.gemini) return '';
    const model = this.gemini.getGenerativeModel({
      model: this.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 8192,
        temperature: options.temperature ?? 0.3,
        responseMimeType: 'application/json',
      },
    });
    const result = await model.generateContent(parts);
    return result.response.text()?.trim() ?? '';
  }
}
