'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmailCompose } from '@/components/emails/email-compose';
import { api } from '@/lib/api';

interface Attachment {
  id: string;
  fileName: string;
  url: string;
}

interface Message {
  id: string;
  senderType: 'HR' | 'EMPLOYEE' | 'SYSTEM';
  senderEmail: string;
  bodyText: string;
  subject: string;
  direction: 'OUTBOUND' | 'INBOUND';
  createdAt: string;
  attachments: Attachment[];
}

interface ThreadDetail {
  id: string;
  subject: string;
  status: string;
  summary: string | null;
  messages: Message[];
  employee: {
    id: string;
    user: { firstName?: string; lastName?: string; email: string };
  };
}

export function EmailThreadView({
  thread,
  token,
  companyQuery,
  companyBody,
  onRefresh,
}: {
  thread: ThreadDetail;
  token: string;
  companyQuery: string;
  companyBody: Record<string, string>;
  onRefresh: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simText, setSimText] = useState('');
  const [summary, setSummary] = useState(thread.summary);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const employeeName =
    `${thread.employee.user.firstName ?? ''} ${thread.employee.user.lastName ?? ''}`.trim() ||
    thread.employee.user.email;

  const archive = async () => {
    await api(`/emails/thread/${thread.id}/archive`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ archive: thread.status !== 'ARCHIVED', ...companyBody }),
    });
    onRefresh();
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api<{ summary: string }>(`/emails/thread/${thread.id}/summary`, {
        method: 'POST',
        token,
        body: JSON.stringify(companyBody),
      });
      setSummary(res.data?.summary ?? null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const simulateReply = async () => {
    if (!simText.trim()) return;
    setSimulating(true);
    try {
      await api(`/emails/thread/${thread.id}/simulate-reply`, {
        method: 'POST',
        token,
        body: JSON.stringify({ bodyText: simText.trim(), ...companyBody }),
      });
      setSimText('');
      onRefresh();
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{thread.subject}</h2>
          <p className="text-sm text-slate-500">{employeeName} · {thread.employee.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadSummary} disabled={loadingSummary}>
            {loadingSummary ? 'Summarizing…' : 'AI summary'}
          </Button>
          <Button size="sm" variant="outline" onClick={archive}>
            {thread.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
          </Button>
          <Button size="sm" onClick={() => setReplying((v) => !v)}>
            Reply
          </Button>
        </div>
      </div>

      {summary && (
        <Card className="border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Conversation summary
          </p>
          <p className="whitespace-pre-wrap text-sm text-indigo-950 dark:text-indigo-100">{summary}</p>
        </Card>
      )}

      <div className="space-y-3">
        {thread.messages.map((m) => {
          const isHr = m.senderType === 'HR';
          return (
            <div key={m.id} className={`flex ${isHr ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  isHr
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                <p className={`mb-1 text-[10px] font-semibold uppercase ${isHr ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {isHr ? 'HR' : 'Employee'} · {new Date(m.createdAt).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap">{m.bodyText}</p>
                {m.attachments?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs opacity-90">
                    {m.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                          {a.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {replying && (
        <Card className="p-4">
          <EmailCompose
            token={token}
            companyQuery={companyQuery}
            companyBody={companyBody}
            employeeId={thread.employee.id}
            employeeLabel={employeeName}
            threadId={thread.id}
            onSent={() => {
              setReplying(false);
              onRefresh();
            }}
            onCancel={() => setReplying(false)}
          />
        </Card>
      )}

      <Card className="border-dashed p-4">
        <p className="mb-2 text-xs font-medium text-slate-500">
          Simulate employee reply (local/dev — no inbound provider required)
        </p>
        <textarea
          value={simText}
          onChange={(e) => setSimText(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="I'm feeling better today…"
        />
        <Button size="sm" variant="outline" onClick={simulateReply} disabled={simulating}>
          {simulating ? 'Posting…' : 'Post simulated reply'}
        </Button>
      </Card>
    </div>
  );
}
