'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Payments', href: '/#products' },
  { label: 'Escrow', href: '/escrow' },
  { label: 'x402', href: '/#x402' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Developers', href: '/#developers' },
];

/** Landing-page header. Dark, to sit on the hero. */
const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A fixed nav with an open panel must not let the page scroll behind it.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled || menuOpen
          ? 'border-b border-white/10 bg-[#070B14]/85 backdrop-blur-md'
          : 'border-b border-transparent'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34E5A1]">
          <Logo markClassName="text-[#34E5A1]" wordClassName="text-white [&>span]:text-[#34E5A1]" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <ul className="flex items-center gap-7">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-300 transition-colors hover:text-white">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-[#34E5A1] px-4 py-2 text-sm font-semibold text-[#04120C] transition-colors hover:bg-[#5EF0B8]"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-white md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div id="mobile-menu" hidden={!menuOpen} className="border-t border-white/10 bg-[#070B14] md:hidden">
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-3 text-base text-slate-300 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="grid grid-cols-2 gap-3 pt-3">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-full border border-white/15 py-3 text-center text-sm font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="rounded-full bg-[#34E5A1] py-3 text-center text-sm font-semibold text-[#04120C]"
            >
              Open dashboard
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Navbar;
