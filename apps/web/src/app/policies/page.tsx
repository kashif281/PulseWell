'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { ScrollText } from 'lucide-react';

interface CompanyPolicy {
  id: string;
  title: string;
  category: string;
  content: string;
  updatedAt: string;
}

function categoryLabel(c: string) {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function PoliciesPage() {
  const { token } = useAuth();
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [selected, setSelected] = useState<CompanyPolicy | null>(null);

  useEffect(() => {
    if (!token) return;
    api<CompanyPolicy[]>('/company/policies', { token }).then((r) => {
      const list = r.data ?? [];
      setPolicies(list);
      if (list[0]) setSelected(list[0]);
    });
  }, [token]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Company Policies</h1>
          <p className="text-[var(--muted)]">Official HR policies for your organization</p>
        </div>

        {policies.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              No policies have been published yet. HR will add them here.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="All policies" className="lg:col-span-1">
              <ul className="space-y-1">
                {policies.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected?.id === p.id
                          ? 'bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="block">{p.title}</span>
                      <span className="text-xs text-[var(--muted)]">{categoryLabel(p.category)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            {selected && (
              <Card className="lg:col-span-2">
                <div className="flex items-start gap-3 border-b border-[var(--card-border)] pb-4">
                  <ScrollText className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <h2 className="text-xl font-semibold">{selected.title}</h2>
                    <p className="text-sm text-[var(--muted)]">
                      {categoryLabel(selected.category)} · Updated{' '}
                      {new Date(selected.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-[var(--foreground)] dark:prose-invert">
                  {selected.content}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
