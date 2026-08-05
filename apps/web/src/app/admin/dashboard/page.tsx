'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Users, Activity, DollarSign, TrendingUp, CheckCircle, Calendar } from 'lucide-react';

interface HrmDashboard {
  checkedIn?: number;
  onLeave?: number;
  pendingLeaveRequests?: number;
  pendingPayroll?: number;
  pendingApprovals?: number;
  monthlySalaryCost?: number;
  activeEmployees?: number;
  absent?: number;
  late?: number;
  workingRemote?: number;
  attendanceRate?: number;
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [data, setData] = useState<HrmDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !ready) return;
    setError('');
    api<HrmDashboard>(`/hrm/dashboard/hr${companyQuery}`, { token })
      .then((res) => setData(res.data ?? null))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        setData(null);
      });
  }, [token, companyQuery, ready]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Dashboard</h1>
          <p className="text-slate-500">Workforce operations, attendance, leave, and payroll</p>
        </div>

        {isSuperAdmin && (
          <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Checked in today" value={data?.checkedIn ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard title="On leave" value={data?.onLeave ?? 0} icon={<Activity className="h-5 w-5" />} />
          <StatCard title="Pending leaves" value={data?.pendingLeaveRequests ?? 0} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Monthly salary cost" value={`$${(data?.monthlySalaryCost ?? 0).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active employees" value={data?.activeEmployees ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Working remote" value={data?.workingRemote ?? 0} icon={<Activity className="h-5 w-5" />} />
          <StatCard title="Late today" value={data?.late ?? 0} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Absent today" value={data?.absent ?? 0} icon={<Calendar className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Attendance rate" value={`${data?.attendanceRate ?? 0}%`} icon={<CheckCircle className="h-5 w-5" />} />
          <StatCard title="Pending payroll" value={data?.pendingPayroll ?? 0} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard title="Pending approvals" value={data?.pendingApprovals ?? 0} icon={<CheckCircle className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Operational Focus">
            <p className="text-sm text-slate-600">
              This dashboard now avoids employee health data and focuses on attendance,
              leave, payroll, and approvals.
            </p>
          </Card>

          <Card title="Next Actions">
            <div className="space-y-2 text-sm text-slate-600">
              <p>Review pending leave requests and approvals.</p>
              <p>Check attendance exceptions for late or absent employees.</p>
              <p>Generate payroll only after attendance corrections are complete.</p>
            </div>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
