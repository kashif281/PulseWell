import type { LearningDifficulty } from '@prisma/client';

export interface QuizQuestion {
  number: number;
  question: string;
  options: string[];
  answer: string;
}

export interface QuizDraft {
  topic: string;
  difficulty: LearningDifficulty;
  questions: QuizQuestion[];
}

export interface CodeChallengeDraft {
  title: string;
  topic: string;
  difficulty: LearningDifficulty;
  language: string;
  prompt: string;
  starterCode: string;
}

const QUIZ_BLOCK_REGEX = /---QUIZ_DRAFT---([\s\S]*?)---END---/i;
const CODE_BLOCK_REGEX = /---CODE_CHALLENGE---([\s\S]*?)---END---/i;

export function isQuizIntent(message: string): boolean {
  const t = message.toLowerCase();
  return /\b(quiz|practice questions?|test me|mcq)\b/.test(t);
}

export function isCodeChallengeIntent(message: string): boolean {
  const t = message.toLowerCase();
  return /\b(coding challenge|code challenge|practice problem|leetcode)\b/.test(t);
}

export function isMockInterviewIntent(message: string): boolean {
  const t = message.toLowerCase();
  return /\b(mock interview|start (a )?interview|technical interview)\b/.test(t);
}

export function isStudyPlanIntent(message: string): boolean {
  const t = message.toLowerCase();
  return /\b(study plan|learning path|what should i learn|recommend)\b/.test(t);
}

export function parseQuizBlock(text: string): { message: string; quiz?: QuizDraft } {
  const match = text.match(QUIZ_BLOCK_REGEX);
  if (!match) return { message: text };
  const block = match[1].trim();
  const message = text.replace(QUIZ_BLOCK_REGEX, '').trim();
  const topic = readField(block, 'TOPIC') ?? 'General';
  const difficulty = normalizeDifficulty(readField(block, 'DIFFICULTY'));
  const questions = parseQuestions(block);
  if (!questions.length) return { message: text };
  return { message, quiz: { topic, difficulty, questions } };
}

export function parseCodeChallengeBlock(text: string): {
  message: string;
  challenge?: CodeChallengeDraft;
} {
  const match = text.match(CODE_BLOCK_REGEX);
  if (!match) return { message: text };
  const block = match[1].trim();
  const message = text.replace(CODE_BLOCK_REGEX, '').trim();
  const starterMarker = block.match(/STARTER_CODE:\s*/i);
  let starterCode = 'function solve(input) {\n  \n}';
  let headerBlock = block;
  if (starterMarker && starterMarker.index !== undefined) {
    starterCode = block.slice(starterMarker.index + starterMarker[0].length).trim();
    headerBlock = block.slice(0, starterMarker.index);
  }
  const title = readField(headerBlock, 'TITLE');
  const topic = readField(headerBlock, 'TOPIC') ?? 'General';
  const prompt = readField(headerBlock, 'PROMPT');
  if (!title || !prompt) return { message: text };
  return {
    message,
    challenge: {
      title,
      topic,
      difficulty: normalizeDifficulty(readField(headerBlock, 'DIFFICULTY')),
      language: readField(headerBlock, 'LANGUAGE') ?? 'javascript',
      prompt,
      starterCode,
    },
  };
}

function parseQuestions(block: string): QuizQuestion[] {
  const questionsSection = block.split(/QUESTIONS:\s*/i)[1];
  if (!questionsSection) return [];

  const chunks = questionsSection.split(/\n(?=\d+\.\s)/).filter(Boolean);
  const questions: QuizQuestion[] = [];

  for (const chunk of chunks) {
    const numberMatch = chunk.match(/^(\d+)\.\s*(.+)/s);
    if (!numberMatch) continue;
    const number = parseInt(numberMatch[1], 10);
    const body = numberMatch[2];
    const answerMatch = body.match(/ANSWER:\s*([A-D])/i);
    const answer = answerMatch?.[1]?.toUpperCase() ?? 'A';
    const qText = body.split(/\n[A-D]\)/)[0].trim();
    const options = [...body.matchAll(/\n([A-D])\)\s*(.+)/g)].map((m) => `${m[1]}) ${m[2].trim()}`);
    if (qText && options.length) {
      questions.push({ number, question: qText, options, answer });
    }
  }
  return questions;
}

function readField(block: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'im');
  return block.match(re)?.[1]?.trim();
}

function normalizeDifficulty(value?: string): LearningDifficulty {
  const upper = (value ?? 'MEDIUM').toUpperCase();
  if (upper === 'EASY') return 'EASY';
  if (upper === 'HARD') return 'HARD';
  if (upper === 'EXPERT') return 'EXPERT';
  return 'MEDIUM';
}
