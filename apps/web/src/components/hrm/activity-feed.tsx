'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api, getStoredToken } from '@/lib/api';
import { Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  employee?: {
    user?: { firstName?: string; lastName?: string; avatarUrl?: string | null };
    department?: { name: string } | null;
  } | null;
}

export function ActivityFeed({ token }: { token: string | null }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const load = useCallback(() => {
    if (!token) return;
    api<ActivityItem[]>('/hrm/activity/feed?limit=15', { token })
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const accessToken = token ?? getStoredToken();
    if (!accessToken) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    const streamUrl = `${apiBase.startsWith('/') ? apiBase : apiBase}/hrm/attendance/stream?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(streamUrl);
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as { type?: string };
        if (parsed.type === 'activity') load();
      } catch {
        load();
      }
    };
    return () => es.close();
  }, [token, load]);

  if (!items.length) return null;

  return (
    <Card title="Recent activity" subtitle="Check-ins, breaks, and leave updates">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Activity className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--foreground)]">{item.message}</p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
