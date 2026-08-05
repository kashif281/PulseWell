'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface ActivityLog {
  id: string;
  type: string;
  title: string;
  description?: string;
  createdAt: string;
  user: { email: string; firstName?: string; lastName?: string };
}

export default function SuperAdminLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!token) return;
    api<{ logs: ActivityLog[] }>('/admin/activity-logs', { token })
      .then((res) => setLogs(res.data?.logs ?? []))
      .catch(console.error);
  }, [token]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Activity Logs</h1>
          <p className="text-[var(--muted)]">Platform-wide audit trail</p>
        </div>

        <Card title="Recent Activity">
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between rounded-lg border border-[var(--card-border)] p-4">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{log.title}</p>
                  <p className="text-sm text-[var(--muted)]">{log.description}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {log.user.firstName} {log.user.lastName} ({log.user.email})
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-[var(--muted)] dark:bg-slate-800">
                    {log.type.replace(/_/g, ' ')}
                  </span>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-[var(--muted)]">No activity logs yet.</p>}
          </div>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
