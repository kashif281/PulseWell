'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { LogoMark } from '@/components/ui/logo';
import { Card } from '@/components/ui/card';
import { api, storeTokens, storeUser } from '@/lib/api';
import { CheckCircle2 } from 'lucide-react';

interface InvitationInfo {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName: string;
  expiresAt?: string | null;
}

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    api<InvitationInfo>(`/auth/invitation/${token}`)
      .then((r) => setInfo(r.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid invitation'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!token) return;
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!form.acceptTerms || !form.acceptPrivacy) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; firstName?: string; lastName?: string; role: string };
      }>(`/auth/invitation/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          password: form.password,
          phoneNumber: form.phoneNumber || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          address: form.address || undefined,
          emergencyContact: form.emergencyContact || undefined,
          emergencyPhone: form.emergencyPhone || undefined,
          acceptTerms: form.acceptTerms,
          acceptPrivacy: form.acceptPrivacy,
        }),
      });

      const data = res.data;
      if (data?.accessToken && data?.refreshToken) {
        storeTokens(data.accessToken, data.refreshToken);
        if (data.user) storeUser(data.user);
      }
      setStep(5);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)]">Validating invitation…</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => router.push('/login')}>
            Go to login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] p-4">
      <div className="mb-6 flex items-center gap-2">
        <LogoMark size={40} />
        <span className="text-xl font-bold">Nura</span>
      </div>

      <Card className="w-full max-w-lg p-6">
        {step === 5 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h1 className="mt-4 text-xl font-bold">You&apos;re all set!</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Redirecting to your dashboard…</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              Welcome to {info?.companyName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Hi {info?.firstName}, complete setup for <strong>{info?.email}</strong>
            </p>

            <div className="mb-6 mt-4 flex gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                />
              ))}
            </div>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                  Your email <strong>{info?.email}</strong> has been verified. Continue to create
                  your password and complete your profile.
                </p>
                <Button className="w-full" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <PasswordInput
                  id="password"
                  label="Create password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <PasswordInput
                  id="confirmPassword"
                  label="Confirm password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <Input
                  id="phone"
                  label="Phone number"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
                <Input
                  id="dob"
                  label="Date of birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
                <Input
                  id="address"
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <Input
                  id="emergency"
                  label="Emergency contact name"
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                />
                <Input
                  id="emergencyPhone"
                  label="Emergency contact phone"
                  value={form.emergencyPhone}
                  onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(4)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                    className="mt-1"
                  />
                  <span>I accept the Terms of Service</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.acceptPrivacy}
                    onChange={(e) => setForm({ ...form, acceptPrivacy: e.target.checked })}
                    className="mt-1"
                  />
                  <span>I accept the Privacy Policy</span>
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button className="flex-1" isLoading={saving} onClick={submit}>
                    Activate account
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
