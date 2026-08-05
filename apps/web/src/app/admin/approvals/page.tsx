'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Approval {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  employee?: { user: { firstName?: string; lastName?: string } };
}

export default function AdminApprovalsPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [pending, setPending] = useState<Approval[]>([]);
  const [all, setAll] = useState<Approval[]>([]);

  const load = useCallback(() => {
    if (!token || !ready) return;
    api<Approval[]>(`/hrm/approvals/pending${companyQuery}`, { token }).then((r) => setPending(r.data ?? []));
    api<Approval[]>(`/hrm/approvals${companyQuery}`, { token }).then((r) => setAll(r.data ?? []));
  }, [token, companyQuery, ready]);

  useEffect(() => { load(); }, [load]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Approval Center</h1>
          <p className="text-[var(--muted)]">Pending leave, payroll, loan, and other approvals</p>
        </div>
        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        <Card title={`Pending (${pending.length})`}>
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {a.type.replace(/_/g, ' ')} · {a.employee ? `${a.employee.user.firstName} ${a.employee.user.lastName}` : 'System'}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Pending</span>
              </li>
            ))}
            {pending.length === 0 && <p className="text-sm text-[var(--muted)]">No pending approvals.</p>}
          </ul>
        </Card>

        <Card title="Recent activity">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--muted)]">
                <th className="pb-2">Title</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {all.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.title}</td>
                  <td className="py-2">{a.type.replace(/_/g, ' ')}</td>
                  <td className="py-2 capitalize">{a.status.toLowerCase()}</td>
                  <td className="py-2">{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
