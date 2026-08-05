'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface PlatformUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  company?: { name: string };
  employee?: { id: string };
}

export default function SuperAdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);

  const load = () => {
    if (!token) return;
    api<{ users: PlatformUser[] }>('/admin/users', { token })
      .then((res) => setUsers(res.data?.users ?? []))
      .catch(console.error);
  };

  useEffect(() => { load(); }, [token]);

  const toggleStatus = async (id: string, isActive: boolean) => {
    if (!token) return;
    await api(`/admin/users/${id}/status`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">All Users</h1>
          <p className="text-[var(--muted)]">Platform user management</p>
        </div>

        <Card title={`Users (${users.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-left text-[var(--muted)]">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--card-border)]">
                    <td className="py-3 font-medium text-[var(--foreground)]">{u.firstName} {u.lastName}</td>
                    <td className="py-3 text-[var(--muted)]">{u.email}</td>
                    <td className="py-3 text-[var(--muted)]">{u.role.replace(/_/g, ' ')}</td>
                    <td className="py-3 text-[var(--muted)]">{u.company?.name ?? '—'}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {u.role !== 'SUPER_ADMIN' && (
                          <Button size="sm" variant="outline" onClick={() => toggleStatus(u.id, u.isActive)}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </div>
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
