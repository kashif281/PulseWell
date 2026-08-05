'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { AddEmployeeModal } from '@/components/hrm/add-employee-modal';
import { InvitationDashboard } from '@/components/hrm/invitation-dashboard';
import { BulkImportPanel } from '@/components/hrm/bulk-import-panel';
import { EmployeeSalaryEditor } from '@/components/hrm/employee-salary-editor';
import { EmployeeSalarySummary } from '@/components/hrm/employee-salary-summary';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { UserPlus } from 'lucide-react';
import { UserRole } from '@pulseai/types';
import { useToast } from '@/contexts/toast-context';
import { Modal } from '@/components/ui/modal';
import {
  computeMonthlyPackage,
  formatMoney,
  formatPayPeriodMonthShort,
  parseLineItems,
} from '@/lib/salary-utils';

interface PayrollItemRow {
  id: string;
  netSalary: number | string;
  baseSalary?: number | string;
  totalAllowances?: number | string;
  totalDeductions?: number | string;
  tax?: number | string;
  payroll: { periodStart: string; periodEnd: string; status: string; paidAt?: string | null };
  salaryPayment?: { status: string; paidAt?: string | null } | null;
}

interface Employee {
  id: string;
  baseSalary?: number | string | null;
  currency?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  taxNumber?: string | null;
  payrollType?: string | null;
  paymentFrequency?: string | null;
  salaryStructure?: {
    baseSalary: number | string;
    allowances?: unknown;
    deductions?: unknown;
    currency?: string;
  } | null;
  payrollItems?: PayrollItemRow[];
  user: { firstName?: string; lastName?: string; email: string; isActive: boolean; role?: string };
  department?: { name: string };
  position?: string;
  employmentStatus?: string | null;
}

interface SalaryDetail {
  baseSalary: number;
  currency: string;
  allowances: { type: string; amount: number }[];
  deductions: { type: string; amount: number }[];
  bankName?: string | null;
  accountNumber?: string | null;
  taxNumber?: string | null;
  payrollType?: string | null;
  paymentFrequency?: string | null;
  lastPayroll?: {
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
  } | null;
}

function getStructure(emp: Employee) {
  const base = Number(emp.salaryStructure?.baseSalary ?? emp.baseSalary ?? 0);
  const allowances = parseLineItems(emp.salaryStructure?.allowances);
  const deductions = parseLineItems(emp.salaryStructure?.deductions);
  const currency = emp.salaryStructure?.currency ?? emp.currency ?? 'USD';
  return { base, allowances, deductions, currency, ...computeMonthlyPackage(base, allowances, deductions) };
}

function formatLastPaid(emp: Employee) {
  const slip = emp.payrollItems?.[0];
  if (!slip) return '—';
  const net = Number(slip.netSalary);
  const month = formatPayPeriodMonthShort(slip.payroll.periodStart, slip.payroll.periodEnd);
  return `${formatMoney(net, emp.currency ?? 'USD')} · ${month}`;
}

export default function AdminEmployeesPage() {
  const { token, user } = useAuth();
  const toast = useToast();
  const canManageInvitations = user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const { isSuperAdmin, companies, companyId, setCompanyId, companyQuery, ready } =
    useAdminCompanyScope();
  const [tab, setTab] = useState<'team' | 'invitations' | 'import'>('team');
  const [addOpen, setAddOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingName, setViewingName] = useState('');
  const [salaryDetail, setSalaryDetail] = useState<SalaryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionsFor, setActionsFor] = useState<Employee | null>(null);

  const loadEmployees = () => {
    if (!token || !ready) return;
    api<Employee[]>(`/employees${companyQuery}`, { token })
      .then((res) => setEmployees(res.data ?? []))
      .catch(console.error);
  };

  useEffect(() => {
    loadEmployees();
  }, [token, companyQuery, ready]);

  useEffect(() => {
    if (!token || !viewingId) {
      setSalaryDetail(null);
      return;
    }
    setDetailLoading(true);
    api<SalaryDetail>(`/hrm/employees/${viewingId}/salary`, { token })
      .then((res) => setSalaryDetail(res.data ?? null))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [token, viewingId]);

  const statusLabel = (emp: Employee) => {
    const s = emp.employmentStatus;
    if (s === 'ACTIVE' || s === 'PROBATION') return emp.user.isActive ? 'Active' : 'Inactive';
    if (s === 'INVITATION_PENDING') return 'Invitation pending';
    if (s === 'INVITATION_SENT') return 'Invitation sent';
    if (s === 'INVITATION_EXPIRED') return 'Invitation expired';
    if (s === 'SUSPENDED') return 'Suspended';
    return s?.replace(/_/g, ' ').toLowerCase() ?? (emp.user.isActive ? 'Active' : 'Inactive');
  };

  const openSalaryDetails = (emp: Employee) => {
    setViewingId(emp.id);
    setViewingName(`${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim());
  };

  const handleToggleManager = async (emp: Employee) => {
    if (!token) return;
    const nextRole = emp.user.role === 'MANAGER' ? 'EMPLOYEE' : 'MANAGER';
    try {
      await api(`/employees/${emp.id}/role${companyQuery}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role: nextRole }),
      });
      toast.success(nextRole === 'MANAGER' ? 'Promoted to Manager' : 'Manager access removed');
      loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleDelete = async (emp: Employee) => {
    const name = `${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim() || emp.user.email;
    if (!token || !confirm(`Remove ${name} from the team? Their account will be deactivated and their history preserved.`)) return;
    try {
      await api(`/employees/${emp.id}${companyQuery}`, { method: 'DELETE', token });
      toast.success(`${name} removed from the team`);
      loadEmployees();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove employee');
    }
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Employees</h1>
            <p className="text-slate-500">Invite, onboard, and manage your team</p>
          </div>
          {canManageInvitations && (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add employee
            </Button>
          )}
        </div>

        {isSuperAdmin && (
          <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
        )}

        <div className="flex flex-wrap gap-2 border-b border-[var(--card-border)]">
          {(
            [
              { id: 'team' as const, label: 'Team roster' },
              ...(canManageInvitations
                ? [
                    { id: 'invitations' as const, label: 'Invitations' },
                    { id: 'import' as const, label: 'Bulk import' },
                  ]
                : []),
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'invitations' && (
          <InvitationDashboard token={token} companyQuery={companyQuery} />
        )}

        {tab === 'import' && (
          <BulkImportPanel token={token} companyQuery={companyQuery} onImported={loadEmployees} />
        )}

        {tab === 'team' && (
        <Card title={`Team (${employees.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Department</th>
                  <th className="pb-3 pr-4 font-medium">Base</th>
                  <th className="pb-3 pr-4 font-medium">Gross / mo</th>
                  <th className="pb-3 pr-4 font-medium">Net / mo</th>
                  <th className="pb-3 pr-4 font-medium">Last paid</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const pkg = getStructure(emp);
                  return (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-slate-900">
                          {emp.user.firstName} {emp.user.lastName}
                        </span>
                        <p className="text-xs text-slate-500">{emp.user.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {emp.department?.name ?? '—'}
                        {emp.position && <span className="block text-xs text-slate-400">{emp.position}</span>}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {pkg.base > 0 ? formatMoney(pkg.base, pkg.currency) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {pkg.gross > 0 ? formatMoney(pkg.gross, pkg.currency) : '—'}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {pkg.net > 0 ? formatMoney(pkg.net, pkg.currency) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{formatLastPaid(emp)}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          emp.employmentStatus === 'ACTIVE' || emp.employmentStatus === 'PROBATION'
                            ? 'bg-emerald-50 text-emerald-700'
                            : emp.employmentStatus?.startsWith('INVITATION')
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          {statusLabel(emp)}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          onClick={() => setActionsFor(emp)}
                        >
                          Actions
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        )}

        <AddEmployeeModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          token={token}
          companyQuery={companyQuery}
          onCreated={loadEmployees}
        />

        <Modal
          open={!!actionsFor}
          onClose={() => setActionsFor(null)}
          title={actionsFor ? `${actionsFor.user.firstName ?? ''} ${actionsFor.user.lastName ?? ''}`.trim() || actionsFor.user.email : ''}
          subtitle={actionsFor?.department?.name}
        >
          {actionsFor && (
            <div className="flex flex-col divide-y divide-slate-100">
              <button
                type="button"
                className="py-3 text-left text-sm font-medium text-slate-700 hover:text-emerald-700"
                onClick={() => {
                  openSalaryDetails(actionsFor);
                  setActionsFor(null);
                }}
              >
                Salary details
              </button>
              <button
                type="button"
                className="py-3 text-left text-sm font-medium text-slate-700 hover:text-emerald-700"
                onClick={() => {
                  setEditingId(actionsFor.id);
                  setEditingName(`${actionsFor.user.firstName ?? ''} ${actionsFor.user.lastName ?? ''}`.trim());
                  setActionsFor(null);
                }}
              >
                Edit salary
              </button>
              {canManageInvitations && (
                <button
                  type="button"
                  className="py-3 text-left text-sm font-medium text-slate-700 hover:text-emerald-700"
                  onClick={() => {
                    handleToggleManager(actionsFor);
                    setActionsFor(null);
                  }}
                >
                  {actionsFor.user.role === 'MANAGER' ? 'Remove manager access' : 'Make manager'}
                </button>
              )}
              <button
                type="button"
                className="py-3 text-left text-sm font-medium text-red-600 hover:text-red-700"
                onClick={() => {
                  handleDelete(actionsFor);
                  setActionsFor(null);
                }}
              >
                Delete employee
              </button>
            </div>
          )}
        </Modal>

        {viewingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold">Salary details — {viewingName}</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-emerald-600 hover:underline"
                    onClick={() => {
                      setViewingId(null);
                      setEditingId(viewingId);
                      setEditingName(viewingName);
                    }}
                  >
                    Edit salary
                  </button>
                  <button
                    type="button"
                    className="text-sm text-slate-500 hover:text-slate-800"
                    onClick={() => setViewingId(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
              {detailLoading && <p className="text-sm text-[var(--muted)]">Loading salary details…</p>}
              {!detailLoading && salaryDetail && (
                <EmployeeSalarySummary
                  baseSalary={salaryDetail.baseSalary}
                  currency={salaryDetail.currency}
                  allowances={salaryDetail.allowances}
                  deductions={salaryDetail.deductions}
                  bankName={salaryDetail.bankName}
                  accountNumber={salaryDetail.accountNumber}
                  taxNumber={salaryDetail.taxNumber}
                  payrollType={salaryDetail.payrollType}
                  paymentFrequency={salaryDetail.paymentFrequency}
                  lastPayroll={salaryDetail.lastPayroll}
                />
              )}
            </div>
          </div>
        )}

        {editingId && token && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Edit salary — {editingName}</h2>
                <button
                  type="button"
                  className="text-sm text-slate-500 hover:text-slate-800"
                  onClick={() => setEditingId(null)}
                >
                  Close
                </button>
              </div>
              <EmployeeSalaryEditor
                employeeId={editingId}
                token={token}
                onSaved={() => {
                  loadEmployees();
                  setEditingId(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
