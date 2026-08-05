'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { EmailCompose } from '@/components/emails/email-compose';
import { EmailThreadView } from '@/components/emails/email-thread-view';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

type Filter = 'all' | 'UNREAD' | 'SENT' | 'ARCHIVED';

interface ThreadRow {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unreadCount: number;
  preview: string;
  employee: {
    id: string;
    user: { firstName?: string; lastName?: string; email: string };
    department?: { name: string } | null;
  };
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

export default function AdminMessagesPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } =
    useAdminCompanyScope();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [composing, setComposing] = useState(false);

  const companyBody: Record<string, string> =
    isSuperAdmin && companyId ? { companyId } : {};

  const loadThreads = useCallback(() => {
    if (!token || !ready) return;
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', companyId);
    if (filter === 'UNREAD') params.set('status', 'UNREAD');
    if (filter === 'SENT') params.set('status', 'SENT');
    if (filter === 'ARCHIVED') params.set('status', 'ARCHIVED');
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';
    api<ThreadRow[]>(`/emails/threads${qs}`, { token }).then((r) => setThreads(r.data ?? []));
  }, [token, ready, companyId, filter, q]);

  const loadThread = useCallback(
    (id: string) => {
      if (!token) return;
      api<ThreadDetail>(`/emails/thread/${id}${companyQuery}`, { token }).then((r) => {
        setThread(r.data ?? null);
        loadThreads();
      });
    },
    [token, companyQuery, loadThreads],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
    else setThread(null);
  }, [selectedId, loadThread]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Inbox' },
    { id: 'UNREAD', label: 'Unread' },
    { id: 'SENT', label: 'Sent' },
    { id: 'ARCHIVED', label: 'Archived' },
  ];

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-slate-500">
            Company email inbox — send to employees and track replies in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
          )}
          <Button size="sm" onClick={() => { setComposing(true); setSelectedId(null); }}>
            New email
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search stress, doctor, name…"
          className="ml-auto min-w-[200px] flex-1 rounded-lg border px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="max-h-[70vh] overflow-y-auto p-2 lg:col-span-1">
          {threads.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => {
                const name =
                  `${t.employee.user.firstName ?? ''} ${t.employee.user.lastName ?? ''}`.trim() ||
                  t.employee.user.email;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(false);
                        setSelectedId(t.id);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        selectedId === t.id ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${t.unreadCount ? 'font-semibold' : 'font-medium'}`}>
                          {name}
                        </p>
                        {t.unreadCount > 0 && (
                          <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-600">{t.subject}</p>
                      <p className="truncate text-[11px] text-slate-400">{t.preview}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="min-h-[70vh] p-4 lg:col-span-2">
          {composing ? (
            <>
              <h2 className="mb-3 text-lg font-semibold">New email</h2>
              {token && (
                <EmailCompose
                  token={token}
                  companyQuery={companyQuery}
                  companyBody={companyBody}
                  onSent={() => {
                    setComposing(false);
                    loadThreads();
                  }}
                  onCancel={() => setComposing(false)}
                />
              )}
            </>
          ) : thread && token ? (
            <>
              <EmailThreadView
                thread={thread}
                token={token}
                companyQuery={companyQuery}
                companyBody={companyBody}
                onRefresh={() => loadThread(thread.id)}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a conversation or start a new email.</p>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  );
}
