'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { LogoMark } from '@/components/ui/logo';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100">
      <div className="text-center">
        <div className="mx-auto mb-4 flex w-fit animate-pulse justify-center">
          <LogoMark size={64} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Nura</h1>
        <p className="mt-2 text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
