'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Mail, RefreshCw } from 'lucide-react';

interface InvitationRow {
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  position: string | null;
  status: string;
  invitedAt?: string | null;
  lastEmailAt?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  INVITATION_PENDING: 'Invitation pending',
  INVITATION_SENT: 'Invitation sent',
  INVITATION_EXPIRED: 'Invitation expired',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  PROBATION: 'Probation',
};

const STATUS_COLORS: Record<string, string> = {
  INVITATION_PENDING: 'bg-amber-100 text-amber-800',
  INVITATION_SENT: 'bg-blue-100 text-blue-800',
  INVITATION_EXPIRED: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-700',
  SUSPENDED: 'bg-red-100 text-red-800',
};

function formatWhen(iso?: string | null) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 2 * 86400000) return 'Yesterday';
  return d.toLocaleDateString();
}

export function InvitationDashboard({
  token,
  companyQuery = '',
}: {
  token: string | null;
  companyQuery?: string;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api<InvitationRow[]>(`/employees/invitations${companyQuery}`, { token })
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token, companyQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const resend = async (employeeId: string) => {
    if (!token) return;
    setResending(employeeId);
    try {
      await api(`/employees/${employeeId}/resend-invitation${companyQuery}`, {
        method: 'POST',
        token,
      });
      toast.success('Invitation resent');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setResending(null);
    }
  };

  return (
    <Card title="Invitation progress" subtitle="Track onboarding status for your team">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[var(--muted)]">
              <th className="pb-2 pr-4">Employee</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Invited</th>
              <th className="pb-2 pr-4">Last email</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-[var(--card-border)]">
                <td className="py-3 pr-4">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--muted)]">{r.email}</p>
                  {r.department && (
                    <p className="text-xs text-[var(--muted)]">{r.department}</p>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[r.status] ?? 'bg-slate-100'
                    }`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
                <td className="py-3 pr-4">{formatWhen(r.invitedAt)}</td>
                <td className="py-3 pr-4">{formatWhen(r.lastEmailAt)}</td>
                <td className="py-3">
                  {r.status === 'ACTIVE' ? (
                    <span className="text-sm text-slate-500">Active</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={resending === r.employeeId}
                      onClick={() => resend(r.employeeId)}
                    >
                      <Mail className="mr-1 h-3 w-3" />
                      {r.status === 'INVITATION_SENT' ? 'Resend' : 'Send invite'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !loading && (
          <p className="py-8 text-center text-sm text-[var(--muted)]">No employees yet.</p>
        )}
      </div>
    </Card>
  );
}
