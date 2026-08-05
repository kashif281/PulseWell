export interface SalaryLineItem {
  type: string;
  amount: number;
}

export function parseLineItems(value: unknown): SalaryLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { type: string; amount: number } => {
      return (
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        'amount' in item
      );
    })
    .map((item) => ({ type: String(item.type), amount: Number(item.amount) || 0 }));
}

export function formatSalaryLabel(type: string) {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeMonthlyPackage(
  baseSalary: number,
  allowances: SalaryLineItem[],
  deductions: SalaryLineItem[],
) {
  const totalAllowances = allowances.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
  const gross = baseSalary + totalAllowances;
  const net = gross - totalDeductions;
  return { totalAllowances, totalDeductions, gross, net };
}

export function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** e.g. "June 2026" — uses the period end date as the pay month */
export function formatPayPeriodMonth(
  periodStart: string | Date,
  periodEnd?: string | Date,
) {
  const end = periodEnd ? new Date(periodEnd) : new Date(periodStart);
  return end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** e.g. "Jun 2026" — compact label for tables */
export function formatPayPeriodMonthShort(
  periodStart: string | Date,
  periodEnd?: string | Date,
) {
  const end = periodEnd ? new Date(periodEnd) : new Date(periodStart);
  return end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
