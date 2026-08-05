import { LearningTrack } from '@prisma/client';

export const ROLE_TRACK_TOPICS: Record<LearningTrack, string[]> = {
  ENGINEERING: [
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Node.js',
    'NestJS',
    'System Design',
    'SQL',
    'Docker',
    'Git',
    'Data Structures & Algorithms',
    'Testing',
    'Clean Architecture',
    'Design Patterns',
    'AI Development',
  ],
  FINANCE: [
    'Financial Accounting',
    'Budgeting',
    'Payroll',
    'Taxation',
    'Financial Reporting',
    'Excel',
    'Power BI',
    'Business Analytics',
    'Corporate Finance',
    'Risk Management',
  ],
  HR: [
    'Recruitment',
    'Interviewing',
    'Labor Laws',
    'Payroll',
    'Employee Relations',
    'Performance Management',
    'Workplace Policies',
    'Leadership',
  ],
  MARKETING: [
    'SEO',
    'Digital Marketing',
    'Google Ads',
    'Social Media',
    'Branding',
    'Analytics',
    'Copywriting',
  ],
  SALES: [
    'CRM',
    'Negotiation',
    'Sales Psychology',
    'Prospecting',
    'Closing Techniques',
    'Communication',
  ],
  GENERAL: [
    'Professional Communication',
    'Time Management',
    'Problem Solving',
    'Team Collaboration',
    'Presentation Skills',
  ],
};

const DEPT_TRACK_MAP: Record<string, LearningTrack> = {
  engineering: LearningTrack.ENGINEERING,
  software: LearningTrack.ENGINEERING,
  development: LearningTrack.ENGINEERING,
  tech: LearningTrack.ENGINEERING,
  it: LearningTrack.ENGINEERING,
  finance: LearningTrack.FINANCE,
  accounting: LearningTrack.FINANCE,
  hr: LearningTrack.HR,
  'human resources': LearningTrack.HR,
  marketing: LearningTrack.MARKETING,
  sales: LearningTrack.SALES,
};

export function resolveLearningTrack(departmentName?: string | null, position?: string | null): LearningTrack {
  const haystack = `${departmentName ?? ''} ${position ?? ''}`.toLowerCase();
  for (const [key, track] of Object.entries(DEPT_TRACK_MAP)) {
    if (haystack.includes(key)) return track;
  }
  return LearningTrack.GENERAL;
}

export function getRecommendedTopics(track: LearningTrack): string[] {
  return ROLE_TRACK_TOPICS[track] ?? ROLE_TRACK_TOPICS.GENERAL;
}
