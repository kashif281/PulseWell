'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmailCompose } from '@/components/emails/email-compose';
import { EmailThreadView } from '@/components/emails/email-thread-view';
import { api } from '@/lib/api';

interface ThreadRow {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unreadCount: number;
  preview: string;
}

interface ThreadDetail {
  id: string;
  subject: string;
  status: string;
  summary: string | null;
  messages: Array<{
    id: string;
    senderType: 'HR' | 'EMPLOYEE' | 'SYSTEM';
    senderEmail: string;
    bodyText: string;
    subject: string;
    direction: 'OUTBOUND' | 'INBOUND';
    createdAt: string;
    attachments: Array<{ id: string; fileName: string; url: string }>;
  }>;
  employee: {
    id: string;
    user: { firstName?: string; lastName?: string; email: string };
  };
}

export function EmployeeCommunicationPanel({
  employeeId,
  employeeLabel,
  token,
  companyId,
}: {
  employeeId: string;
  employeeLabel: string;
  token: string;
  companyId?: string;
}) {
  const companyQuery = companyId ? `?companyId=${companyId}` : '';
  const companyBody: Record<string, string> = companyId ? { companyId } : {};
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [composing, setComposing] = useState(false);

  const loadThreads = useCallback(() => {
    const params = new URLSearchParams();
    params.set('employeeId', employeeId);
    if (companyId) params.set('companyId', companyId);
    api<ThreadRow[]>(`/emails/threads?${params.toString()}`, { token }).then((r) =>
      setThreads(r.data ?? []),
    );
  }, [token, employeeId, companyId]);

  const loadThread = useCallback(
    (id: string) => {
      api<ThreadDetail>(`/emails/thread/${id}${companyQuery}`, { token }).then((r) =>
        setThread(r.data ?? null),
      );
    },
    [token, companyQuery],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
    else setThread(null);
  }, [selectedId, loadThread]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Communication</h2>
          <p className="text-sm text-slate-500">Email threads with this employee</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setComposing(true);
            setSelectedId(null);
          }}
        >
          New email
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-2 lg:col-span-1">
          {threads.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No messages yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setComposing(false);
                      setSelectedId(t.id);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === t.id ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-medium">{t.subject}</p>
                    <p className="truncate text-xs text-slate-500">{t.preview}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          {composing ? (
            <EmailCompose
              token={token}
              companyQuery={companyQuery}
              companyBody={companyBody}
              employeeId={employeeId}
              employeeLabel={employeeLabel}
              onSent={() => {
                setComposing(false);
                loadThreads();
              }}
              onCancel={() => setComposing(false)}
            />
          ) : thread ? (
            <EmailThreadView
              thread={thread}
              token={token}
              companyQuery={companyQuery}
              companyBody={companyBody}
              onRefresh={() => {
                loadThread(thread.id);
                loadThreads();
              }}
            />
          ) : (
            <p className="text-sm text-slate-500">Select a thread or start a new email.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
