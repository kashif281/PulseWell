'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LearningSubnav } from '@/components/learning/learning-subnav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

interface Path {
  id: string;
  title: string;
  description: string | null;
  track: string;
  modules: Array<{
    id: string;
    title: string;
    summary: string | null;
    durationMin: number;
  }>;
  progress: Array<{
    moduleId: string;
    status: string;
  }>;
}

export default function LearningPathsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [paths, setPaths] = useState<Path[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api<Path[]>('/learning/paths', { token }).then((r) => setPaths(r.data ?? []));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const complete = async (moduleId: string) => {
    if (!token) return;
    setCompleting(moduleId);
    try {
      await api(`/learning/modules/${moduleId}/complete`, {
        method: 'POST',
        token,
        body: JSON.stringify({ minutes: 20 }),
      });
      toast.success('Module completed — certificates may unlock when the path is finished');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark complete');
    } finally {
      setCompleting(null);
    }
  };

  return (
    <ProtectedLayout>
      <h1 className="mb-2 text-2xl font-bold">Learning Paths</h1>
      <p className="mb-4 text-sm text-slate-500">
        Role-based modules for your department. Finish every module to earn linked certificates.
      </p>
      <LearningSubnav />
      <div className="mt-4 space-y-4">
        {paths.map((path) => {
          const done = new Set(
            path.progress?.filter((p) => p.status === 'COMPLETED').map((p) => p.moduleId) ?? [],
          );
          const completedCount = path.modules.filter((m) => done.has(m.id)).length;
          const pct =
            path.modules.length > 0 ? Math.round((completedCount / path.modules.length) * 100) : 0;

          return (
            <Card key={path.id} className="p-4">
              <div className="mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{path.title}</h2>
                  <span className="text-xs font-medium text-indigo-600">
                    {completedCount}/{path.modules.length} · {pct}%
                  </span>
                </div>
                <p className="text-xs text-indigo-600">{path.track.replace(/_/g, ' ')}</p>
                {path.description && <p className="mt-1 text-sm text-slate-500">{path.description}</p>}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <ul className="space-y-2">
                {path.modules.map((m) => {
                  const isDone = done.has(m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {isDone && <span className="mr-1 text-emerald-600">✓</span>}
                          {m.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {m.summary} · {m.durationMin} min
                        </p>
                      </div>
                      {isDone ? (
                        <span className="text-xs font-medium text-emerald-600">Completed</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => complete(m.id)}
                          disabled={completing === m.id}
                        >
                          {completing === m.id ? 'Saving...' : 'Mark complete'}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </ProtectedLayout>
  );
}
