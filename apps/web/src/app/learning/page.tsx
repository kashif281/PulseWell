'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, MessageSquarePlus, History, GraduationCap } from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LearningSubnav } from '@/components/learning/learning-subnav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSessionSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

interface LearningMaterial {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
}

interface QuizQuestion {
  number: number;
  question: string;
  options: string[];
}

const WELCOME =
  'Hi! I am your Nura Learning Agent. I can explain topics, quiz you, run mock interviews, review code, and build study plans. Try: "Explain React hooks" or "Quiz me on TypeScript".';

const QUICK_PROMPTS = [
  'Recommend what I should learn next',
  'Quiz me on JavaScript',
  'Start a React mock interview',
  'Give me a coding challenge on arrays',
  'Build a 2-week study plan',
];

export default function LearningPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [streak, setStreak] = useState({ currentStreak: 0, totalMinutes: 0 });
  const [activeQuiz, setActiveQuiz] = useState<{
    quizId: string;
    questions: QuizQuestion[];
  } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(() => {
    if (!token) return;
    api<ChatSessionSummary[]>('/ai/sessions?agentType=LEARNING', { token }).then((r) =>
      setSessions(r.data ?? []),
    );
    api<LearningMaterial[]>('/learning/materials', { token }).then((r) =>
      setMaterials(r.data ?? []),
    );
    api<{ currentStreak: number; totalMinutes: number }>('/learning/streak', { token }).then((r) => {
      if (r.data) setStreak(r.data);
    });
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeQuiz]);

  const sendChat = async (text: string) => {
    if (!token || isLoading) return;
    setMessages((p) => [...p, { role: 'user', content: text }]);
    setIsLoading(true);
    try {
      const res = await api<{
        sessionId: string;
        message: string;
        metadata?: {
          quizId?: string;
          quizDraft?: { questions: QuizQuestion[] };
          challengeId?: string;
        };
      }>('/ai/chat', {
        method: 'POST',
        token,
        body: JSON.stringify({ message: text, agentType: 'LEARNING', sessionId }),
      });
      if (res.data) {
        setSessionId(res.data.sessionId);
        setMessages((p) => [...p, { role: 'assistant', content: res.data!.message }]);
        if (res.data.metadata?.quizId && res.data.metadata?.quizDraft?.questions) {
          setActiveQuiz({
            quizId: res.data.metadata.quizId,
            questions: res.data.metadata.quizDraft.questions,
          });
          setQuizAnswers({});
        }
        loadSessions();
      }
    } catch {
      setMessages((p) => [
        ...p,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!token || !activeQuiz) return;
    const res = await api<{ score: number }>(`/learning/quiz/${activeQuiz.quizId}/submit`, {
      method: 'POST',
      token,
      body: JSON.stringify({ answers: quizAnswers }),
    });
    setMessages((p) => [
      ...p,
      {
        role: 'assistant',
        content: `Quiz complete! Your score: ${res.data?.score ?? 0}/100. Ask me to explain any questions you missed.`,
      },
    ]);
    setActiveQuiz(null);
    loadSessions();
  };

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            Learning & Skills
          </h1>
          <p className="text-sm text-slate-500">
            Streak: {streak.currentStreak} days · {streak.totalMinutes} min learned
          </p>
        </div>
      </div>
      <LearningSubnav />

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => sendChat(p)}
            disabled={isLoading}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 xl:flex-row">
        <aside className="w-full shrink-0 xl:w-52">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Sessions</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSessionId(undefined);
                  setMessages([{ role: 'assistant', content: WELCOME }]);
                  setActiveQuiz(null);
                }}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full truncate rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={async () => {
                      const res = await api<{ id: string; messages: Message[] }>(
                        `/ai/sessions/${s.id}?agentType=LEARNING`,
                        { token: token! },
                      );
                      if (res.data) {
                        setSessionId(res.data.id);
                        setMessages(res.data.messages as Message[]);
                      }
                    }}
                  >
                    {s.title || 'Learning chat'}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {materials.length > 0 && (
            <Card className="mt-3 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Company materials</p>
              <ul className="space-y-2 text-xs">
                {materials.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{m.title}</p>
                    {m.description && <p className="text-slate-500">{m.description}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>

        <Card className="flex min-h-[480px] flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {activeQuiz && (
              <Card className="border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900">
                <p className="mb-3 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  Active quiz — select your answers
                </p>
                {activeQuiz.questions.map((q) => (
                  <div key={q.number} className="mb-4">
                    <p className="text-sm font-medium">
                      {q.number}. {q.question}
                    </p>
                    <div className="mt-1 space-y-1">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`q-${q.number}`}
                            checked={quizAnswers[String(q.number)] === opt.charAt(0)}
                            onChange={() =>
                              setQuizAnswers((a) => ({ ...a, [String(q.number)]: opt.charAt(0) }))
                            }
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <Button size="sm" onClick={submitQuiz}>
                  Submit quiz
                </Button>
              </Card>
            )}

            {isLoading && <p className="text-sm text-slate-500">Thinking...</p>}
            <div ref={bottomRef} />
          </div>
          <form
            className="flex gap-2 border-t p-4 dark:border-slate-700"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              const t = input.trim();
              setInput('');
              sendChat(t);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything — explain, quiz, interview, study plan..."
              className="flex-1 rounded-lg border px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
