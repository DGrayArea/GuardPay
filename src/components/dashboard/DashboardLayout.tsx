'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Link as LinkIcon,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';
import { LogoMark } from '@/components/brand/Logo';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
  { icon: LinkIcon, label: 'Payment links', path: '/dashboard/links' },
  { icon: CreditCard, label: 'Payments', path: '/dashboard/payments' },
  { icon: ShieldCheck, label: 'Escrow', path: '/escrow' },
  { icon: Wallet, label: 'Wallet', path: '/dashboard/wallet' },
  { icon: BarChart2, label: 'Analytics', path: '/dashboard/analytics' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  { icon: UserRound, label: 'My account', path: '/account' },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();

  // Navigating on mobile should dismiss the drawer.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const shortAddress = user?.address
    ? `${user.address.slice(0, 6)}…${user.address.slice(-4)}`
    : 'Not connected';

  const sidebar = (
    <>
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 shrink-0 text-brand" />
          {!collapsed && (
            <span className="text-[0.9375rem] font-semibold tracking-tight text-white">
              GuardPay
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-5" aria-label="Dashboard">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              href={path}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon size={18} className="shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-semibold text-brand">
            {user?.address ? user.address.slice(2, 4).toUpperCase() : '—'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">Merchant</p>
              <p className="truncate font-mono text-xs text-slate-400">{shortAddress}</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="mt-4 w-full justify-start text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} className="mr-2" aria-hidden />
            Sign out
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-ink transition-[width] duration-300 md:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebar}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink"
          >
            <Menu size={20} />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark className="h-6 w-6 text-brand" />
            <span className="text-sm font-semibold tracking-tight text-ink">GuardPay</span>
          </Link>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
