'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';

interface Department {
  id: string;
  name: string;
}

interface Manager {
  id: string;
  user: { firstName?: string; lastName?: string };
}

export function AddEmployeeModal({
  open,
  onClose,
  token,
  companyQuery = '',
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  token: string | null;
  companyQuery?: string;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    departmentId: '',
    position: '',
    managerId: '',
    employmentType: 'FULL_TIME',
    joiningDate: '',
    sendInvitation: true,
  });

  useEffect(() => {
    if (!open || !token) return;
    api<Department[]>(`/company/departments${companyQuery}`, { token })
      .then((r) => setDepartments(r.data ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load departments'));
    api<Manager[]>(`/employees${companyQuery}`, { token })
      .then((r) => setManagers(r.data ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load managers'));
  }, [open, token, companyQuery, toast]);

  const reset = () => {
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      departmentId: '',
      position: '',
      managerId: '',
      employmentType: 'FULL_TIME',
      joiningDate: '',
      sendInvitation: true,
    });
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await api(`/employees${companyQuery}`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          departmentId: form.departmentId || undefined,
          position: form.position || undefined,
          managerId: form.managerId || undefined,
          employmentType: form.employmentType,
          joiningDate: form.joiningDate || undefined,
          sendInvitation: form.sendInvitation,
        }),
      });
      toast.success('Employee created and invitation sent');
      reset();
      onClose();
      onCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create employee';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add employee"
      subtitle="Required: name and email. An invitation will be sent to activate their account."
    >
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input
          id="firstName"
          label="First name *"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          required
        />
        <Input
          id="lastName"
          label="Last name *"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
        <Input
          id="email"
          label="Email *"
          type="email"
          className="sm:col-span-2"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div>
          <label className="text-sm font-medium">Department</label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">— Optional —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          id="position"
          label="Designation"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
        />
        <div>
          <label className="text-sm font-medium">Reporting manager</label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={form.managerId}
            onChange={(e) => setForm({ ...form, managerId: e.target.value })}
          >
            <option value="">— Optional —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.firstName} {m.user.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Employment type</label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={form.employmentType}
            onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
          >
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
          </select>
        </div>
        <Input
          id="joiningDate"
          label="Joining date"
          type="date"
          value={form.joiningDate}
          onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.sendInvitation}
            onChange={(e) => setForm({ ...form, sendInvitation: e.target.checked })}
          />
          Send invitation email immediately
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            Create employee
          </Button>
        </div>
      </form>
    </Modal>
  );
}
