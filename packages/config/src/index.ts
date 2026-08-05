export const APP_NAME = 'Nura';

export const API_PREFIX = 'api/v1';

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export const SUBSCRIPTION_LIMITS = {
  FREE: { maxEmployees: 10, analytics: false, reports: false, aiInsights: false },
  PRO: { maxEmployees: Infinity, analytics: true, reports: true, aiInsights: true },
  ENTERPRISE: { maxEmployees: Infinity, analytics: true, reports: true, aiInsights: true },
} as const;

export const WELLNESS_DISCLAIMER =
  'Nura provides wellness guidance only. It does not diagnose diseases or replace professional medical advice.';
