'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Chip from '@/components/ui/Chip';

/**
 * Figures here describe what the product does, not how many people use it.
 * Invented traction numbers on a pre-launch site are a liability, not a hook.
 */
const capabilities = [
  { value: '4', label: 'Chains supported' },
  { value: '~30s', label: 'To confirmation' },
  { value: '1%', label: 'Merchant fee' },
  { value: 'On-chain', label: 'Escrow custody' },
];

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Respect users who have asked for less motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.remove('opacity-0', 'translate-y-10');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.remove('opacity-0', 'translate-y-10');
          observer.unobserve(node);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 md:pt-40 md:pb-24">
      {/* Soft brand wash behind the fold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--gp-brand)/0.10),transparent_70%)]"
      />

      <div
        ref={containerRef}
        className="container mx-auto px-5 opacity-0 translate-y-10 transition-all duration-1000 ease-out sm:px-6"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Chip variant="primary" size="md" className="mb-6">
            Payments &amp; escrow on one rail
          </Chip>

          <h1 className="text-balance text-[2rem] font-bold leading-[1.1] tracking-tightest text-ink sm:text-5xl md:text-6xl">
            The simplest way to accept{' '}
            <span className="text-brand">crypto payments</span> with escrow protection
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base text-ink-soft sm:text-lg md:text-xl">
            Share a link, get paid on-chain, and settle straight to your own wallet. For deals that
            need trust, funds sit in escrow until both sides are satisfied.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="h-12 w-full px-6 text-base font-medium sm:w-auto">
                Start accepting payments
                <ArrowRight size={18} className="ml-2" aria-hidden />
              </Button>
            </Link>
            <Link href="/escrow" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full px-6 text-base font-medium sm:w-auto"
              >
                Explore escrow
                <ShieldCheck size={18} className="ml-2" aria-hidden />
              </Button>
            </Link>
          </div>

          <dl className="mt-14 grid w-full grid-cols-2 gap-x-6 gap-y-8 border-t border-border pt-10 md:mt-16 md:grid-cols-4 md:gap-12">
            {capabilities.map((item) => (
              <div key={item.label} className="flex flex-col items-center">
                <dt className="sr-only">{item.label}</dt>
                <dd className="mb-1 text-xl font-bold tracking-tight text-brand sm:text-2xl md:text-3xl">
                  {item.value}
                </dd>
                <p className="text-xs text-ink-soft sm:text-sm">{item.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default Hero;
