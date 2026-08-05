'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  User,
  Users,
  DollarSign,
  FileText,
  Bell,
  LogOut,
  Building2,
  Shield,
  ScrollText,
  Clock,
  Calendar,
  Wallet,
  CheckSquare,
  Moon,
  Sun,
  Menu,
  X,
  CloudRain,
  Package,
  Sparkles,
  GraduationCap,
  Mail,
  Plug,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/ui/logo';
import { UserRole } from '@pulseai/types';

const employeeNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/team', label: "Who's Working", icon: Users },
  { href: '/leave', label: 'Leave', icon: Calendar },
  { href: '/equipment', label: 'My Equipment', icon: Package },
  { href: '/salary', label: 'My Salary', icon: Wallet },
  { href: '/learning', label: 'Learning', icon: GraduationCap },
  { href: '/policies', label: 'Policies', icon: ScrollText },
  { href: '/profile', label: 'Profile', icon: User },
];

const adminNav = [
  { href: '/admin/dashboard', label: 'Company Dashboard', icon: LayoutDashboard },
  { href: '/admin/attendance', label: 'Attendance', icon: Clock },
  { href: '/admin/weather', label: 'Weather WFH', icon: CloudRain },
  { href: '/admin/assets', label: 'Assets', icon: Package },
  { href: '/admin/leave', label: 'Leave', icon: Calendar },
  { href: '/admin/payroll', label: 'Payroll', icon: Wallet },
  { href: '/admin/approvals', label: 'Approvals', icon: CheckSquare },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/admin/policies', label: 'Policies', icon: ScrollText },
  { href: '/admin/hr-ai', label: 'HR AI', icon: Sparkles },
  { href: '/admin/learning', label: 'Learning Analytics', icon: GraduationCap },
  { href: '/admin/spending', label: 'Spending', icon: DollarSign },
  { href: '/admin/hr-reports', label: 'HR Reports', icon: FileText },
];

const superAdminNav = [
  { href: '/superadmin/dashboard', label: 'Platform Stats', icon: Shield },
  { href: '/superadmin/companies', label: 'Companies', icon: Building2 },
  { href: '/superadmin/users', label: 'All Users', icon: Users },
  { href: '/superadmin/logs', label: 'Activity Logs', icon: ScrollText },
];

const superAdminCompanyNav = [
  { href: '/admin/dashboard', label: 'Company Dashboard', icon: LayoutDashboard },
  { href: '/admin/attendance', label: 'Attendance', icon: Clock },
  { href: '/admin/weather', label: 'Weather WFH', icon: CloudRain },
  { href: '/admin/assets', label: 'Assets', icon: Package },
  { href: '/admin/leave', label: 'Leave', icon: Calendar },
  { href: '/admin/payroll', label: 'Payroll', icon: Wallet },
  { href: '/admin/approvals', label: 'Approvals', icon: CheckSquare },
  { href: '/admin/employees', label: 'Employees', icon: Users },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
  { href: '/admin/policies', label: 'Policies', icon: ScrollText },
  { href: '/admin/hr-ai', label: 'HR AI', icon: Sparkles },
  { href: '/admin/learning', label: 'Learning Analytics', icon: GraduationCap },
  { href: '/admin/spending', label: 'Spending', icon: DollarSign },
  { href: '/admin/hr-reports', label: 'HR Reports', icon: FileText },
];

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: typeof employeeNav;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nav.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--foreground)] dark:hover:bg-slate-800',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const isCompanyAdmin = user?.role === UserRole.COMPANY_ADMIN;

  let nav = employeeNav;
  if (isSuperAdmin) nav = [...superAdminNav, ...superAdminCompanyNav];
  else if (isCompanyAdmin) nav = adminNav;

  const handleLogout = () => {
    logout();
    onClose?.();
    router.push('/login');
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-[var(--card-border)] bg-[var(--sidebar)] transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-5">
          <div className="flex items-center gap-2">
            <LogoMark size={36} />
            <div>
              <h1 className="text-lg font-bold text-[var(--foreground)]">Nura</h1>
              <p className="text-xs text-[var(--muted)]">AI HR Platform</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--muted)] hover:bg-slate-100 lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLinks nav={nav} pathname={pathname} onNavigate={onClose} />
        </nav>

        <div className="border-t border-[var(--card-border)] p-4">
          <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--card)]/95 px-4 py-3 backdrop-blur-sm lg:px-8 lg:py-4">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm font-medium text-[var(--muted)] lg:block">
            Workforce Operations
          </div>
          <Link
            href="/notifications"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </header>
        <div className="flex-1 p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
