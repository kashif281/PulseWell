'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Analytics {
  employeeCount: number;
  quizzesCompleted: number;
  averageQuizScore: number;
  codingSubmissions: number;
  modulesCompleted: number;
  certificationsEarned: number;
  mandatoryCertifications: number;
  averageStreak: number;
  averageLearningMinutes: number;
  departmentProgress?: Array<{
    department: string;
    employees: number;
    modulesCompleted: number;
    quizzesCompleted: number;
  }>;
  compliance?: {
    compliant: number;
    nonCompliant: number;
    employees: Array<{
      name: string;
      email: string;
      compliant: boolean;
      missingMandatory: string[];
      expired: string[];
    }>;
  };
}

export default function AdminLearningPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } =
    useAdminCompanyScope();
  const [stats, setStats] = useState<Analytics | null>(null);

  const load = useCallback(() => {
    if (!token || !ready) return;
    api<Analytics>(`/learning/admin/analytics${companyQuery}`, { token }).then((r) =>
      setStats(r.data ?? null),
    );
  }, [token, companyQuery, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const tiles = stats
    ? [
        { label: 'Employees', value: stats.employeeCount },
        { label: 'Quizzes completed', value: stats.quizzesCompleted },
        { label: 'Avg quiz score', value: `${stats.averageQuizScore}%` },
        { label: 'Code submissions', value: stats.codingSubmissions },
        { label: 'Modules completed', value: stats.modulesCompleted },
        { label: 'Certifications earned', value: stats.certificationsEarned },
        { label: 'Mandatory cert types', value: stats.mandatoryCertifications },
        { label: 'Compliance rate', value: stats.compliance ? `${stats.compliance.compliant}/${stats.compliance.compliant + stats.compliance.nonCompliant}` : '—' },
        { label: 'Avg learning streak', value: `${stats.averageStreak} days` },
        { label: 'Avg learning time', value: `${stats.averageLearningMinutes} min` },
      ]
    : [];

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Learning Analytics</h1>
          <p className="text-sm text-slate-500">Department progress, compliance, and skill development metrics.</p>
        </div>
        {isSuperAdmin && (
          <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">{t.value}</p>
          </Card>
        ))}
      </div>

      {stats?.departmentProgress && stats.departmentProgress.length > 0 && (
        <Card className="mt-6 p-4">
          <h2 className="mb-3 font-semibold">Department progress</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Department</th>
                  <th className="pb-2 pr-4">Employees</th>
                  <th className="pb-2 pr-4">Modules done</th>
                  <th className="pb-2">Quizzes done</th>
                </tr>
              </thead>
              <tbody>
                {stats.departmentProgress.map((d) => (
                  <tr key={d.department} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium">{d.department}</td>
                    <td className="py-2 pr-4">{d.employees}</td>
                    <td className="py-2 pr-4">{d.modulesCompleted}</td>
                    <td className="py-2">{d.quizzesCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {stats?.compliance && stats.compliance.employees.length > 0 && (
        <Card className="mt-6 p-4">
          <h2 className="mb-3 font-semibold">Mandatory training compliance</h2>
          <div className="space-y-2 text-sm">
            {stats.compliance.employees
              .filter((e) => !e.compliant)
              .slice(0, 15)
              .map((e) => (
                <div key={e.email} className="rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.email}</p>
                  {e.missingMandatory.length > 0 && (
                    <p className="text-xs text-red-700">Missing: {e.missingMandatory.join(', ')}</p>
                  )}
                  {e.expired.length > 0 && (
                    <p className="text-xs text-red-700">Expired: {e.expired.join(', ')}</p>
                  )}
                </div>
              ))}
            {stats.compliance.compliant > 0 && (
              <p className="text-xs text-emerald-600">{stats.compliance.compliant} employees fully compliant</p>
            )}
          </div>
        </Card>
      )}
    </ProtectedLayout>
  );
}
