'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LeaveRequestPanel } from '@/components/hrm/leave-request-panel';
import { ActivityFeed } from '@/components/hrm/activity-feed';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { formatDuration, formatTime, LIVE_STATUS_LABELS } from '@/lib/attendance-utils';
import {
  LogIn,
  LogOut,
  Home,
  CheckCircle2,
  Coffee,
  Clock,
  PauseCircle,
} from 'lucide-react';

interface AttendanceSession {
  id: string;
  sessionNumber: number;
  checkInAt: string;
  checkOutAt?: string | null;
  isRemote: boolean;
  workingHours?: number | null;
}

interface TodayAttendance {
  id: string;
  date?: string;
  checkInAt?: string;
  checkOutAt?: string;
  firstCheckInAt?: string;
  lastCheckOutAt?: string;
  status: string;
  liveStatus?: string;
  isRemote: boolean;
  workingHours?: number;
  lateMinutes?: number;
  totalBreakMinutes?: number;
  sessionCount?: number;
  dayEndedAt?: string | null;
  sessions?: AttendanceSession[];
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  canEndDay?: boolean;
  currentSessionStart?: string | null;
}

interface Attendance {
  id: string;
  date?: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: string;
  workingHours?: number;
  sessionCount?: number;
}

export default function AttendancePage() {
  const { token } = useAuth();
  const [today, setToday] = useState<TodayAttendance | null | undefined>(undefined);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    api<TodayAttendance | null>('/hrm/attendance/today', { token })
      .then((r) => setToday(r.data ?? null))
      .catch(() => setToday(null));
    api<Attendance[]>('/hrm/attendance/history', { token }).then((r) => setHistory(r.data ?? []));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (endpoint: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await api(endpoint, { method: 'POST', token });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const checkIn = (remote = false) =>
    action(remote ? '/hrm/attendance/check-in/remote' : '/hrm/attendance/check-in');
  const checkOut = () => action('/hrm/attendance/check-out');
  const endDay = () => action('/hrm/attendance/end-day');

  const loadingToday = today === undefined;
  const onLeave = today?.status === 'ON_LEAVE' || today?.status === 'HALF_DAY';
  const liveStatus = today?.liveStatus ?? 'ABSENT';
  const sessions = today?.sessions ?? [];

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Attendance</h1>
          <p className="text-[var(--muted)]">
            Multiple check-in sessions per day — lunch breaks supported
          </p>
        </div>

        <Card title="Today's attendance">
          <p className="mb-4 text-sm text-[var(--muted)]">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          {loadingToday ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">Loading…</p>
          ) : onLeave ? (
            <div className="py-8 text-center">
              <p className="text-lg font-semibold text-[var(--foreground)]">
                You are on {today?.status === 'HALF_DAY' ? 'half-day leave' : 'leave'} today
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">Check-in is not required while on leave.</p>
            </div>
          ) : today?.dayEndedAt || liveStatus === 'CHECKED_OUT' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-lg font-semibold text-[var(--foreground)]">You&apos;re done for today</p>
              <p className="text-sm text-[var(--muted)]">
                {today?.workingHours?.toFixed(1)}h worked · {sessions.length} session
                {sessions.length !== 1 ? 's' : ''}
                {today?.totalBreakMinutes
                  ? ` · ${formatDuration(today.totalBreakMinutes)} break`
                  : ''}
              </p>
            </div>
          ) : today?.canCheckOut ? (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Session {sessions.length} — currently working
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {formatTime(today.currentSessionStart ?? today.checkInAt)}
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  {today?.isRemote ? 'Working from home' : 'At office'}
                  {today?.status === 'LATE' && ' · Late arrival'}
                </p>
              </div>
              <Button
                size="lg"
                onClick={checkOut}
                isLoading={loading}
                className="h-16 w-full max-w-md border-0 bg-slate-800 text-lg font-bold text-white shadow-md hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <LogOut className="mr-2 h-6 w-6" />
                Check Out
              </Button>
              <p className="text-center text-xs text-[var(--muted)]">
                Check out for lunch or a break — you can check in again later
              </p>
            </div>
          ) : today?.canCheckIn ? (
            <div className="flex flex-col items-center gap-4 py-6">
              {sessions.length > 0 && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <Coffee className="h-4 w-4" />
                  On break — ready to check in again?
                </div>
              )}
              <Button
                size="lg"
                onClick={() => checkIn(false)}
                isLoading={loading}
                className="h-16 w-full max-w-md text-lg font-bold shadow-md"
              >
                <LogIn className="mr-2 h-6 w-6" />
                {sessions.length > 0 ? 'Check In Again' : 'Check In'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => checkIn(true)}
                isLoading={loading}
                className="h-12 w-full max-w-md"
              >
                <Home className="mr-2 h-5 w-5" />
                Check in from home
              </Button>
              {today?.canEndDay && (
                <Button
                  variant="outline"
                  onClick={endDay}
                  isLoading={loading}
                  className="mt-2 w-full max-w-md"
                >
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Done for today
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <Button
                size="lg"
                onClick={() => checkIn(false)}
                isLoading={loading}
                className="h-16 w-full max-w-md text-lg font-bold shadow-md"
              >
                <LogIn className="mr-2 h-6 w-6" />
                Check In
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => checkIn(true)}
                isLoading={loading}
                className="h-12 w-full max-w-md"
              >
                <Home className="mr-2 h-5 w-5" />
                Check in from home
              </Button>
            </div>
          )}

          {sessions.length > 0 && !onLeave && (
            <div className="mt-6 border-t border-[var(--card-border)] pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <Clock className="h-4 w-4" />
                Today&apos;s sessions
              </h3>
              <ol className="space-y-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                  >
                    <span className="font-medium">
                      Session {s.sessionNumber}
                      {s.isRemote && (
                        <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">WFH</span>
                      )}
                    </span>
                    <span className="text-[var(--muted)]">
                      {formatTime(s.checkInAt)} → {s.checkOutAt ? formatTime(s.checkOutAt) : 'now'}
                      {s.workingHours != null && ` (${s.workingHours.toFixed(1)}h)`}
                    </span>
                  </li>
                ))}
              </ol>
              {today?.canEndDay && today?.canCheckIn && (
                <Button variant="outline" onClick={endDay} isLoading={loading} className="mt-4 w-full">
                  <PauseCircle className="mr-2 h-4 w-4" />
                  Done for today
                </Button>
              )}
            </div>
          )}
        </Card>

        {today && !onLeave && sessions.length > 0 && (
          <Card title="Today's summary">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[var(--muted)]">Status</dt>
                <dd className="font-medium">
                  {LIVE_STATUS_LABELS[liveStatus] ?? liveStatus.toLowerCase().replace(/_/g, ' ')}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">First in</dt>
                <dd>{formatTime(today.firstCheckInAt ?? today.checkInAt)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Sessions</dt>
                <dd>{today.sessionCount ?? sessions.length}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Hours / break</dt>
                <dd>
                  {today.workingHours?.toFixed(1) ?? '0'}h
                  {today.totalBreakMinutes ? ` · ${formatDuration(today.totalBreakMinutes)} break` : ''}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        <ActivityFeed token={token} />

        <Card
          title="Request time off"
          subtitle="Apply for leave, half-day, or work from home"
          action={
            <Link href="/leave" className="text-sm font-medium text-emerald-600 hover:underline">
              Full leave page
            </Link>
          }
        >
          <LeaveRequestPanel token={token} compact />
        </Card>

        <Card title="Recent history">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[var(--muted)]">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Sessions</th>
                  <th className="pb-2">In</th>
                  <th className="pb-2">Out</th>
                  <th className="pb-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--card-border)]">
                    <td className="py-2">{h.date ? new Date(h.date).toLocaleDateString() : '—'}</td>
                    <td className="py-2 capitalize">{h.status.toLowerCase().replace(/_/g, ' ')}</td>
                    <td className="py-2">{h.sessionCount ?? '—'}</td>
                    <td className="py-2">{h.checkInAt ? new Date(h.checkInAt).toLocaleTimeString() : '—'}</td>
                    <td className="py-2">{h.checkOutAt ? new Date(h.checkOutAt).toLocaleTimeString() : '—'}</td>
                    <td className="py-2">{h.workingHours?.toFixed(1) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <p className="py-4 text-sm text-[var(--muted)]">No attendance history yet.</p>
            )}
          </div>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
