'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { SalarySlipDetail, type SalarySlipData } from '@/components/hrm/salary-slip-detail';
import { formatMoney, formatPayPeriodMonth, formatPayPeriodMonthShort } from '@/lib/salary-utils';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Receipt } from 'lucide-react';

interface Slip {
  id: string;
  netSalary: number | string;
  payroll: { periodStart: string; periodEnd: string };
  salaryPayment?: { status: string; paidAt?: string | null } | null;
}

export default function SalaryPage() {
  const { token } = useAuth();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [selected, setSelected] = useState<SalarySlipData | null>(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoadingList(true);
    api<Slip[]>('/hrm/payroll/slips/me', { token })
      .then((r) => setSlips(r.data ?? []))
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, [token]);

  const viewSlip = async (id: string) => {
    if (!token) return;
    setLoadingSlip(true);
    try {
      const res = await api<SalarySlipData>(`/hrm/payroll/slips/${id}`, { token });
      setSelected(res.data ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlip(false);
    }
  };

  const paidDate = (slip: Slip) =>
    slip.salaryPayment?.paidAt
      ? new Date(slip.salaryPayment.paidAt).toLocaleDateString()
      : null;

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Salary</h1>
          <p className="text-[var(--muted)]">View salary slips for payments you have received</p>
        </div>

        <Card title="Payment history" subtitle="Only completed salary payments are shown here">
          {loadingList ? (
            <p className="text-sm text-[var(--muted)]">Loading your salary slips…</p>
          ) : slips.length === 0 ? (
            <div className="py-10 text-center">
              <Receipt className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-[var(--foreground)]">No salary slips yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                When HR marks your salary as paid, it will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--muted)]">
                    <th className="pb-3 font-medium">Month</th>
                    <th className="pb-3 font-medium">Net received</th>
                    <th className="pb-3 font-medium">Paid on</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--card-border)] last:border-0">
                      <td className="py-3 font-medium">
                        {formatPayPeriodMonth(s.payroll.periodStart, s.payroll.periodEnd)}
                      </td>
                      <td className="py-3 font-semibold text-emerald-700">
                        {formatMoney(Number(s.netSalary))}
                      </td>
                      <td className="py-3 text-[var(--muted)]">{paidDate(s) ?? '—'}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                          onClick={() => viewSlip(s.id)}
                        >
                          View slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {loadingSlip && (
          <p className="text-sm text-[var(--muted)]">Loading salary slip…</p>
        )}

        {selected && !loadingSlip && (
          <SalarySlipDetail slip={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </ProtectedLayout>
  );
}
