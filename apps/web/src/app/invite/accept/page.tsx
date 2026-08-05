import { Suspense } from 'react';
import AcceptInvitationPage from './accept-content';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <AcceptInvitationPage />
    </Suspense>
  );
}
