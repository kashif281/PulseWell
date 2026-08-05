'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface SalaryData {
  baseSalary: number;
  currency: string;
  totalAllowances: number;
  totalDeductions: number;
  allowances: { type: string; amount: number }[];
  deductions: { type: string; amount: number }[];
  bankName?: string | null;
  accountNumber?: string | null;
  taxNumber?: string | null;
}

interface EmployeeSalaryEditorProps {
  employeeId: string;
  token: string | null;
  onSaved?: () => void;
}

function allowanceAmount(list: { type: string; amount: number }[], type: string) {
  return list.find((a) => a.type === type)?.amount ?? 0;
}

export function EmployeeSalaryEditor({ employeeId, token, onSaved }: EmployeeSalaryEditorProps) {
  const fieldId = (name: string) => `${name}-${employeeId}`;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    baseSalary: '',
    transport: '',
    medical: '',
    insurance: '',
    bankName: '',
    accountNumber: '',
    taxNumber: '',
  });

  useEffect(() => {
    if (!token || !employeeId) return;
    setLoading(true);
    api<SalaryData>(`/hrm/employees/${employeeId}/salary`, { token })
      .then((res) => {
        const d = res.data;
        if (!d) return;
        setForm({
          baseSalary: String(d.baseSalary ?? ''),
          transport: String(allowanceAmount(d.allowances, 'TRANSPORT')),
          medical: String(allowanceAmount(d.allowances, 'MEDICAL')),
          insurance: String(allowanceAmount(d.deductions, 'INSURANCE')),
          bankName: d.bankName ?? '',
          accountNumber: d.accountNumber ?? '',
          taxNumber: d.taxNumber ?? '',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load salary'))
      .finally(() => setLoading(false));
  }, [token, employeeId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const baseSalary = parseFloat(form.baseSalary);
      if (Number.isNaN(baseSalary) || baseSalary < 0) {
        throw new Error('Enter a valid base salary');
      }
      await api(`/hrm/employees/${employeeId}/salary`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          baseSalary,
          allowances: [
            { type: 'TRANSPORT', amount: parseFloat(form.transport) || 0 },
            { type: 'MEDICAL', amount: parseFloat(form.medical) || 0 },
          ],
          deductions: [{ type: 'INSURANCE', amount: parseFloat(form.insurance) || 0 }],
          bankName: form.bankName || undefined,
          accountNumber: form.accountNumber || undefined,
          taxNumber: form.taxNumber || undefined,
        }),
      });
      setMessage('Salary updated successfully.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save salary');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading salary…</p>;
  }

  const base = parseFloat(form.baseSalary) || 0;
  const transport = parseFloat(form.transport) || 0;
  const medical = parseFloat(form.medical) || 0;
  const insurance = parseFloat(form.insurance) || 0;
  const gross = base + transport + medical;
  const net = gross - insurance;

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={fieldId('baseSalary')}
          label="Base salary ($/month)"
          type="number"
          min="0"
          step="0.01"
          value={form.baseSalary}
          onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
          required
        />
        <Input
          id={fieldId('transport')}
          label="Transport allowance ($)"
          type="number"
          min="0"
          value={form.transport}
          onChange={(e) => setForm({ ...form, transport: e.target.value })}
        />
        <Input
          id={fieldId('medical')}
          label="Medical allowance ($)"
          type="number"
          min="0"
          value={form.medical}
          onChange={(e) => setForm({ ...form, medical: e.target.value })}
        />
        <Input
          id={fieldId('insurance')}
          label="Insurance deduction ($)"
          type="number"
          min="0"
          value={form.insurance}
          onChange={(e) => setForm({ ...form, insurance: e.target.value })}
        />
        <Input
          id={fieldId('bankName')}
          label="Bank name"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
        />
        <Input
          id={fieldId('accountNumber')}
          label="Account number"
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
        />
        <Input
          id={fieldId('taxNumber')}
          label="Tax number"
          value={form.taxNumber}
          onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
        />
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
        <p className="text-[var(--muted)]">Estimated monthly package (before tax)</p>
        <p className="mt-1 text-lg font-semibold">
          Gross ${gross.toLocaleString()} · Net (after insurance) ${net.toLocaleString()}
        </p>
      </div>

      <Button type="submit" isLoading={saving}>Save salary</Button>
    </form>
  );
}
