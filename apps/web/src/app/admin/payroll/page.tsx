'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { formatPayPeriodMonth } from '@/lib/salary-utils';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Payroll {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGross: number | string;
  totalNet: number | string;
  _count?: { items: number };
}

export default function AdminPayrollPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    if (!token || !ready) return;
    api<Payroll[]>(`/hrm/payroll${companyQuery}`, { token }).then((r) => setPayrolls(r.data ?? []));
  }, [token, companyQuery, ready]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!token || !ready) return;
    setGenerating(true);
    try {
      await api(`/hrm/payroll/generate${companyQuery}`, { method: 'POST', token, body: '{}' });
      load();
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    if (!token) return;
    await api(`/hrm/payroll/${id}/approve`, { method: 'PUT', token });
    load();
  };

  const markPaid = async (id: string) => {
    if (!token) return;
    await api(`/hrm/payroll/${id}/paid`, { method: 'PUT', token });
    load();
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Payroll</h1>
            <p className="text-[var(--muted)]">Generate and manage monthly payroll</p>
          </div>
          <Button onClick={generate} isLoading={generating}>Generate this month</Button>
        </div>
        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        <Card title="Payroll runs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--muted)]">
                <th className="pb-2">Month</th>
                <th className="pb-2">Employees</th>
                <th className="pb-2">Gross</th>
                <th className="pb-2">Net</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 font-medium">{formatPayPeriodMonth(p.periodStart, p.periodEnd)}</td>
                  <td className="py-2">{p._count?.items ?? '—'}</td>
                  <td className="py-2">${Number(p.totalGross).toLocaleString()}</td>
                  <td className="py-2">${Number(p.totalNet).toLocaleString()}</td>
                  <td className="py-2 capitalize">{p.status.toLowerCase()}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {p.status === 'GENERATED' && <Button size="sm" onClick={() => approve(p.id)}>Approve</Button>}
                      {p.status === 'APPROVED' && <Button size="sm" onClick={() => markPaid(p.id)}>Mark paid</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
