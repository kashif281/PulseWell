'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@pulseai/types';

interface CompanyOption {
  id: string;
  name: string;
  _count?: { employees?: number };
}

function sortCompaniesBySize(companies: CompanyOption[]) {
  return [...companies].sort(
    (a, b) => (b._count?.employees ?? 0) - (a._count?.employees ?? 0),
  );
}

export function useAdminCompanyScope() {
  const { user, token } = useAuth();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!isSuperAdmin || !token) return;
    api<{ companies: CompanyOption[] }>('/admin/companies?limit=100', { token })
      .then((res) => {
        const sorted = sortCompaniesBySize(res.data?.companies ?? []);
        setCompanies(sorted);
        if (sorted.length) {
          setCompanyId((current) => current || sorted[0].id);
        }
      })
      .catch(() => {});
  }, [isSuperAdmin, token]);

  const effectiveCompanyId = isSuperAdmin ? companyId : (user?.companyId ?? '');
  const companyQuery = effectiveCompanyId ? `?companyId=${effectiveCompanyId}` : '';
  const ready = Boolean(!isSuperAdmin || effectiveCompanyId);

  return {
    isSuperAdmin,
    companies,
    companyId: effectiveCompanyId,
    setCompanyId,
    companyQuery,
    ready,
  };
}
