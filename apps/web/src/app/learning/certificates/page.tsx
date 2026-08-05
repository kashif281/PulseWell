'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LearningSubnav } from '@/components/learning/learning-subnav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

interface EmployeeCert {
  id: string;
  issuedAt: string;
  expiresAt: string | null;
  certificateUrl: string | null;
  certification: { id: string; title: string; description: string | null; isMandatory: boolean };
}

interface AvailableCert {
  id: string;
  title: string;
  description: string | null;
  isMandatory: boolean;
  validMonths: number | null;
  earned: boolean;
}

export default function LearningCertificatesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [certs, setCerts] = useState<EmployeeCert[]>([]);
  const [available, setAvailable] = useState<AvailableCert[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api<EmployeeCert[]>('/learning/certifications/me', { token }).then((r) => setCerts(r.data ?? []));
    api<AvailableCert[]>('/learning/certifications/available', { token }).then((r) =>
      setAvailable(r.data ?? []),
    );
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (certId: string) => {
    if (!token) return;
    setClaiming(certId);
    try {
      await api(`/learning/certifications/${certId}/issue`, { method: 'POST', token });
      toast.success('Certificate issued');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not issue certificate');
    } finally {
      setClaiming(null);
    }
  };

  const download = async (employeeCertId: string) => {
    if (!token) return;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api/v1';
      const response = await fetch(`${baseUrl}/learning/certificates/${employeeCertId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download certificate');
    }
  };

  return (
    <ProtectedLayout>
      <h1 className="mb-2 text-2xl font-bold">My Certificates</h1>
      <p className="mb-4 text-sm text-slate-500">
        Complete learning paths to earn certificates automatically, or claim available certifications below.
      </p>
      <LearningSubnav />

      {available.some((a) => !a.earned) && (
        <Card className="mt-4 p-4">
          <p className="mb-3 text-sm font-semibold">Available to claim</p>
          <div className="space-y-2">
            {available
              .filter((a) => !a.earned)
              .map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.description}</p>
                  </div>
                  <Button size="sm" onClick={() => claim(a.id)} disabled={claiming === a.id}>
                    {claiming === a.id ? 'Issuing...' : 'Claim certificate'}
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {certs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">
            No certificates yet. Complete all modules in a learning path or claim mandatory training.
          </Card>
        ) : (
          certs.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{c.certification.title}</p>
                <p className="text-xs text-slate-500">{c.certification.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Issued {new Date(c.issuedAt).toLocaleDateString()}
                  {c.expiresAt && ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                  {c.certification.isMandatory && ' · Mandatory'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(c.id)}>
                Download PDF
              </Button>
            </Card>
          ))
        )}
      </div>
    </ProtectedLayout>
  );
}
