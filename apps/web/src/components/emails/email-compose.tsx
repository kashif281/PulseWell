'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
}

export function EmailCompose({
  token,
  companyQuery,
  companyBody,
  employeeId,
  employeeLabel,
  threadId,
  onSent,
  onCancel,
}: {
  token: string;
  companyQuery: string;
  companyBody: Record<string, string>;
  employeeId?: string;
  employeeLabel?: string;
  threadId?: string;
  onSent: () => void;
  onCancel?: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId ?? '');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api<Template[]>(`/emails/templates${companyQuery}`, { token }).then((r) =>
      setTemplates(r.data ?? []),
    );
    if (!employeeId) {
      api<
        Array<{
          id: string;
          user?: { firstName?: string; lastName?: string; email?: string };
        }>
      >(`/employees${companyQuery}`, { token })
        .then((r) => {
          setEmployees(
            (r.data ?? []).map((e) => ({
              id: e.id,
              name:
                `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim() ||
                e.user?.email ||
                e.id,
              email: e.user?.email || '',
            })),
          );
        })
        .catch(() => {});
    }
  }, [token, companyQuery, employeeId]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject.replace(/\{\{firstName\}\}/g, ''));
    setBodyText(t.body.replace(/\{\{firstName\}\}/g, ''));
  };

  const send = async () => {
    const targetEmployee = employeeId || selectedEmployeeId;
    if (!token || !targetEmployee || !subject.trim() || !bodyText.trim()) {
      setError('Employee, subject, and body are required');
      return;
    }
    setSending(true);
    setError('');
    try {
      await api('/emails/send', {
        method: 'POST',
        token,
        body: JSON.stringify({
          employeeId: targetEmployee,
          subject: subject.trim(),
          bodyText: bodyText.trim(),
          bodyHtml: `<div style="font-family:sans-serif;white-space:pre-wrap">${bodyText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</div>`,
          threadId,
          templateId: templateId || undefined,
          ...companyBody,
        }),
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {!employeeId && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.email})
              </option>
            ))}
          </select>
        </div>
      )}
      {employeeLabel && (
        <p className="text-sm text-slate-600">
          To: <span className="font-medium">{employeeLabel}</span>
        </p>
      )}
      {templates.length > 0 && !threadId && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Template</label>
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">None</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!threadId && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="Subject"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder="Write your message…"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send email'}
        </Button>
        {onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
