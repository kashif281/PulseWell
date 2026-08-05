'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { LeaveRequestPanel } from '@/components/hrm/leave-request-panel';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Balance {
  id: string;
  remaining: number;
  allocated: number;
  used: number;
  leaveType: { id: string; name: string; code: string };
}

export default function LeavePage() {
  const { token } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);

  useEffect(() => {
    if (!token) return;
    api<Balance[]>('/hrm/leave/balances', { token }).then((r) => setBalances(r.data ?? []));
  }, [token]);

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Leave & Time Off</h1>
          <p className="text-[var(--muted)]">
            Apply for full-day leave, half-day leave, or work from home
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances
            .filter((b) => b.leaveType.code !== 'UNPAID' || b.remaining > 0)
            .map((b) => (
              <Card key={b.id}>
                <p className="text-sm text-[var(--muted)]">{b.leaveType.name}</p>
                <p className="text-2xl font-bold">{b.remaining}</p>
                <p className="text-xs text-[var(--muted)]">
                  {b.used} used · {b.allocated} total
                </p>
              </Card>
            ))}
        </div>

        <Card title="Time off">
          <LeaveRequestPanel token={token} />
        </Card>
      </div>
    </ProtectedLayout>
  );
}
