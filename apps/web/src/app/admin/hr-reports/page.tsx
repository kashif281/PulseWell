'use client';

import { useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance Report' },
  { id: 'leave', label: 'Leave Report' },
  { id: 'payroll', label: 'Payroll Report' },
];

export default function AdminHrReportsPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const download = async (type: string) => {
    if (!token || !ready) return;
    setLoading(true);
    try {
      const res = await api<{ content: string; fileName: string }>(`/hrm/reports/${type}${companyQuery}`, { token });
      setContent(res.data?.content ?? '');
      setFileName(res.data?.fileName ?? 'report.csv');
    } finally {
      setLoading(false);
    }
  };

  const saveCsv = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">HR Reports</h1>
          <p className="text-[var(--muted)]">Export attendance, leave, and payroll data</p>
        </div>
        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        <Card title="Generate reports">
          <div className="space-y-3">
            {REPORT_TYPES.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.label}</span>
                <Button size="sm" variant="outline" isLoading={loading} onClick={() => download(r.id)}>Export CSV</Button>
              </div>
            ))}
          </div>
        </Card>

        {content && (
          <Card title="Preview">
            <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-4 text-xs">{content.slice(0, 2000)}</pre>
            <Button className="mt-4" onClick={saveCsv}>Download {fileName}</Button>
          </Card>
        )}
      </div>
    </ProtectedLayout>
  );
}
