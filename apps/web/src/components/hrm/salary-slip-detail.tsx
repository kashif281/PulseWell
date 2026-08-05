'use client';

import { formatMoney, formatSalaryLabel } from '@/lib/salary-utils';

export interface SalarySlipData {
  id?: string;
  employeeName: string;
  employeeNumber?: string | null;
  department?: string | null;
  company: string;
  payPeriod: string;
  paidAt?: string | null;
  currency?: string;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  deductions: number;
  tax: number;
  loanDeduction: number;
  latePenalty: number;
  leaveDeduction?: number;
  netSalary: number;
  allowanceItems?: { type: string; amount: number }[];
  deductionItems?: { type: string; amount: number }[];
  lateDays?: number;
  overtimeHours?: number;
}

function SlipRow({
  label,
  amount,
  currency,
  emphasis,
  negative,
}: {
  label: string;
  amount: number;
  currency: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  if (amount === 0 && !emphasis) return null;
  return (
    <div className={`flex items-center justify-between py-2 ${emphasis ? 'border-t border-[var(--card-border)] pt-3' : ''}`}>
      <span className={emphasis ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted)]'}>
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasis ? 'text-lg font-bold text-emerald-700' : 'font-medium text-[var(--foreground)]'} ${negative ? 'text-red-600' : ''}`}
      >
        {negative ? '−' : ''}
        {formatMoney(Math.abs(amount), currency)}
      </span>
    </div>
  );
}

export function SalarySlipDetail({ slip, onClose }: { slip: SalarySlipData; onClose?: () => void }) {
  const currency = slip.currency ?? 'USD';
  const allowanceItems = slip.allowanceItems ?? [];
  const deductionItems = slip.deductionItems ?? [];

  const grossEarnings =
    slip.baseSalary + slip.allowances + slip.bonuses + slip.overtime;
  const totalDeductions =
    slip.deductions + slip.tax + slip.loanDeduction + slip.latePenalty + (slip.leaveDeduction ?? 0);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card)] shadow-sm">
      <div className="border-b border-[var(--card-border)] bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">Salary slip</p>
            <h2 className="mt-1 text-xl font-bold">{slip.company}</h2>
            <p className="mt-1 text-sm text-emerald-50">{slip.payPeriod}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-100">Net pay</p>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(slip.netSalary, currency)}</p>
            {slip.paidAt && (
              <p className="mt-1 text-xs text-emerald-100">
                Paid {new Date(slip.paidAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Employee</p>
          <p className="font-semibold text-[var(--foreground)]">{slip.employeeName}</p>
          {slip.employeeNumber && (
            <p className="text-[var(--muted)]">ID: {slip.employeeNumber}</p>
          )}
          {slip.department && <p className="text-[var(--muted)]">{slip.department}</p>}
        </div>
        <div className="space-y-1 text-sm md:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Month</p>
          <p className="font-medium text-[var(--foreground)]">{slip.payPeriod}</p>
          {slip.paidAt && (
            <p className="text-[var(--muted)]">
              Payment date: {new Date(slip.paidAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 border-t border-[var(--card-border)] px-6 py-6 md:grid-cols-2">
        <div className="rounded-lg bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Earnings
          </p>
          <div className="space-y-0 divide-y divide-emerald-100/80 dark:divide-emerald-900/40">
            <SlipRow label="Base salary" amount={slip.baseSalary} currency={currency} />
            {allowanceItems.length > 0
              ? allowanceItems.map((item) => (
                  <SlipRow
                    key={item.type}
                    label={formatSalaryLabel(item.type)}
                    amount={item.amount}
                    currency={currency}
                  />
                ))
              : slip.allowances > 0 && (
                  <SlipRow label="Allowances" amount={slip.allowances} currency={currency} />
                )}
            <SlipRow label="Bonuses" amount={slip.bonuses} currency={currency} />
            <SlipRow label="Overtime" amount={slip.overtime} currency={currency} />
            {slip.overtimeHours != null && slip.overtimeHours > 0 && (
              <p className="py-1 text-xs text-[var(--muted)]">
                {slip.overtimeHours.toFixed(1)} overtime hours
              </p>
            )}
            <SlipRow label="Gross earnings" amount={grossEarnings} currency={currency} emphasis />
          </div>
        </div>

        <div className="rounded-lg bg-red-50/50 p-4 dark:bg-red-950/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
            Deductions
          </p>
          <div className="space-y-0 divide-y divide-red-100/80 dark:divide-red-900/40">
            {deductionItems.length > 0
              ? deductionItems.map((item) => (
                  <SlipRow
                    key={item.type}
                    label={formatSalaryLabel(item.type)}
                    amount={item.amount}
                    currency={currency}
                    negative
                  />
                ))
              : slip.deductions > 0 && (
                  <SlipRow label="Other deductions" amount={slip.deductions} currency={currency} negative />
                )}
            <SlipRow label="Income tax" amount={slip.tax} currency={currency} negative />
            <SlipRow label="Loan repayment" amount={slip.loanDeduction} currency={currency} negative />
            <SlipRow label="Late penalty" amount={slip.latePenalty} currency={currency} negative />
            {(slip.leaveDeduction ?? 0) > 0 && (
              <SlipRow label="Leave deduction" amount={slip.leaveDeduction!} currency={currency} negative />
            )}
            {slip.lateDays != null && slip.lateDays > 0 && (
              <p className="py-1 text-xs text-[var(--muted)]">{slip.lateDays} late day(s)</p>
            )}
            <SlipRow label="Total deductions" amount={totalDeductions} currency={currency} emphasis negative />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--card-border)] bg-slate-50 px-6 py-4 dark:bg-slate-800/40">
        <div>
          <p className="text-sm text-[var(--muted)]">Amount deposited</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">
            {formatMoney(slip.netSalary, currency)}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
