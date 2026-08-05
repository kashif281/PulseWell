'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LearningSubnav } from '@/components/learning/learning-subnav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Challenge {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  prompt: string;
  starterCode: string | null;
  language: string;
  sampleTests?: Array<{ name?: string; args: unknown[]; expected: unknown }>;
  hasHiddenTests?: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  expected?: unknown;
  actual?: unknown;
}

interface Submission {
  id: string;
  score: number | null;
  createdAt: string;
  challenge?: { title: string };
}

function storageKey(challengeId: string) {
  return `pulseai-code-draft-${challengeId}`;
}

export default function LearningChallengesPage() {
  const { token } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    api<Challenge[]>('/learning/challenges', { token }).then((r) => setChallenges(r.data ?? []));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openChallenge = async (c: Challenge) => {
    if (!token) return;
    const res = await api<Challenge>(`/learning/challenges/${c.id}`, { token });
    const full = res.data ?? c;
    setSelected(full);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey(c.id)) : null;
    setCode(saved ?? full.starterCode ?? 'function solve(input) {\n  \n}');
    setTestResults(null);
    setFeedback(null);
    setScore(null);
    const hist = await api<Submission[]>(`/learning/code/history?challengeId=${c.id}`, { token });
    setHistory(hist.data ?? []);
  };

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(storageKey(selected.id), code);
  }, [code, selected]);

  const runSampleTests = async () => {
    if (!token || !selected) return;
    setRunning(true);
    try {
      const res = await api<{ results: TestResult[]; passed: number; total: number }>(
        `/learning/challenges/${selected.id}/run-tests`,
        { method: 'POST', token, body: JSON.stringify({ code }) },
      );
      setTestResults(res.data?.results ?? null);
    } finally {
      setRunning(false);
    }
  };

  const submit = async () => {
    if (!token || !selected) return;
    setSubmitting(true);
    try {
      const res = await api<{ score: number; feedback: { review: string } }>('/learning/code/submit', {
        method: 'POST',
        token,
        body: JSON.stringify({
          challengeId: selected.id,
          code,
          language: selected.language,
        }),
      });
      setScore(res.data?.score ?? null);
      setFeedback(res.data?.feedback?.review ?? 'Submitted for review.');
      const hist = await api<Submission[]>(`/learning/code/history?challengeId=${selected.id}`, { token });
      setHistory(hist.data ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedLayout>
      <h1 className="mb-2 text-2xl font-bold">Coding Playground</h1>
      <p className="mb-4 text-sm text-slate-500">
        Syntax-highlighted editor, auto-save, sample tests, hidden tests on submit, and AI code review.
      </p>
      <LearningSubnav />

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-2 xl:col-span-1">
          {challenges.map((c) => (
            <button key={c.id} type="button" className="w-full text-left" onClick={() => openChallenge(c)}>
              <Card
                className={`p-3 transition-colors ${
                  selected?.id === c.id ? 'border-indigo-500 bg-indigo-50/50' : 'hover:bg-slate-50'
                }`}
              >
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-slate-500">{c.topic} · {c.difficulty}</p>
              </Card>
            </button>
          ))}
          {selected && history.length > 0 && (
            <Card className="p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Solution history</p>
              <ul className="space-y-1 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="text-slate-600">
                    {new Date(h.createdAt).toLocaleString()} — {h.score ?? 0}/100
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="flex flex-col p-4 xl:col-span-2">
          {selected ? (
            <>
              <h2 className="font-semibold">{selected.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selected.prompt}</p>
              {selected.sampleTests && selected.sampleTests.length > 0 && (
                <div className="mt-2 rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-800">
                  <p className="font-medium">Sample tests</p>
                  {selected.sampleTests.map((t, i) => (
                    <p key={i} className="text-slate-600">
                      {t.name ?? `test ${i + 1}`}: input {JSON.stringify(t.args)} → {JSON.stringify(t.expected)}
                    </p>
                  ))}
                  {selected.hasHiddenTests && <p className="mt-1 text-slate-500">+ hidden tests on full submit</p>}
                </div>
              )}
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-3 min-h-[260px] flex-1 rounded-lg border bg-slate-950 p-3 font-mono text-sm leading-relaxed text-emerald-400 dark:border-slate-600"
                spellCheck={false}
              />
              <p className="mt-1 text-[10px] text-slate-400">Auto-saved locally</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={runSampleTests} disabled={running}>
                  {running ? 'Running...' : 'Run sample tests'}
                </Button>
                <Button size="sm" onClick={submit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit (+ hidden tests & AI review)'}
                </Button>
              </div>
              {testResults && (
                <div className="mt-3 space-y-1 text-sm">
                  {testResults.map((t) => (
                    <p key={t.name} className={t.passed ? 'text-emerald-600' : 'text-red-600'}>
                      {t.passed ? '✓' : '✗'} {t.name}
                      {!t.passed && t.error && ` — ${t.error}`}
                    </p>
                  ))}
                </div>
              )}
              {score !== null && <p className="mt-3 text-sm font-medium text-indigo-600">Final score: {score}/100</p>}
              {feedback && (
                <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                  {feedback}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a challenge to start coding.</p>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  );
}
