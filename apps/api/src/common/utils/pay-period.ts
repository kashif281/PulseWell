/** e.g. "June 2026" — uses the period end date as the pay month */
export function formatPayPeriodMonth(
  periodStart: Date | string,
  periodEnd?: Date | string,
): string {
  const end = periodEnd ? new Date(periodEnd) : new Date(periodStart);
  return end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
