import React from 'react';
import { cn } from '@/lib/utils';

/**
 * GuardPay mark: a shield with a G cut through it.
 *
 * Solid mass with the letter as negative space, so it stays legible down to a
 * 16px favicon. The G's crossbar points inward, toward what the shield holds.
 * Paths are shared with the favicon, app icons and social card.
 */
export const MARK_SHIELD =
  'M16 2.5 27.5 6.8v8.4c0 7-4.9 12-11.5 14.3C9.4 27.2 4.5 22.2 4.5 15.2V6.8z';
export const MARK_G = 'M20.6 11.2a5.4 5.4 0 1 0 .9 5.1h-5.2';
export const MARK_G_STROKE = 2.6;

export const LogoMark: React.FC<{ className?: string; title?: string }> = ({
  className,
  title = 'GuardPay',
}) => {
  // Unique per instance so several marks on one page don't share a mask id.
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={cn('h-8 w-8', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={`gp-mark-${id}`}>
        <rect width="32" height="32" fill="black" />
        <path d={MARK_SHIELD} fill="white" />
        <path
          d={MARK_G}
          fill="none"
          stroke="black"
          strokeWidth={MARK_G_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <rect width="32" height="32" fill="currentColor" mask={`url(#gp-mark-${id})`} />
    </svg>
  );
};

/** Mark plus wordmark, for headers and footers. */
export const Logo: React.FC<{
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}> = ({ className, markClassName, wordClassName }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <LogoMark className={cn('h-7 w-7 text-brand', markClassName)} />
    <span
      className={cn('text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink', wordClassName)}
    >
      Guard<span className="text-brand">Pay</span>
    </span>
  </span>
);

export default Logo;
