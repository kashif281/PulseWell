'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { ActivityFeed } from '@/components/hrm/activity-feed';
import { api, getStoredToken } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  LIVE_STATUS_COLORS,
  LIVE_STATUS_LABELS,
  formatDuration,
  formatTime,
} from '@/lib/attendance-utils';
import { Users, Search, RefreshCw } from 'lucide-react';

interface PresenceMember {
  employeeId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  department: string | null;
  position?: string | null;
  liveStatus: string;
  isRemote: boolean;
  currentSessionStart?: string | null;
  firstCheckInToday?: string | null;
  sessionCount: number;
  workingHours: number;
  totalBreakMinutes: number;
}

interface PresenceData {
  date: string;
  counts: {
    working: number;
    remote: number;
    onBreak: number;
    checkedOut: number;
    onLeave: number;
    absent: number;
  };
  departments: string[];
  members: PresenceMember[];
  presenceVisibility?: string;
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'WORKING', label: 'Working' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'ON_BREAK', label: 'On break' },
  { value: 'CHECKED_OUT', label: 'Done' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'ABSENT', label: 'Absent' },
];

export default function TeamPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PresenceData | null>(null);
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    const q = params.toString() ? `?${params}` : '';
    api<PresenceData>(`/hrm/attendance/presence${q}`, { token })
      .then((r) => setData(r.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token, department, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const accessToken = token ?? getStoredToken();
    if (!accessToken) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    const streamUrl = apiBase.startsWith('/')
      ? `${apiBase}/hrm/attendance/stream?token=${encodeURIComponent(accessToken)}`
      : `${apiBase}/hrm/attendance/stream?token=${encodeURIComponent(accessToken)}`;

    const es = new EventSource(streamUrl);
    es.onmessage = () => load();
    return () => es.close();
  }, [token, load]);

  const counts = data?.counts;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Who&apos;s Working</h1>
            <p className="text-[var(--muted)]">
              Live team presence
              {data?.presenceVisibility && (
                <span className="ml-1 text-xs">
                  · Visibility: {data.presenceVisibility.toLowerCase()}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { key: 'working', label: 'Working', color: 'text-emerald-600' },
            { key: 'remote', label: 'Remote', color: 'text-purple-600' },
            { key: 'onBreak', label: 'On break', color: 'text-amber-600' },
            { key: 'checkedOut', label: 'Done', color: 'text-slate-600' },
            { key: 'onLeave', label: 'On leave', color: 'text-blue-600' },
            { key: 'absent', label: 'Absent', color: 'text-red-600' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setStatus(
                  key === 'working'
                    ? 'WORKING'
                    : key === 'remote'
                      ? 'REMOTE'
                      : key === 'onBreak'
                        ? 'ON_BREAK'
                        : key === 'checkedOut'
                          ? 'CHECKED_OUT'
                          : key === 'onLeave'
                            ? 'ON_LEAVE'
                            : 'ABSENT',
                )
              }
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-3 text-left hover:border-emerald-300"
            >
              <p className={`text-2xl font-bold ${color}`}>
                {counts ? counts[key as keyof typeof counts] : '—'}
              </p>
              <p className="text-xs text-[var(--muted)]">{label}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              placeholder="Search by name or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">All departments</option>
            {data?.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <Card title={`Team (${data?.members.length ?? 0})`}>
          {!data?.members.length ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No team members match your filters.
            </p>
          ) : (
            <div className="divide-y divide-[var(--card-border)]">
              {data.members.map((m) => (
                <div key={m.employeeId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {m.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--foreground)]">{m.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {m.department ?? 'No department'}
                      {m.position ? ` · ${m.position}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        LIVE_STATUS_COLORS[m.liveStatus] ?? LIVE_STATUS_COLORS.ABSENT
                      }`}
                    >
                      {LIVE_STATUS_LABELS[m.liveStatus] ?? m.liveStatus}
                    </span>
                    {m.liveStatus === 'WORKING' || m.liveStatus === 'REMOTE' ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Since {formatTime(m.currentSessionStart ?? m.firstCheckInToday)}
                      </p>
                    ) : m.liveStatus === 'ON_BREAK' ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {m.workingHours.toFixed(1)}h so far · break{' '}
                        {formatDuration(m.totalBreakMinutes)}
                      </p>
                    ) : m.firstCheckInToday ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        In {formatTime(m.firstCheckInToday)} · {m.sessionCount} sessions
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <ActivityFeed token={token} />
      </div>
    </ProtectedLayout>
  );
}
