import type { HrPolicyDraft } from './ai-agent.types';
import { PolicyCategory } from '@prisma/client';

const DRAFT_BLOCK_REGEX = /---POLICY_DRAFT---([\s\S]*?)---END---/i;

export function isSaveToPoliciesIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\b(create|draft|write|generate|make|update|revise)\b/.test(t) && !/\b(save|publish|add|store)\b/.test(t)) {
    return false;
  }
  return (
    /\b(save|publish|add|store)\b/.test(t) &&
    /\bpolic(y|ies)|handbook\b/.test(t) &&
    (/\bto\b/.test(t) || /\bthis\b/.test(t) || /^publish\b/.test(t) || /^save\b/.test(t))
  );
}

export function parsePolicyDraftBlock(text: string): {
  message: string;
  draft?: HrPolicyDraft;
} {
  const match = text.match(DRAFT_BLOCK_REGEX);
  if (!match) return { message: text };

  const block = match[1].trim();
  const draft = parseDraftPayload(block);
  const message = text.replace(DRAFT_BLOCK_REGEX, '').trim();

  if (draft) return { message, draft };
  return { message: text };
}

function parseDraftPayload(block: string): HrPolicyDraft | undefined {
  const fromJson = tryParseJsonDraft(block);
  if (fromJson) return fromJson;

  const fromDelimited = tryParseDelimitedDraft(block);
  if (fromDelimited) return fromDelimited;

  return undefined;
}

function tryParseJsonDraft(block: string): HrPolicyDraft | undefined {
  try {
    const parsed = JSON.parse(block) as HrPolicyDraft;
    if (parsed?.title && parsed?.content) return normalizeDraft(parsed);
  } catch {
    const repaired = repairJsonDraft(block);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired) as HrPolicyDraft;
        if (parsed?.title && parsed?.content) return normalizeDraft(parsed);
      } catch {
        // fall through
      }
    }
  }
  return undefined;
}

function repairJsonDraft(block: string): string | null {
  const title = block.match(/"title"\s*:\s*"([^"]+)"/)?.[1];
  const category = block.match(/"category"\s*:\s*"([^"]+)"/)?.[1];
  const version = block.match(/"version"\s*:\s*"([^"]+)"/)?.[1];
  const effectiveDate = block.match(/"effectiveDate"\s*:\s*"([^"]+)"/)?.[1];
  const contentMatch = block.match(/"content"\s*:\s*"([\s\S]*)"\s*\}?$/);
  if (!title || !contentMatch) return null;

  const content = contentMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  return JSON.stringify({
    title,
    category: category ?? 'GENERAL',
    content,
    version: version ?? '1.0',
    effectiveDate: effectiveDate ?? new Date().toISOString().slice(0, 10),
  });
}

function tryParseDelimitedDraft(block: string): HrPolicyDraft | undefined {
  const title = readField(block, 'TITLE');
  const category = readField(block, 'CATEGORY') ?? 'GENERAL';
  const version = readField(block, 'VERSION') ?? '1.0';
  const effectiveDate =
    readField(block, 'EFFECTIVE_DATE') ?? readField(block, 'EFFECTIVE') ?? undefined;

  let content = '';
  const contentMarker = block.match(/CONTENT:\s*/i);
  if (contentMarker && contentMarker.index !== undefined) {
    content = block.slice(contentMarker.index + contentMarker[0].length).trim();
  }

  if (!title || !content) return undefined;

  return normalizeDraft({ title, category, content, version, effectiveDate });
}

function readField(block: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'im');
  const match = block.match(re);
  return match?.[1]?.trim();
}

function normalizeDraft(draft: HrPolicyDraft): HrPolicyDraft {
  return {
    title: draft.title.trim(),
    category: draft.category?.trim().toUpperCase() || 'GENERAL',
    content: draft.content.trim(),
    version: draft.version?.trim() || '1.0',
    effectiveDate: draft.effectiveDate?.trim() || new Date().toISOString().slice(0, 10),
  };
}

export function extractDraftFromMessages(
  messages: Array<{ role: string; content: string }>,
): HrPolicyDraft | undefined {
  const assistants = [...messages].reverse().filter((m) => m.role === 'assistant');
  for (const msg of assistants) {
    if (isNonPolicyAssistantMessage(msg.content)) continue;
    const { draft } = parsePolicyDraftBlock(msg.content);
    if (draft) return draft;
    const inferred = inferDraftFromPolicyText(msg.content);
    if (inferred) return inferred;
  }
  return undefined;
}

function isNonPolicyAssistantMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('maximum call stack') ||
    lower.includes('first ask me to draft') ||
    lower.includes('sorry, i encountered an error') ||
    lower.includes('done! i saved') ||
    lower.includes('i am your hr ai assistant') ||
    lower.includes('i can help draft company policies') ||
    text.length < 80
  );
}

export function inferDraftFromPolicyText(text?: string): HrPolicyDraft | undefined {
  if (!text || text.length < 120) return undefined;
  if (isNonPolicyAssistantMessage(text)) return undefined;

  const lower = text.toLowerCase();
  const looksLikePolicy =
    lower.includes('policy') ||
    lower.includes('employees shall') ||
    lower.includes('employees must') ||
    /^\d+\.\s/m.test(text);

  if (!looksLikePolicy) return undefined;

  const titleLine =
    text.match(/^([A-Z][^\n]{8,80}(?:Policy|Handbook|Guidelines|Standards))/m)?.[1] ??
    text.match(/^([^\n]{10,80})/)?.[1];

  let category = 'GENERAL';
  if (/attendance|check[- ]?in|office hours/i.test(text)) category = 'ATTENDANCE';
  else if (/leave|vacation|pto/i.test(text)) category = 'LEAVE';
  else if (/work from home|wfh|remote work/i.test(text)) category = 'WFH';
  else if (/conduct|behavior|ethics/i.test(text)) category = 'CONDUCT';
  else if (/safety|hazard/i.test(text)) category = 'SAFETY';
  else if (/equipment|laptop|asset/i.test(text)) category = 'EQUIPMENT';

  return normalizeDraft({
    title: titleLine?.trim() || 'Company Policy',
    category,
    content: text.trim(),
    version: '1.0',
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
}

export function normalizePolicyCategory(category: string): PolicyCategory {
  const upper = category.toUpperCase() as PolicyCategory;
  const valid = Object.values(PolicyCategory);
  return valid.includes(upper) ? upper : PolicyCategory.GENERAL;
}

export function extractDraftFromMetadata(metadata: unknown): HrPolicyDraft | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const draft = (metadata as { draftPolicy?: HrPolicyDraft }).draftPolicy;
  if (draft?.title && draft?.content) return normalizeDraft(draft);
  return undefined;
}
