'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Logo, LogoMark } from '@/components/ui/logo';
import { UserRole } from '@pulseai/types';

function homeForRole(role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) return '/superadmin/dashboard';
  if (role === UserRole.COMPANY_ADMIN) return '/admin/dashboard';
  return '/dashboard';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user = await login(email, password);
      router.push(homeForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-emerald-600 to-emerald-800 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark size={44} className="drop-shadow-sm" />
          <h1 className="text-3xl font-bold text-white">Nura</h1>
        </div>
        <h2 className="text-4xl font-bold text-white leading-tight">
          Your AI-powered<br />HR operations hub
        </h2>
        <p className="mt-4 text-lg text-emerald-100">
          Manage attendance, leave, payroll, learning, assets, and HR workflows from one place.
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Logo size={40} wordmarkClassName="text-slate-900" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-slate-500">Sign in to your Nura account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-emerald-600 hover:text-emerald-700">
              Create one
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-medium text-emerald-600 hover:text-emerald-700">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
