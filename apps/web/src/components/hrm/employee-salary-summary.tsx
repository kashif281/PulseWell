'use client';

import {
  computeMonthlyPackage,
  formatMoney,
  formatPayPeriodMonth,
  formatSalaryLabel,
  parseLineItems,
  type SalaryLineItem,
} from '@/lib/salary-utils';

export interface LastPayrollSummary {
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  totalAllowances: number;
  totalBonuses?: number;
  overtimePay?: number;
  totalDeductions: number;
  tax: number;
  loanDeduction?: number;
  latePenalty?: number;
  leaveDeduction?: number;
  netSalary: number;
  status?: string;
  paidAt?: string | null;
}

interface EmployeeSalarySummaryProps {
  baseSalary: number;
  currency?: string;
  allowances?: unknown;
  deductions?: unknown;
  bankName?: string | null;
  accountNumber?: string | null;
  taxNumber?: string | null;
  payrollType?: string | null;
  paymentFrequency?: string | null;
  lastPayroll?: LastPayrollSummary | null;
}

function LineItemsTable({
  title,
  items,
  currency,
  variant,
}: {
  title: string;
  items: SalaryLineItem[];
  currency: string;
  variant: 'credit' | 'debit';
}) {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const color = variant === 'credit' ? 'text-emerald-700' : 'text-red-700';

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {items.map((item) => (
            <tr key={item.type} className="border-b border-[var(--card-border)]">
              <td className="py-1.5 text-[var(--foreground)]">{formatSalaryLabel(item.type)}</td>
              <td className={`py-1.5 text-right font-medium ${color}`}>
                {variant === 'debit' ? '−' : '+'}
                {formatMoney(item.amount, currency)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-1.5 font-medium">Subtotal</td>
            <td className={`py-1.5 text-right font-semibold ${color}`}>
              {variant === 'debit' ? '−' : '+'}
              {formatMoney(total, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function EmployeeSalarySummary({
  baseSalary,
  currency = 'USD',
  allowances: allowancesRaw,
  deductions: deductionsRaw,
  bankName,
  accountNumber,
  taxNumber,
  payrollType,
  paymentFrequency,
  lastPayroll,
}: EmployeeSalarySummaryProps) {
  const allowances = parseLineItems(allowancesRaw);
  const deductions = parseLineItems(deductionsRaw);
  const { gross, net, totalAllowances, totalDeductions } = computeMonthlyPackage(
    baseSalary,
    allowances,
    deductions,
  );

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Current monthly structure
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--card-border)] p-3">
            <p className="text-xs text-[var(--muted)]">Base salary</p>
            <p className="mt-1 text-lg font-bold">{formatMoney(baseSalary, currency)}</p>
          </div>
          <div className="rounded-lg border border-[var(--card-border)] p-3">
            <p className="text-xs text-[var(--muted)]">Gross (before tax)</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(gross, currency)}</p>
          </div>
          <div className="rounded-lg border border-[var(--card-border)] p-3">
            <p className="text-xs text-[var(--muted)]">Net (after deductions)</p>
            <p className="mt-1 text-lg font-bold">{formatMoney(net, currency)}</p>
          </div>
        </div>

        {(payrollType || paymentFrequency) && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {payrollType && <span>Payroll: {formatSalaryLabel(payrollType)}</span>}
            {payrollType && paymentFrequency && <span> · </span>}
            {paymentFrequency && <span>Frequency: {formatSalaryLabel(paymentFrequency)}</span>}
          </p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <LineItemsTable title="Allowances" items={allowances} currency={currency} variant="credit" />
        <LineItemsTable title="Deductions" items={deductions} currency={currency} variant="debit" />
      </div>

      {!allowances.length && !deductions.length && (
        <p className="text-sm text-[var(--muted)]">
          Package total: {formatMoney(gross, currency)} gross · {formatMoney(net, currency)} net
          {totalAllowances > 0 || totalDeductions > 0
            ? ` (${formatMoney(totalAllowances, currency)} allowances, ${formatMoney(totalDeductions, currency)} deductions)`
            : ''}
        </p>
      )}

      {(bankName || accountNumber || taxNumber) && (
        <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Payment details
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[var(--muted)]">Bank</dt>
              <dd className="font-medium">{bankName || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Account</dt>
              <dd className="font-medium">{accountNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Tax number</dt>
              <dd className="font-medium">{taxNumber || '—'}</dd>
            </div>
          </dl>
        </section>
      )}

      {lastPayroll && (
        <section className="border-t border-[var(--card-border)] pt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Last salary payment
          </p>
          <div className="rounded-lg border border-[var(--card-border)] p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {formatPayPeriodMonth(lastPayroll.periodStart, lastPayroll.periodEnd)}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Status: {lastPayroll.status ?? 'Pending'}
                  {lastPayroll.paidAt
                    ? ` · Paid ${new Date(lastPayroll.paidAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <p className="text-xl font-bold text-emerald-700">
                {formatMoney(lastPayroll.netSalary, currency)}
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[var(--muted)]">Base</dt>
                <dd className="font-medium">{formatMoney(lastPayroll.baseSalary, currency)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Allowances</dt>
                <dd className="font-medium">{formatMoney(lastPayroll.totalAllowances, currency)}</dd>
              </div>
              {(lastPayroll.totalBonuses ?? 0) > 0 && (
                <div>
                  <dt className="text-[var(--muted)]">Bonuses</dt>
                  <dd className="font-medium">{formatMoney(lastPayroll.totalBonuses!, currency)}</dd>
                </div>
              )}
              {(lastPayroll.overtimePay ?? 0) > 0 && (
                <div>
                  <dt className="text-[var(--muted)]">Overtime</dt>
                  <dd className="font-medium">{formatMoney(lastPayroll.overtimePay!, currency)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[var(--muted)]">Deductions</dt>
                <dd className="font-medium">{formatMoney(lastPayroll.totalDeductions, currency)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Tax</dt>
                <dd className="font-medium">{formatMoney(lastPayroll.tax, currency)}</dd>
              </div>
              {(lastPayroll.loanDeduction ?? 0) > 0 && (
                <div>
                  <dt className="text-[var(--muted)]">Loan</dt>
                  <dd className="font-medium">{formatMoney(lastPayroll.loanDeduction!, currency)}</dd>
                </div>
              )}
              {(lastPayroll.latePenalty ?? 0) > 0 && (
                <div>
                  <dt className="text-[var(--muted)]">Late penalty</dt>
                  <dd className="font-medium">{formatMoney(lastPayroll.latePenalty!, currency)}</dd>
                </div>
              )}
              {(lastPayroll.leaveDeduction ?? 0) > 0 && (
                <div>
                  <dt className="text-[var(--muted)]">Leave deduction</dt>
                  <dd className="font-medium">{formatMoney(lastPayroll.leaveDeduction!, currency)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}
