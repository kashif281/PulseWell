'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, GraduationCap, Package, Users, Wallet } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WeatherAlertBanner, type WeatherAlert } from '@/components/weather/weather-alert-banner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface HrmDashboardData {
  attendance?: { status?: string; workingHours?: number | null } | null;
  workingHours?: number;
  leaveBalances?: Array<{ leaveType?: { name?: string } | null; remaining?: number }>;
  pendingLeaveRequests?: number;
  latestSalary?: { netSalary: number; status?: string | null } | null;
  upcomingHoliday?: { name: string; date: string } | null;
}

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<HrmDashboardData | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<WeatherAlert | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWeather = () => {
    if (!token) return;
    api<WeatherAlert | null>('/weather/alert/today', { token })
      .then((res) => setWeatherAlert(res.data ?? null))
      .catch(() => setWeatherAlert(null));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      return;
    }
    api<HrmDashboardData>('/hrm/dashboard/me', { token })
      .then((res) => setData(res.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    loadWeather();
  }, [token, authLoading]);

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Workforce Dashboard</h1>
            <p className="text-slate-500">Attendance, leave, pay, and work updates in one place</p>
          </div>
          <Link href="/attendance">
            <Button>Open Attendance</Button>
          </Link>
        </div>

        <WeatherAlertBanner alert={weatherAlert} onUpdate={loadWeather} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Attendance"
            value={data?.attendance?.status ?? 'Not started'}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Working hours"
            value={`${data?.workingHours ?? data?.attendance?.workingHours ?? 0}h`}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Pending leaves"
            value={data?.pendingLeaveRequests ?? 0}
            icon={<Calendar className="h-5 w-5" />}
          />
          <StatCard
            title="Latest salary"
            value={data?.latestSalary ? `$${data.latestSalary.netSalary.toLocaleString()}` : '—'}
            subtitle={data?.latestSalary?.status ?? undefined}
            icon={<Wallet className="h-5 w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Quick Actions">
            <div className="space-y-2">
              <Link href="/attendance" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <Clock className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">Check attendance</span>
              </Link>
              <Link href="/leave" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">Request leave</span>
              </Link>
              <Link href="/team" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <Users className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">See who&apos;s working</span>
              </Link>
            </div>
          </Card>

          <Card title="Leave Balances">
            <div className="space-y-3">
              {(data?.leaveBalances ?? []).slice(0, 4).map((balance, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{balance.leaveType?.name ?? 'Leave'}</span>
                  <span className="font-medium text-slate-900">{balance.remaining ?? 0} days</span>
                </div>
              ))}
              {!data?.leaveBalances?.length && (
                <p className="text-sm text-slate-500">No leave balances configured yet.</p>
              )}
            </div>
          </Card>

          <Card title="Work Tools">
            <div className="space-y-2">
              <Link href="/equipment" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <Package className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">My equipment</span>
              </Link>
              <Link href="/learning" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">Learning</span>
              </Link>
              <Link href="/salary" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">My salary</span>
              </Link>
            </div>
          </Card>
        </div>

        {data?.upcomingHoliday && (
          <Card title="Upcoming Holiday">
            <p className="text-sm text-slate-600">
              {data.upcomingHoliday.name} on{' '}
              {new Date(data.upcomingHoliday.date).toLocaleDateString()}
            </p>
          </Card>
        )}
      </div>
    </ProtectedLayout>
  );
}
