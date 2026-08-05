'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LearningSubnav } from '@/components/learning/learning-subnav';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface EmployeeSkill {
  id: string;
  rating: number;
  skill: { id: string; name: string; category: string };
}

interface Recommendation {
  skillId: string;
  name: string;
  rating: number;
  suggestion: string;
}

export default function LearningSkillsPage() {
  const { token } = useAuth();
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const load = useCallback(() => {
    if (!token) return;
    api<EmployeeSkill[]>('/learning/skills/me', { token }).then((r) => setSkills(r.data ?? []));
    api<Recommendation[]>('/learning/skills/recommendations', { token }).then((r) =>
      setRecommendations(r.data ?? []),
    );
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const setRating = async (skillId: string, rating: number) => {
    if (!token) return;
    await api(`/learning/skills/${skillId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ rating }),
    });
    load();
  };

  return (
    <ProtectedLayout>
      <h1 className="mb-2 text-2xl font-bold">Skills Matrix</h1>
      <p className="mb-4 text-sm text-slate-500">Rate your skills 1–5 stars. The tutor recommends strengthening lower-rated skills.</p>
      <LearningSubnav />

      {recommendations.length > 0 && (
        <Card className="mt-4 border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900">
          <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">Recommended focus areas</p>
          <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
            {recommendations.map((r) => (
              <li key={r.skillId}>• {r.suggestion}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((es) => (
          <Card key={es.id} className="p-4">
            <p className="font-medium text-slate-900 dark:text-slate-100">{es.skill.name}</p>
            <p className="text-xs text-slate-500">{es.skill.category}</p>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(es.skill.id, n)}
                  className={`text-lg ${n <= es.rating ? 'text-amber-400' : 'text-slate-300'}`}
                  aria-label={`Rate ${n}`}
                >
                  ★
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </ProtectedLayout>
  );
}
