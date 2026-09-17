'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Payments', href: '#payments' },
  { label: 'Escrow', href: '/escrow' },
  { label: 'For merchants', href: '#merchants' },
  { label: 'Docs', href: '#docs' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || menuOpen
          ? 'border-b border-border/70 bg-background/85 py-3 backdrop-blur-md'
          : 'border-b border-transparent py-5'
      )}
    >
      <nav
        className="container mx-auto flex items-center justify-between px-5 sm:px-6"
        aria-label="Main"
      >
        <Link href="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Logo />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          <ul className="flex items-center gap-7">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/account">
            <Button size="sm" className="font-medium">
              My account
            </Button>
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile panel */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="border-t border-border/70 bg-background md:hidden"
      >
        <ul className="container mx-auto flex flex-col gap-1 px-5 py-4">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-3 text-base font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="pt-2">
            <Link href="/account" onClick={() => setMenuOpen(false)}>
              <Button className="h-12 w-full text-base">My account</Button>
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
};

export default Navbar;
