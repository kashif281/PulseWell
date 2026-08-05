'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Send,
  Bot,
  User,
  MessageSquarePlus,
  History,
  FileDown,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

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

interface HrPolicyDraft {
  title: string;
  category: string;
  content: string;
  version?: string;
  effectiveDate?: string;
}

const WELCOME_MESSAGE =
  'Hello! I am your HR AI assistant. I can draft company policies, handbook sections, HR letters, and announcements. Try: "Create a work-from-home policy for our team."';

function sessionLabel(session: ChatSessionSummary) {
  return session.title?.trim() || 'HR conversation';
}

export default function AdminHrAiPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { isSuperAdmin, companies, companyId, setCompanyId, ready } = useAdminCompanyScope();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [draftPolicy, setDraftPolicy] = useState<HrPolicyDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const companyBody = isSuperAdmin && companyId ? { companyId } : {};

  const loadSessions = useCallback(() => {
    if (!token || !ready) return;
    api<ChatSessionSummary[]>('/ai/sessions?agentType=HR', { token }).then((res) => {
      setSessions(res.data ?? []);
    });
  }, [token, ready]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = () => {
    setSessionId(undefined);
    setDraftPolicy(null);
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
  };

  const openSession = async (id: string) => {
    if (!token || isLoading) return;
    setLoadingSessionId(id);
    try {
      const res = await api<{
        id: string;
        messages: { role: string; content: string }[];
        metadata?: { draftPolicy?: HrPolicyDraft };
      }>(`/ai/sessions/${id}?agentType=HR`, { token });
      if (res.data?.messages?.length) {
        setSessionId(res.data.id);
        setMessages(
          res.data.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        );
        setDraftPolicy(res.data.metadata?.draftPolicy ?? null);
      }
    } finally {
      setLoadingSessionId(null);
    }
  };

  const sendChat = async (userMessage: string) => {
    if (!token || isLoading || !ready) return;
    if (isSuperAdmin && !companyId) {
      toast.error('Select a company first');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await api<{
        sessionId: string;
        message: string;
        draftPolicy?: HrPolicyDraft;
      }>('/ai/chat', {
        method: 'POST',
        token,
        body: JSON.stringify({
          message: userMessage,
          agentType: 'HR',
          sessionId,
          ...companyBody,
        }),
      });

      if (res.data) {
        setSessionId(res.data.sessionId);
        setMessages((prev) => [...prev, { role: 'assistant', content: res.data!.message }]);
        if (res.data.draftPolicy) setDraftPolicy(res.data.draftPolicy);
        loadSessions();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    sendChat(msg);
  };

  const publishDraft = async () => {
    if (!token || !sessionId) {
      toast.error('Start a conversation and generate a policy first');
      return;
    }
    setPublishing(true);
    try {
      const res = await api<{ policy: { id: string; title: string }; pdfUrl: string }>(
        '/ai/hr/publish-draft',
        {
          method: 'POST',
          token,
          body: JSON.stringify({ sessionId, ...companyBody }),
        },
      );
      toast.success(`Published "${res.data?.policy?.title ?? 'policy'}" to company policies`);
      setDraftPolicy(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish policy');
    } finally {
      setPublishing(false);
    }
  };

  const exportPdf = async () => {
    if (!token || !sessionId) return;
    setExporting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api/v1';
      const response = await fetch(`${baseUrl}/ai/hr/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, ...companyBody }),
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(draftPolicy?.title ?? 'company-policy').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-6 w-6 text-violet-600" />
            HR AI Workspace
          </h1>
          <p className="text-sm text-slate-500">
            Draft policies, handbook sections, and HR documents — then say &quot;save this to
            policies&quot; or use the buttons below.
          </p>
        </div>
        {isSuperAdmin && (
          <CompanyFilter
            companies={companies}
            companyId={companyId}
            onChange={setCompanyId}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <aside className="w-full shrink-0 xl:w-56">
          <Card className="sticky top-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sessions</h2>
              </div>
              <Button size="sm" variant="outline" onClick={startNewChat} disabled={isLoading}>
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {sessions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-slate-700">
                No HR sessions yet.
              </p>
            ) : (
              <ul className="max-h-[520px] space-y-1 overflow-y-auto">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => openSession(session.id)}
                      disabled={isLoading || loadingSessionId === session.id}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        sessionId === session.id
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="truncate text-xs font-medium">{sessionLabel(session)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {session._count.messages} msgs
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {sessionId && messages.length > 1 && (
            <Card className="border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                    {draftPolicy ? 'Policy draft ready' : 'Ready to publish'}
                  </p>
                  {draftPolicy ? (
                    <>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {draftPolicy.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {draftPolicy.category} · v{draftPolicy.version ?? '1.0'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Publish the latest policy from this chat to Admin → Policies
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting}>
                    <FileDown className="mr-1 h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                  <Button size="sm" onClick={publishDraft} disabled={publishing}>
                    <ScrollText className="mr-1 h-3.5 w-3.5" />
                    Publish to Policies
                  </Button>
                  <Link href="/admin/policies">
                    <Button size="sm" variant="ghost">
                      View policies
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          <Card className="flex min-h-[480px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      msg.role === 'user' ? 'bg-violet-600' : 'bg-slate-200'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-slate-600" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                    <Bot className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-2.5 dark:bg-slate-800">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.1s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 dark:border-slate-700">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder='e.g. "Create an attendance policy with 9 AM start time"'
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-900"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
