import React from 'react';
import { cn } from '@/lib/utils';

/**
 * GuardPay mark — a hollow armoured knight, arms crossed on the chest over a
 * downward sword.
 *
 * Built as a filled silhouette with the sword, visor and crossed forearms cut
 * out as negative space. An earlier stroke-drawn version read as an archway
 * with a down-arrow: at small sizes line art loses the figure, whereas a solid
 * mass with cut-outs keeps the silhouette legible down to a favicon.
 *
 * The sword points DOWN and the arms are crossed — a sentry standing guard over
 * something, not a combatant. The blade holds the vertical axis so the mark
 * stays symmetrical, and the visor slit is the only opening, which is what
 * makes the armour read as empty.
 */
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
      aria-label={title}
      className={cn('h-8 w-8', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={`gp-knight-${id}`}>
        <rect width="32" height="32" fill="black" />

        {/* Great helm. */}
        <path d="M10.2 13.8V8.2a5.8 5.8 0 0 1 11.6 0v5.6z" fill="white" />
        {/* Pauldrons and cuirass, cropped at the frame as a bust. */}
        <path
          d="M11 14.6h10l5.6 2.5A5 5 0 0 1 29.6 21.7V31H2.4v-9.3a5 5 0 0 1 3-4.6z"
          fill="white"
        />

        {/* Visor slit — the only opening. */}
        <rect x="11.7" y="8.3" width="8.6" height="2.2" rx="1.1" fill="black" />
        {/* Sword: crossguard, blade, point. */}
        <rect x="8.8" y="16.6" width="14.4" height="2" rx="1" fill="black" />
        <rect x="14.8" y="18.6" width="2.4" height="9" fill="black" />
        <path d="M14.8 27.6 16 30.8l1.2-3.2z" fill="black" />
        {/* Both forearms crossing the chest to the grip. */}
        <path
          d="M4.6 25.4 13.9 21.1M27.4 25.4 18.1 21.1"
          stroke="black"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </mask>

      <rect width="32" height="32" fill="currentColor" mask={`url(#gp-knight-${id})`} />
    </svg>
  );
};

/** Mark plus wordmark, for headers and footers. */
export const Logo: React.FC<{
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}> = ({ className, markClassName, wordClassName }) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <LogoMark className={cn('h-8 w-8 text-brand', markClassName)} />
    <span
      className={cn('text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink', wordClassName)}
    >
      GuardPay
    </span>
  </span>
);

export default Logo;
