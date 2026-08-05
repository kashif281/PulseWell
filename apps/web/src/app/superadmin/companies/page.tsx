'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Company {
  id: string;
  name: string;
  industry?: string;
  isActive: boolean;
  createdAt: string;
  subscriptions: Array<{ plan: string; status: string }>;
  _count: { employees: number; users: number };
}

export default function SuperAdminCompaniesPage() {
  const { token } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);

  const load = () => {
    if (!token) return;
    api<{ companies: Company[] }>('/admin/companies', { token })
      .then((res) => setCompanies(res.data?.companies ?? []))
      .catch(console.error);
  };

  useEffect(() => { load(); }, [token]);

  const toggleStatus = async (id: string, isActive: boolean) => {
    if (!token) return;
    await api(`/admin/companies/${id}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  const updatePlan = async (id: string, plan: string) => {
    if (!token) return;
    await api(`/admin/companies/${id}/subscription`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ plan }),
    });
    load();
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Companies</h1>
          <p className="text-[var(--muted)]">Manage all registered companies</p>
        </div>

        <Card title={`All Companies (${companies.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-left text-[var(--muted)]">
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Employees</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--card-border)]">
                    <td className="py-3">
                      <p className="font-medium text-[var(--foreground)]">{c.name}</p>
                      <p className="text-xs text-[var(--muted)]">{c.industry ?? '—'}</p>
                    </td>
                    <td className="py-3">
                      <select
                        value={c.subscriptions[0]?.plan ?? 'FREE'}
                        onChange={(e) => updatePlan(c.id, e.target.value)}
                        className="rounded border border-[var(--card-border)] bg-[var(--card)] px-2 py-1 text-sm"
                      >
                        <option value="FREE">Free</option>
                        <option value="PRO">Pro</option>
                        <option value="ENTERPRISE">Enterprise</option>
                      </select>
                    </td>
                    <td className="py-3 text-[var(--muted)]">{c._count.employees}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(c.id, c.isActive)}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
