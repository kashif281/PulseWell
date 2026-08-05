'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { Package, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface AssetRow {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  serialNumber?: string | null;
  assignments: Array<{
    employee?: { user: { firstName: string; lastName: string } };
  }>;
}

interface Dashboard {
  total: number;
  assigned: number;
  available: number;
  inRepair: number;
  lost: number;
  retired: number;
}

export default function AdminAssetsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { companyId, companyQuery, companies, setCompanyId } = useAdminCompanyScope();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ assetTag: '', name: '', category: 'LAPTOP', serialNumber: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !companyId) return;
    const [dRes, aRes] = await Promise.all([
      api<Dashboard>(`/assets/dashboard${companyQuery}`, { token }),
      api<AssetRow[]>(`/assets${companyQuery}`, { token }),
    ]);
    setDashboard(dRes.data ?? null);
    setAssets(aRes.data ?? []);
  }, [token, companyId, companyQuery]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const createAsset = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api(`/assets${companyQuery}`, {
        method: 'POST',
        token,
        body: JSON.stringify(form),
      });
      toast.success('Asset created');
      setShowCreate(false);
      setForm({ assetTag: '', name: '', category: 'LAPTOP', serialNumber: '' });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Asset Management</h1>
            <p className="text-[var(--muted)]">Company equipment inventory & assignments</p>
          </div>
          <div className="flex gap-2">
            <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add asset
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="Total" value={dashboard?.total ?? 0} icon={<Package className="h-5 w-5" />} />
          <StatCard title="Assigned" value={dashboard?.assigned ?? 0} />
          <StatCard title="Available" value={dashboard?.available ?? 0} />
          <StatCard title="In repair" value={dashboard?.inRepair ?? 0} />
          <StatCard title="Lost" value={dashboard?.lost ?? 0} />
          <StatCard title="Retired" value={dashboard?.retired ?? 0} />
        </div>

        <Card>
          <h2 className="mb-4 font-semibold">All assets</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[var(--muted)]">
                  <th className="pb-2">Tag</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Assigned to</th>
                  <th className="pb-2">Serial</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--card-border)]">
                    <td className="py-2 font-mono text-xs">{a.assetTag}</td>
                    <td className="py-2">{a.name}</td>
                    <td className="py-2">{a.category}</td>
                    <td className="py-2 capitalize">{a.status.toLowerCase()}</td>
                    <td className="py-2">
                      {a.assignments[0]?.employee
                        ? `${a.assignments[0].employee.user.firstName} ${a.assignments[0].employee.user.lastName}`
                        : '—'}
                    </td>
                    <td className="py-2">{a.serialNumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!assets.length && <p className="py-4 text-sm text-[var(--muted)]">No assets yet.</p>}
          </div>
        </Card>

        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New asset">
          <div className="space-y-3">
            <Input placeholder="Asset tag (e.g. LAP-001)" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} />
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select
              className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {['LAPTOP', 'MONITOR', 'MOBILE_PHONE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input placeholder="Serial number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            <Button isLoading={saving} onClick={createAsset} disabled={!form.assetTag || !form.name}>
              Create
            </Button>
          </div>
        </Modal>
      </div>
    </ProtectedLayout>
  );
}
