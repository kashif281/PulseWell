'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string;
  leaveType: { name: string };
  employee: { user: { firstName?: string; lastName?: string }; department?: { name: string } };
}

export default function AdminLeavePage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    if (!token || !ready) return;
    const q = filter ? `${companyQuery}${companyQuery ? '&' : '?'}status=${filter}` : companyQuery;
    api<LeaveRequest[]>(`/hrm/leave/requests${q}`, { token }).then((r) => setRequests(r.data ?? []));
  }, [token, companyQuery, ready, filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    await api(`/hrm/leave/requests/${id}/review`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ action }),
    });
    load();
  };

  const pending = requests.filter((r) => r.status === 'PENDING').length;
  const approved = requests.filter((r) => r.status === 'APPROVED').length;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-[var(--muted)]">Review and manage employee leave requests</p>
        </div>
        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        <div className="flex flex-wrap gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}
            >
              {s || 'All'} {s === 'PENDING' && `(${pending})`} {s === 'APPROVED' && `(${approved})`}
            </button>
          ))}
        </div>

        <Card title={`Leave requests (${requests.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--muted)]">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Dates</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.employee.user.firstName} {r.employee.user.lastName}</td>
                  <td className="py-2">{r.leaveType.name}</td>
                  <td className="py-2">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</td>
                  <td className="py-2 capitalize">{r.status.toLowerCase()}</td>
                  <td className="py-2">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => review(r.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => review(r.id, 'reject')}>Reject</Button>
                      </div>
                    )}
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
