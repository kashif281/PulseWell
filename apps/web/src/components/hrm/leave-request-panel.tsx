'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { CalendarPlus, Home, Sun } from 'lucide-react';

export type LeaveRequestMode = 'full' | 'half' | 'wfh';

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

interface Balance {
  id: string;
  remaining: number;
  allocated: number;
  leaveType: LeaveType;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  isHalfDay?: boolean;
  halfDayType?: string | null;
  reason?: string;
  leaveType: LeaveType;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function formatRequestDates(r: LeaveRequest) {
  const start = new Date(r.startDate).toLocaleDateString();
  const end = new Date(r.endDate).toLocaleDateString();
  if (r.isHalfDay) {
    const half =
      r.halfDayType === 'FIRST_HALF' ? 'Morning' : r.halfDayType === 'SECOND_HALF' ? 'Afternoon' : 'Half day';
    return `${start} (${half})`;
  }
  if (start === end) return start;
  return `${start} – ${end}`;
}

const MODE_LABELS: Record<LeaveRequestMode, { title: string; subtitle: string; submit: string }> = {
  full: {
    title: 'Apply leave',
    subtitle: 'Request full-day leave for one or more days',
    submit: 'Submit leave request',
  },
  half: {
    title: 'Apply half-day leave',
    subtitle: 'Request a morning or afternoon off',
    submit: 'Submit half-day request',
  },
  wfh: {
    title: 'Work from home',
    subtitle: 'Request to work remotely for a day',
    submit: 'Submit WFH request',
  },
};

export function LeaveRequestPanel({
  token,
  initialMode = 'full',
  compact = false,
}: {
  token: string | null;
  initialMode?: LeaveRequestMode;
  compact?: boolean;
}) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<LeaveRequestMode>(initialMode);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: todayIso(),
    endDate: todayIso(),
    halfDayType: 'FIRST_HALF' as 'FIRST_HALF' | 'SECOND_HALF',
    reason: '',
  });

  const load = () => {
    if (!token) return;
    api<LeaveType[]>('/hrm/leave/types', { token }).then((r) => {
      setTypes(r.data ?? []);
    });
    api<Balance[]>('/hrm/leave/balances', { token }).then((r) => setBalances(r.data ?? []));
    api<LeaveRequest[]>('/hrm/leave/requests/me', { token }).then((r) => setRequests(r.data ?? []));
  };

  useEffect(() => {
    load();
  }, [token]);

  const openModal = (nextMode: LeaveRequestMode) => {
    setMode(nextMode);
    setError('');
    setForm({
      leaveTypeId: '',
      startDate: todayIso(),
      endDate: todayIso(),
      halfDayType: 'FIRST_HALF',
      reason: '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setError('');
  };

  useEffect(() => {
    if (!modalOpen || !types.length) return;
    if (mode === 'wfh') {
      const wfh = types.find((t) => t.code === 'WFH');
      setForm((f) => ({
        ...f,
        leaveTypeId: wfh?.id ?? types[0].id,
        startDate: todayIso(),
        endDate: todayIso(),
      }));
    } else if (mode === 'half') {
      const preferred =
        types.find((t) => t.code === 'CASUAL') ??
        types.find((t) => t.code === 'ANNUAL') ??
        types[0];
      setForm((f) => ({
        ...f,
        leaveTypeId: preferred.id,
        startDate: todayIso(),
        endDate: todayIso(),
      }));
    } else {
      const preferred =
        types.find((t) => t.code === 'ANNUAL') ??
        types.find((t) => !['WFH', 'UNPAID'].includes(t.code)) ??
        types[0];
      setForm((f) => ({ ...f, leaveTypeId: preferred.id, startDate: todayIso(), endDate: todayIso() }));
    }
  }, [mode, types, modalOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        leaveTypeId: mode === 'wfh' ? (wfhType?.id ?? form.leaveTypeId) : form.leaveTypeId,
        startDate: form.startDate,
        endDate: mode === 'half' || mode === 'wfh' ? form.startDate : form.endDate,
        reason: form.reason || undefined,
      };
      if (mode === 'half') {
        body.isHalfDay = true;
        body.halfDayType = form.halfDayType;
      }
      await api('/hrm/leave/requests', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      const successMessage =
        mode === 'wfh'
          ? 'Work from home request submitted'
          : mode === 'half'
            ? 'Half-day leave request submitted'
            : 'Leave request submitted';
      toast.success(successMessage);
      closeModal();
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const regularTypes = types.filter((t) => t.code !== 'WFH');
  const wfhType = types.find((t) => t.code === 'WFH');
  const wfhBalance = balances.find((b) => b.leaveType.code === 'WFH');
  const labels = MODE_LABELS[mode];

  const modeButtons = (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { id: 'full' as const, label: 'Full day' },
          { id: 'half' as const, label: 'Half day' },
          { id: 'wfh' as const, label: 'WFH' },
        ] as const
      ).map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setMode(m.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === m.id
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openModal('full')}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Apply leave
        </Button>
        {!compact && (
          <>
            <Button variant="outline" onClick={() => openModal('half')}>
              <Sun className="mr-2 h-4 w-4" />
              Half day
            </Button>
            <Button variant="outline" onClick={() => openModal('wfh')}>
              <Home className="mr-2 h-4 w-4" />
              Work from home
            </Button>
          </>
        )}
      </div>

      {!compact && requests.length > 0 && (
        <div className="border-t border-[var(--card-border)] pt-4">
          <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Recent requests</p>
          <div className="space-y-2">
            {requests.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{r.leaveType.name}</p>
                  <p className="text-[var(--muted)]">{formatRequestDates(r)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize dark:bg-slate-800">
                  {r.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={labels.title} subtitle={labels.subtitle}>
        {modeButtons}

        {mode === 'wfh' && wfhBalance && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            WFH balance: <strong>{wfhBalance.remaining}</strong> of {wfhBalance.allocated} days left
          </p>
        )}

        {mode === 'wfh' && !wfhType && (
          <p className="mt-4 text-sm text-amber-600">
            Work from home leave type is not set up for your company yet.
          </p>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <form onSubmit={submit} className="mt-4 grid gap-4">
          {mode === 'full' && (
            <div>
              <label className="text-sm font-medium">Leave type</label>
              <select
                className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
              >
                {regularTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'half' && (
            <>
              <div>
                <label className="text-sm font-medium">Leave type</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
                  value={form.leaveTypeId}
                  onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                  required
                >
                  {regularTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                id="half-date"
                label="Date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
                required
              />
              <div>
                <label className="text-sm font-medium">Half</label>
                <select
                  className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
                  value={form.halfDayType}
                  onChange={(e) =>
                    setForm({ ...form, halfDayType: e.target.value as 'FIRST_HALF' | 'SECOND_HALF' })
                  }
                >
                  <option value="FIRST_HALF">Morning (first half)</option>
                  <option value="SECOND_HALF">Afternoon (second half)</option>
                </select>
              </div>
            </>
          )}

          {mode === 'wfh' && wfhType && (
            <Input
              id="wfh-date"
              label="Date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
              required
            />
          )}

          {mode === 'full' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="leave-start"
                label="From"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
              <Input
                id="leave-end"
                label="To"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          )}

          <Input
            id="leave-reason"
            label="Reason (optional)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder={
              mode === 'wfh' ? 'e.g. Doctor appointment, home repair…' : 'Brief reason for your manager'
            }
          />

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} disabled={mode === 'wfh' && !wfhType}>
              {labels.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
