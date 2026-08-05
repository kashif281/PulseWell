'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface PreviewRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: string;
  position?: string;
}

interface PreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  valid: PreviewRow[];
  invalid: { rowNumber: number; email?: string; errors: string[] }[];
}

export function BulkImportPanel({
  token,
  companyQuery = '',
  onImported,
}: {
  token: string | null;
  companyQuery?: string;
  onImported?: () => void;
}) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const sampleCsv = `First Name,Last Name,Email,Department,Designation
John,Smith,john.smith@acme.com,Engineering,Software Engineer
Sarah,Khan,sarah.khan@acme.com,Human Resources,HR Manager`;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const runPreview = async () => {
    if (!token || !csv.trim()) return;
    setLoading(true);
    try {
      const res = await api<PreviewResult>(`/employees/import/preview${companyQuery}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ csv }),
      });
      setPreview(res.data ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    if (!token || !preview?.valid.length) return;
    setImporting(true);
    try {
      const res = await api<{ createdCount: number; failedCount: number }>(
        `/employees/import${companyQuery}`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ employees: preview.valid, sendInvitations: true }),
        },
      );
      toast.success(`Imported ${res.data?.createdCount ?? 0} employees`);
      setCsv('');
      setPreview(null);
      onImported?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card
      title="Bulk import"
      subtitle="Upload a CSV to onboard many employees at once"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-[var(--card-border)] p-6 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-[var(--muted)]" />
          <p className="mt-2 text-sm text-[var(--muted)]">
            Columns: First Name, Last Name, Email (required). Optional: Department, Designation
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Upload className="h-4 w-4" />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>

        <div>
          <label className="text-sm font-medium">Or paste CSV</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-3 font-mono text-xs"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={sampleCsv}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCsv(sampleCsv)}>
            Load sample
          </Button>
          <Button onClick={runPreview} isLoading={loading} disabled={!csv.trim()}>
            Preview import
          </Button>
        </div>

        {preview && (
          <div className="space-y-3 border-t border-[var(--card-border)] pt-4">
            <p className="text-sm">
              <strong>{preview.validCount}</strong> valid ·{' '}
              <strong className="text-red-600">{preview.invalidCount}</strong> invalid ·{' '}
              {preview.totalRows} total rows
            </p>

            {preview.invalid.length > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/30">
                <p className="font-medium text-red-800 dark:text-red-300">Invalid rows</p>
                <ul className="mt-2 space-y-1 text-red-700 dark:text-red-400">
                  {preview.invalid.map((row) => (
                    <li key={row.rowNumber}>
                      Row {row.rowNumber}
                      {row.email ? ` (${row.email})` : ''}: {row.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.valid.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[var(--muted)]">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Designation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-[var(--card-border)]">
                        <td className="py-2">
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="py-2">{r.email}</td>
                        <td className="py-2">{r.position ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={commit}
              isLoading={importing}
              disabled={!preview.valid.length}
              className="w-full sm:w-auto"
            >
              Import {preview.validCount} employees & send invitations
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
