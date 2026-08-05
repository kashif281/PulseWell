'use client';

interface CompanyOption {
  id: string;
  name: string;
}

export function CompanyFilter({
  companies,
  companyId,
  onChange,
}: {
  companies: CompanyOption[];
  companyId: string;
  onChange: (id: string) => void;
}) {
  if (companies.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
      <label className="text-sm font-medium text-[var(--foreground)]">Company</label>
      <select
        value={companyId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--muted)]">Select a company to view its data</p>
    </div>
  );
}
