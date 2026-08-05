'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/learning', label: 'AI Tutor' },
  { href: '/learning/paths', label: 'Learning Paths' },
  { href: '/learning/skills', label: 'Skills' },
  { href: '/learning/challenges', label: 'Coding' },
  { href: '/learning/certificates', label: 'Certificates' },
];

export function LearningSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            pathname === link.href
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
