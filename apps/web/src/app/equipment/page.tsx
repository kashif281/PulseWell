'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { Laptop, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Assignment {
  id: string;
  assignedAt: string;
  expectedReturnAt?: string | null;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    category: string;
    serialNumber?: string | null;
    brand?: string | null;
    model?: string | null;
    warrantyExpiry?: string | null;
    condition: string;
  };
}

export default function EquipmentPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Assignment[]>([]);
  const [reportAsset, setReportAsset] = useState<Assignment | null>(null);
  const [reportType, setReportType] = useState('DAMAGE');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    if (!token) return;
    api<Assignment[]>('/assets/me', { token })
      .then((res) => setItems(res.data ?? []))
      .catch(console.error);
  };

  useEffect(() => {
    load();
  }, [token]);

  const submitReport = async () => {
    if (!token || !reportAsset) return;
    setSubmitting(true);
    try {
      await api(`/assets/me/${reportAsset.asset.id}/report`, {
        method: 'POST',
        token,
        body: JSON.stringify({ type: reportType, description }),
      });
      toast.success('Report submitted to HR');
      setReportAsset(null);
      setDescription('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">My Equipment</h1>
          <p className="text-[var(--muted)]">Company assets assigned to you</p>
        </div>

        {items.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">No equipment assigned yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start gap-3">
                  <Laptop className="mt-1 h-8 w-8 text-emerald-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold">{a.asset.name}</h3>
                    <p className="text-sm text-[var(--muted)]">{a.asset.assetTag} · {a.asset.category}</p>
                    {a.asset.serialNumber && (
                      <p className="mt-1 text-sm">S/N: {a.asset.serialNumber}</p>
                    )}
                    {(a.asset.brand || a.asset.model) && (
                      <p className="text-sm">{[a.asset.brand, a.asset.model].filter(Boolean).join(' ')}</p>
                    )}
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Assigned {new Date(a.assignedAt).toLocaleDateString()}
                      {a.asset.warrantyExpiry && (
                        <> · Warranty until {new Date(a.asset.warrantyExpiry).toLocaleDateString()}</>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setReportAsset(a); setReportType('DAMAGE'); }}>
                        Report damage
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReportAsset(a); setReportType('REPAIR'); }}>
                        Request repair
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReportAsset(a); setReportType('LOSS'); }}>
                        Report loss
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          open={!!reportAsset}
          onClose={() => setReportAsset(null)}
          title="Report equipment issue"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              {reportAsset?.asset.name} ({reportAsset?.asset.assetTag})
            </p>
            <select
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="DAMAGE">Damage</option>
              <option value="REPAIR">Repair request</option>
              <option value="LOSS">Loss</option>
              <option value="REPLACEMENT">Replacement request</option>
            </select>
            <textarea
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
              rows={3}
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button isLoading={submitting} onClick={submitReport} disabled={!description.trim()}>
              Submit report
            </Button>
          </div>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}
