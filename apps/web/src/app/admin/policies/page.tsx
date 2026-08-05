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
import { useToast } from '@/contexts/toast-context';
import { Plus, Pencil, Trash2, ScrollText } from 'lucide-react';

const CATEGORIES = [
  'GENERAL',
  'ATTENDANCE',
  'LEAVE',
  'WFH',
  'CONDUCT',
  'SAFETY',
  'EQUIPMENT',
] as const;

type PolicyCategory = (typeof CATEGORIES)[number];

interface CompanyPolicy {
  id: string;
  title: string;
  category: PolicyCategory;
  content: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

const EMPTY_FORM = {
  title: '',
  category: 'GENERAL' as PolicyCategory,
  content: '',
  isActive: true,
  sortOrder: 0,
};

function categoryLabel(c: string) {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function AdminPoliciesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } = useAdminCompanyScope();
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!token || !ready) return;
    api<CompanyPolicy[]>(`/company/policies${companyQuery}`, { token }).then((r) =>
      setPolicies(r.data ?? []),
    );
  }, [token, companyQuery, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (p: CompanyPolicy) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      category: p.category,
      content: p.content,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!token || !form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api(`/company/policies/${editingId}${companyQuery}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(form),
        });
        toast.success('Policy updated');
      } else {
        await api(`/company/policies${companyQuery}`, {
          method: 'POST',
          token,
          body: JSON.stringify(form),
        });
        toast.success('Policy created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!token || !confirm('Delete this policy?')) return;
    try {
      await api(`/company/policies/${id}${companyQuery}`, { method: 'DELETE', token });
      toast.success('Policy deleted');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Company Policies</h1>
            <p className="text-[var(--muted)]">
              Publish attendance, WFH, leave, and other HR policies for employees
            </p>
          </div>
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add policy
          </Button>
        </div>

        {isSuperAdmin && <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />}

        {showForm && (
          <Card title={editingId ? 'Edit policy' : 'New policy'}>
            <div className="space-y-4">
              <Input
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label className="block text-sm">
                Category
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as PolicyCategory })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Policy content
                <textarea
                  className="mt-1 min-h-[160px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Describe the policy in plain language..."
                />
              </label>
              <div className="flex flex-wrap gap-4">
                <Input
                  label="Sort order"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: +e.target.value })}
                />
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Active (visible to employees)
                </label>
              </div>
              <div className="flex gap-2">
                <Button isLoading={saving} onClick={save}>
                  {editingId ? 'Save changes' : 'Create policy'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card title={`Policies (${policies.length})`}>
          {policies.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No policies yet. Click Add policy to publish your first company policy.
            </p>
          ) : (
            <div className="space-y-3">
              {policies.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-lg border border-[var(--card-border)] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex gap-3">
                    <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{p.title}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800">
                          {categoryLabel(p.category)}
                        </span>
                        {!p.isActive && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
                        {p.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  );
}
