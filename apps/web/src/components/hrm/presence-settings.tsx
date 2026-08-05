'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Shield } from 'lucide-react';

const OPTIONS = [
  { value: 'COMPANY', label: 'Everyone in company', desc: 'All employees can see who is working' },
  { value: 'DEPARTMENT', label: 'Department only', desc: 'Only same-department colleagues' },
  { value: 'TEAM', label: 'Direct team', desc: 'Manager, peers, and direct reports' },
];

export function PresenceSettingsCard() {
  const { token, user } = useAuth();
  const [visibility, setVisibility] = useState('COMPANY');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    api<{ presenceVisibility?: string }>('/company', { token })
      .then((r) => setVisibility(r.data?.presenceVisibility ?? 'COMPANY'))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (value: string) => {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      await api('/company/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify({ presenceVisibility: value }),
      });
      setVisibility(value);
      setMessage('Saved');
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'COMPANY_ADMIN' && user?.role !== 'SUPER_ADMIN') return null;

  return (
    <Card title="Team presence privacy" subtitle="Control who can see live attendance status">
      <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Shield className="h-4 w-4" />
        Applies to &quot;Who&apos;s Working&quot; for all employees
      </div>
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              visibility === opt.value
                ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                : 'border-[var(--card-border)] hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input
              type="radio"
              name="presenceVisibility"
              value={opt.value}
              checked={visibility === opt.value}
              disabled={saving}
              onChange={() => save(opt.value)}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-[var(--foreground)]">{opt.label}</p>
              <p className="text-xs text-[var(--muted)]">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>
      {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
    </Card>
  );
}
