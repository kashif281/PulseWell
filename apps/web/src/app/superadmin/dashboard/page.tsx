'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Building2, Users, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@pulseai/types';

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalEmployees: number;
  subscriptionsByPlan: Array<{ plan: string; count: number }>;
}

export default function SuperAdminDashboardPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    if (user && user.role !== UserRole.SUPER_ADMIN) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (!token) return;
    api<PlatformStats>('/admin/stats', { token })
      .then((res) => setStats(res.data ?? null))
      .catch(console.error);
  }, [token]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Platform Administration</h1>
          <p className="text-[var(--muted)]">Nura platform-wide overview</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Companies" value={stats?.totalCompanies ?? 0} subtitle={`${stats?.activeCompanies ?? 0} active`} icon={<Building2 className="h-5 w-5" />} />
          <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Employees" value={stats?.totalEmployees ?? 0} icon={<Activity className="h-5 w-5" />} />
        </div>

        <Card title="Subscriptions by Plan">
          <div className="grid grid-cols-3 gap-4">
            {stats?.subscriptionsByPlan.map((s) => (
              <div key={s.plan} className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800">
                <p className="text-sm text-[var(--muted)]">{s.plan}</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">{s.count}</p>
              </div>
            )) ?? <p className="text-[var(--muted)]">No subscription data</p>}
          </div>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
