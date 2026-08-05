export type SeverityLevel = 'low' | 'moderate' | 'high';

export interface ReportFinding {
  finding: string;
  severity: SeverityLevel;
  needsAttention: boolean;
}

export interface WellnessSection {
  recommendation: string;
  reason: string;
}

export interface WellnessItem {
  item: string;
  purpose: string;
  note: string;
}

export interface ReportAnalysis {
  summary: string;
  overallSeverity: SeverityLevel;
  priorityFindings: ReportFinding[];
  sleep: WellnessSection;
  stress: WellnessSection;
  nutrition: WellnessSection;
  precautions: string[];
  supplementsAndWellness: WellnessItem[];
  medicationsToDiscuss: WellnessItem[];
  actionItems: string[];
}

const DEFAULT_SLEEP: WellnessSection = {
  recommendation: 'Maintain 7–9 hours of consistent sleep nightly.',
  reason: 'Supports recovery, mood, and metabolic health.',
};

const DEFAULT_STRESS: WellnessSection = {
  recommendation: 'Use 10-minute daily breathing or walking breaks.',
  reason: 'Helps keep stress hormones balanced.',
};

const DEFAULT_NUTRITION: WellnessSection = {
  recommendation: 'Eat balanced meals with lean protein, fiber, and healthy fats.',
  reason: 'Supports stable energy and healthy lab markers.',
};

const DEFAULT_PRECAUTIONS = [
  'Follow your physician’s annual screening schedule.',
  'Seek medical care promptly if new symptoms appear.',
];

export function isFailedAnalysis(analysis: ReportAnalysis): boolean {
  return analysis.summary.toLowerCase().includes('could not extract');
}

export function formatReportContextForChat(fileName: string, analysis: ReportAnalysis): string {
  const findings =
    (analysis.priorityFindings ?? []).map((f) => `- ${f.finding} (${f.severity})`).join('\n') ||
    '- All reviewed values within normal range';

  const precautions = (analysis.precautions ?? []).map((p) => `- ${p}`).join('\n');
  const supplements = (analysis.supplementsAndWellness ?? [])
    .map((s) => `- ${s.item}: ${s.purpose} (${s.note})`)
    .join('\n');
  const meds = (analysis.medicationsToDiscuss ?? [])
    .map((m) => `- ${m.item}: ${m.purpose} (${m.note})`)
    .join('\n');

  return `ACTIVE MEDICAL REPORT: ${fileName}
Overall severity: ${analysis.overallSeverity}
Summary: ${analysis.summary}

Key findings:
${findings}

Current guidance already given:
- Sleep: ${analysis.sleep.recommendation}
- Stress: ${analysis.stress.recommendation}
- Nutrition: ${analysis.nutrition.recommendation}

Precautions:
${precautions || '- Maintain healthy habits and routine check-ups'}

Wellness supplements & habits to consider:
${supplements || '- Balanced diet, hydration, regular exercise'}

Topics to discuss with your doctor (not prescriptions):
${meds || '- Continue routine follow-up as needed'}

Priority actions:
${analysis.actionItems.map((a) => `- ${a}`).join('\n')}`;
}

export function formatAnalysisMessage(fileName: string, analysis: ReportAnalysis): string {
  const severityLabel = analysis.overallSeverity.toUpperCase();
  const findings = analysis.priorityFindings
    .map(
      (f) =>
        `• ${f.finding} [${f.severity.toUpperCase()}${f.needsAttention ? ' — needs attention' : ''}]`,
    )
    .join('\n');

  const findingsBlock =
    findings ||
    '• All reviewed lab values and vitals are within normal ranges — excellent baseline health.';

  const precautionsBlock =
    (analysis.precautions ?? []).map((p) => `• ${p}`).join('\n') ||
    '• Maintain routine health habits and annual screening.';

  const supplementsBlock = (analysis.supplementsAndWellness ?? [])
    .map((s) => `• ${s.item} — ${s.purpose}`)
    .join('\n');

  const medsBlock = (analysis.medicationsToDiscuss ?? [])
    .map((m) => `• ${m.item} — ${m.purpose}`)
    .join('\n');

  let message = `Report review: ${fileName}
Overall wellness concern level: ${severityLabel}

${analysis.summary}

Key findings
${findingsBlock}

Precautions
${precautionsBlock}`;

  if (supplementsBlock) {
    message += `\n\nWellness supplements & habits\n${supplementsBlock}`;
  }
  if (medsBlock) {
    message += `\n\nDiscuss with your doctor\n${medsBlock}`;
  }

  message += `

Sleep — ${analysis.sleep.recommendation}
${analysis.sleep.reason}

Stress — ${analysis.stress.recommendation}
${analysis.stress.reason}

Nutrition — ${analysis.nutrition.recommendation}
${analysis.nutrition.reason}

Priority actions
${analysis.actionItems.map((a) => `• ${a}`).join('\n')}

Reminder: This is wellness coaching based on your report, not a medical diagnosis. Please review these findings with your doctor.`;

  return message;
}

function normalizeWellnessSection(
  section: Partial<WellnessSection> | undefined,
  fallback: WellnessSection,
): WellnessSection {
  if (!section?.recommendation?.trim()) return fallback;
  return {
    recommendation: section.recommendation.trim(),
    reason: section.reason?.trim() || fallback.reason,
  };
}

function normalizeWellnessItems(
  items: Partial<WellnessItem>[] | undefined,
  fallback: WellnessItem[],
): WellnessItem[] {
  const normalized = (items ?? [])
    .filter((i) => i?.item?.trim())
    .map((i) => ({
      item: i!.item!.trim(),
      purpose: i!.purpose?.trim() || 'General wellness support',
      note: i!.note?.trim() || 'Discuss with your doctor before starting',
    }));
  return normalized.length ? normalized : fallback;
}

export function parseReportAnalysis(raw: string): ReportAnalysis | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const data = JSON.parse(cleaned) as Partial<ReportAnalysis>;
    if (!data.summary || !data.overallSeverity) return null;

    const findings = (data.priorityFindings ?? [])
      .filter((f) => f?.finding)
      .map((f) => ({
        finding: f!.finding,
        severity: normalizeSeverity(String(f!.severity)),
        needsAttention: Boolean(f!.needsAttention),
      }));

    const severity = computeOverallSeverity(
      findings,
      normalizeSeverity(String(data.overallSeverity)),
    );
    const isHealthy = severity === 'low' && findings.every((f) => !f.needsAttention);

    return {
      summary: data.summary.trim(),
      overallSeverity: severity,
      priorityFindings: findings,
      sleep: normalizeWellnessSection(data.sleep, DEFAULT_SLEEP),
      stress: normalizeWellnessSection(data.stress, DEFAULT_STRESS),
      nutrition: normalizeWellnessSection(data.nutrition, DEFAULT_NUTRITION),
      precautions:
        data.precautions?.filter(Boolean).length
          ? (data.precautions!.filter(Boolean) as string[])
          : isHealthy
            ? [
                'Continue annual health screening.',
                'Stay hydrated and limit processed foods.',
                'Report any new symptoms to your doctor promptly.',
              ]
            : DEFAULT_PRECAUTIONS,
      supplementsAndWellness: normalizeWellnessItems(data.supplementsAndWellness, isHealthy
        ? [
            {
              item: 'Omega-3 (fish oil)',
              purpose: 'Supports heart health alongside healthy cholesterol levels',
              note: 'Optional — confirm with your doctor if you take blood thinners',
            },
            {
              item: 'Vitamin D',
              purpose: 'Supports bone and immune health',
              note: 'Ask your doctor about dosage based on your levels',
            },
          ]
        : []),
      medicationsToDiscuss: normalizeWellnessItems(data.medicationsToDiscuss, isHealthy
        ? [
            {
              item: 'No medication needed now',
              purpose: 'Labs are within normal range — focus on lifestyle maintenance',
              note: 'Only your physician can prescribe or change medications',
            },
          ]
        : []),
      actionItems:
        data.actionItems?.filter(Boolean).length
          ? (data.actionItems!.filter(Boolean) as string[])
          : ['Continue annual health screening as recommended by your physician'],
    };
  } catch {
    return null;
  }
}

function normalizeSeverity(value: string): SeverityLevel {
  const v = value?.toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'moderate' || v === 'medium') return 'moderate';
  return 'low';
}

function computeOverallSeverity(
  findings: ReportFinding[],
  stated: SeverityLevel,
): SeverityLevel {
  const rank: Record<SeverityLevel, number> = { low: 0, moderate: 1, high: 2 };
  let max = rank[stated] ?? 0;
  for (const f of findings) {
    max = Math.max(max, rank[f.severity] ?? 0);
    if (f.needsAttention) max = Math.max(max, 1);
  }
  if (max >= 2) return 'high';
  if (max >= 1) return 'moderate';
  return 'low';
}
