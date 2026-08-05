export const LIVE_STATUS_LABELS: Record<string, string> = {
  WORKING: 'Working',
  ON_BREAK: 'On break',
  CHECKED_OUT: 'Done for today',
  ABSENT: 'Absent',
  ON_LEAVE: 'On leave',
  REMOTE: 'Remote',
};

export const LIVE_STATUS_COLORS: Record<string, string> = {
  WORKING: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ON_BREAK: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CHECKED_OUT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ON_LEAVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  REMOTE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
