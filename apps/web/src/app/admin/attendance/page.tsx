'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { CompanyFilter } from '@/components/admin/company-filter';
import { PresenceSettingsCard } from '@/components/hrm/presence-settings';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api, getStoredToken } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Users, UserCheck, UserX, Plane, Clock, RefreshCw, Home } from 'lucide-react';

interface RosterPerson {
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  leaveType?: string;
  leaveStart?: string;
  leaveEnd?: string;
  reason?: string;
}

interface UpcomingLeave {
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
}

interface AttendanceDashboard {
  date: string;
  totalEmployees: number;
  checkedIn: number;
  checkedOut: number;
  onBreak?: number;
  absent: number;
  onLeave: number;
  late: number;
  remote: number;
  wfhApprovedPending?: number;
  onLeaveToday: RosterPerson[];
  absentToday: RosterPerson[];
  lateToday: RosterPerson[];
  remoteToday: RosterPerson[];
  wfhApprovedPendingToday?: RosterPerson[];
  presentToday: RosterPerson[];
  onBreakToday?: RosterPerson[];
  checkedOutToday?: RosterPerson[];
  upcomingLeaves: UpcomingLeave[];
}

function PersonTable({
  rows,
  columns,
}: {
  rows: RosterPerson[] | UpcomingLeave[];
  columns: { key: string; label: string; render?: (row: RosterPerson | UpcomingLeave) => string }[];
}) {
  if (!rows.length) {
    return <p className="py-4 text-sm text-[var(--muted)]">No one in this category.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[var(--muted)]">
            {columns.map((c) => (
              <th key={c.key} className="pb-2 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={'startDate' in row ? `${row.employeeId}-${row.startDate}` : `${row.employeeId}-${i}`} className="border-b border-[var(--card-border)]">
              {columns.map((c) => (
                <td key={c.key} className="py-2">
                  {c.render ? c.render(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAttendancePage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [data, setData] = useState<AttendanceDashboard | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const load = useCallback((silent = false) => {
    if (!token || !ready) return;
    if (!silent) setLoading(true);
    const dateQ = date ? `&date=${date}` : '';
    const sep = companyQuery ? `${companyQuery}${dateQ}` : `?date=${date}`;
    api<AttendanceDashboard>(`/hrm/attendance/dashboard${sep}`, { token })
      .then((r) => setData(r.data ?? null))
      .catch(() => setData(null))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [token, companyQuery, ready, date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const accessToken = token ?? getStoredToken();
    if (!accessToken) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    const streamUrl = apiBase.startsWith('/')
      ? `${apiBase}/hrm/attendance/stream?token=${encodeURIComponent(accessToken)}`
      : `${apiBase}/hrm/attendance/stream?token=${encodeURIComponent(accessToken)}`;

    const es = new EventSource(streamUrl);
    es.onmessage = () => load(true);
    return () => es.close();
  }, [token, load]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Attendance Dashboard</h1>
            <p className="text-[var(--muted)]">
              Who is present, absent, on leave, late, or working from home — updates live
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={() => load()}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total employees" value={data?.totalEmployees ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Checked in" value={data?.checkedIn ?? 0} icon={<UserCheck className="h-5 w-5" />} />
          <StatCard title="Checked out" value={data?.checkedOut ?? 0} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Absent" value={data?.absent ?? 0} icon={<UserX className="h-5 w-5" />} />
          <StatCard title="On leave today" value={data?.onLeave ?? 0} icon={<Plane className="h-5 w-5" />} />
          <StatCard title="Late" value={data?.late ?? 0} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="On break" value={data?.onBreak ?? 0} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Working from home" value={data?.remote ?? 0} icon={<Home className="h-5 w-5" />} />
          <StatCard title="WFH approved (not in yet)" value={data?.wfhApprovedPending ?? 0} icon={<Home className="h-5 w-5" />} />
        </div>

        <PresenceSettingsCard />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`Working from home — checked in (${data?.remoteToday?.length ?? 0})`}>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Employees who checked in remotely today (weather WFH or regular remote work).
            </p>
            <PersonTable
              rows={data?.remoteToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                {
                  key: 'checkInAt',
                  label: 'Checked in',
                  render: (r) =>
                    'checkInAt' in r && r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—',
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: () => 'Working from home',
                },
              ]}
            />
          </Card>

          <Card title={`WFH approved — not checked in yet (${data?.wfhApprovedPendingToday?.length ?? 0})`}>
            <p className="mb-3 text-sm text-[var(--muted)]">
              HR allowed work from home via Weather WFH but they have not checked in remotely yet.
            </p>
            <PersonTable
              rows={data?.wfhApprovedPendingToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                {
                  key: 'reason',
                  label: 'Reason',
                  render: (r) => ('reason' in r && r.reason ? r.reason : '—'),
                },
              ]}
            />
          </Card>
          <Card title={`On break (${data?.onBreakToday?.length ?? 0})`}>
            <PersonTable
              rows={data?.onBreakToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                {
                  key: 'checkOutAt',
                  label: 'Last out',
                  render: (r) =>
                    'checkOutAt' in r && r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—',
                },
              ]}
            />
          </Card>

          <Card title={`Done for today (${data?.checkedOutToday?.length ?? 0})`}>
            <PersonTable
              rows={data?.checkedOutToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                {
                  key: 'checkOutAt',
                  label: 'Last out',
                  render: (r) =>
                    'checkOutAt' in r && r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—',
                },
              ]}
            />
          </Card>

          <Card title={`On leave today (${data?.onLeaveToday?.length ?? 0})`}>
            <PersonTable
              rows={data?.onLeaveToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                { key: 'leaveType', label: 'Leave type' },
                {
                  key: 'dates',
                  label: 'Dates',
                  render: (r) =>
                    'leaveStart' in r && r.leaveStart
                      ? `${new Date(r.leaveStart).toLocaleDateString()} – ${new Date(r.leaveEnd!).toLocaleDateString()}`
                      : '—',
                },
              ]}
            />
          </Card>

          <Card title={`Absent today (${data?.absentToday?.length ?? 0})`}>
            <PersonTable
              rows={data?.absentToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'email', label: 'Email' },
                { key: 'department', label: 'Department' },
              ]}
            />
          </Card>

          <Card title={`Late arrivals (${data?.lateToday?.length ?? 0})`}>
            <PersonTable
              rows={data?.lateToday ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'department', label: 'Department' },
                {
                  key: 'checkInAt',
                  label: 'Checked in',
                  render: (r) =>
                    'checkInAt' in r && r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—',
                },
              ]}
            />
          </Card>

          <Card title={`Upcoming approved leave (${data?.upcomingLeaves?.length ?? 0})`}>
            <PersonTable
              rows={data?.upcomingLeaves ?? []}
              columns={[
                { key: 'name', label: 'Employee' },
                { key: 'leaveType', label: 'Type' },
                {
                  key: 'startDate',
                  label: 'Starts',
                  render: (r) => new Date((r as UpcomingLeave).startDate).toLocaleDateString(),
                },
                {
                  key: 'endDate',
                  label: 'Ends',
                  render: (r) => new Date((r as UpcomingLeave).endDate).toLocaleDateString(),
                },
              ]}
            />
          </Card>
        </div>

        <Card title={`At office — checked in (${data?.presentToday?.length ?? 0})`}>
          <PersonTable
            rows={data?.presentToday ?? []}
            columns={[
              { key: 'name', label: 'Employee' },
              { key: 'department', label: 'Department' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => ('status' in r ? r.status.replace(/_/g, ' ').toLowerCase() : '—'),
              },
              {
                key: 'checkInAt',
                label: 'In',
                render: (r) =>
                  'checkInAt' in r && r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—',
              },
              {
                key: 'checkOutAt',
                label: 'Out',
                render: (r) =>
                  'checkOutAt' in r && r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—',
              },
            ]}
          />
        </Card>
      </div>
    </ProtectedLayout>
  );
}
