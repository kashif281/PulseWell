'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

const CATEGORIES = [
  'INSURANCE', 'GYM_MEMBERSHIP', 'MENTAL_HEALTH', 'MEDICAL_CLAIMS',
  'DOCTOR_VISITS', 'VACCINATIONS', 'WELLNESS_BUDGET', 'EQUIPMENT', 'BENEFITS',
  'PAYROLL', 'OFFICE', 'TRAVEL', 'TRAINING', 'BONUSES', 'WELLNESS', 'RECRUITMENT', 'OTHER',
];

interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  department?: string;
  date: string;
}

interface Summary {
  total: number;
  byCategory: Array<{ category: string; amount: number }>;
}

export default function AdminSpendingPage() {
  const { token } = useAuth();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState({ category: 'INSURANCE', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token || !ready) return;
    setError('');
    Promise.all([
      api<Expense[]>(`/spending${companyQuery}`, { token }),
      api<Summary>(`/spending/summary${companyQuery}`, { token }),
    ])
      .then(([expRes, sumRes]) => {
        setExpenses(expRes.data ?? []);
        setSummary(sumRes.data ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load spending data');
        setExpenses([]);
        setSummary(null);
      });
  }, [token, companyQuery, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !ready) return;
    setSaving(true);
    try {
      await api(`/spending${companyQuery}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      setForm({ ...form, amount: '', description: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Spending</h1>
          <p className="text-slate-500">Track operational expenses and budget trends</p>
        </div>

        {isSuperAdmin && (
          <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">Total Spending</p>
            <p className="text-2xl font-bold text-slate-900">${(summary?.total ?? 0).toLocaleString()}</p>
          </Card>
          {summary?.byCategory.slice(0, 2).map((c) => (
            <Card key={c.category}>
              <p className="text-sm text-slate-500">{c.category.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-slate-900">${c.amount.toLocaleString()}</p>
            </Card>
          ))}
        </div>

        <Card title="Add Expense">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <Input id="amount" label="Amount ($)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            <Input id="description" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input id="date" label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            <div className="flex items-end">
              <Button type="submit" isLoading={saving} className="w-full">Add</Button>
            </div>
          </form>
        </Card>

        <Card title="Recent Expenses">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-100">
                    <td className="py-3 text-slate-600">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="py-3 text-slate-600">{exp.category.replace(/_/g, ' ')}</td>
                    <td className="py-3 text-slate-600">{exp.description ?? '—'}</td>
                    <td className="py-3 text-right font-medium text-slate-900">${Number(exp.amount).toLocaleString()}</td>
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
