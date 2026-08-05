'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

interface Integration {
  id: string;
  provider: string;
  name: string;
  webhookUrl: string;
  isActive: boolean;
  events: string[];
  lastFiredAt: string | null;
  lastStatus: string | null;
  hasSecret?: boolean;
  secret?: string;
}

const EVENT_OPTIONS = [
  { id: 'email.sent', label: 'HR sent email' },
  { id: 'email.replied', label: 'Employee replied' },
  { id: 'leave.requested', label: 'Leave requested' },
  { id: 'leave.reviewed', label: 'Leave approved/rejected' },
  { id: 'employee.invited', label: 'Employee invited' },
];

export default function AdminIntegrationsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } =
    useAdminCompanyScope();
  const [items, setItems] = useState<Integration[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['email.sent', 'email.replied']);
  const [saving, setSaving] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const companyBody = isSuperAdmin && companyId ? { companyId } : {};

  const load = useCallback(() => {
    if (!token || !ready) return;
    api<Integration[]>(`/integrations${companyQuery}`, { token }).then((r) =>
      setItems(r.data ?? []),
    );
  }, [token, ready, companyQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleEvent = (id: string) => {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const connect = async () => {
    if (!token || !webhookUrl.trim()) {
      toast.error('Paste your Make.com custom webhook URL');
      return;
    }
    setSaving(true);
    try {
      const res = await api<Integration>('/integrations/make', {
        method: 'POST',
        token,
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          events,
          ...companyBody,
        }),
      });
      if (res.data?.secret) setCreatedSecret(res.data.secret);
      toast.success('Make.com connected');
      setWebhookUrl('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const test = async (id: string) => {
    if (!token) return;
    try {
      await api(`/integrations/make/${id}/test`, {
        method: 'POST',
        token,
        body: JSON.stringify(companyBody),
      });
      toast.success('Test event sent — check your Make scenario history');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    await api(`/integrations/${id}${companyQuery}`, { method: 'DELETE', token });
    toast.success('Integration removed');
    load();
  };

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-sm text-slate-500">
            Connect Make.com to route Nura events to Slack, Teams, WhatsApp, SMS, or extra email
            contacts.
          </p>
        </div>
        {isSuperAdmin && (
          <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
        )}
      </div>

      <Card className="mb-6 space-y-4 p-4">
        <h2 className="font-semibold">Connect Make.com</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>In Make, create a scenario → Webhooks → Custom webhook → Copy URL</li>
          <li>Paste the URL below and choose which events to send</li>
          <li>In Make, add Email / Slack / WhatsApp modules that use the payload contacts</li>
        </ol>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hook.eu1.make.com/..."
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <div className="flex flex-wrap gap-2">
          {EVENT_OPTIONS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggleEvent(e.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                events.includes(e.id)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={connect} disabled={saving}>
          {saving ? 'Connecting…' : 'Connect webhook'}
        </Button>
        {createdSecret && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Signing secret (copy once)</p>
            <code className="mt-1 block break-all text-xs">{createdSecret}</code>
            <p className="mt-1 text-xs text-amber-800">
              Optional: verify <code>X-Nura-Signature</code> in Make with this secret.
            </p>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">No integrations yet.</Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">
                  {item.name}{' '}
                  <span className="text-xs font-normal text-slate-500">({item.provider})</span>
                </p>
                <p className="mt-1 max-w-xl truncate text-xs text-slate-500">{item.webhookUrl}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Events: {item.events.join(', ')}
                  {item.lastStatus && ` · Last: ${item.lastStatus}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => test(item.id)}>
                  Send test
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(item.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </ProtectedLayout>
  );
}
