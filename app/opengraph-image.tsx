import { ImageResponse } from 'next/og';
import { MARK_G, MARK_G_STROKE, MARK_SHIELD } from '@/components/brand/Logo';

export const alt = 'GuardPay: crypto payments, escrow and x402 settlement';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#070B14';
const MINT = '#34E5A1';

/** Social card, rendered from the brand palette. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `radial-gradient(circle at 85% 20%, #0F3B2C 0%, ${INK} 55%)`,
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <mask id="g">
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
            <rect width="32" height="32" fill={MINT} mask="url(#g)" />
          </svg>
          <div style={{ display: 'flex', color: '#fff', fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Guard<span style={{ color: MINT }}>Pay</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 980,
            }}
          >
            Get paid in crypto. Hold it in escrow when trust is thin.
          </div>
          <div style={{ color: '#94A3B8', fontSize: 30, maxWidth: 900, lineHeight: 1.4 }}>
            Payment links, on-chain escrow and x402 settlement for APIs and agents.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {['Ethereum', 'Base', 'BNB Chain', 'Solana'].map((chain) => (
            <div
              key={chain}
              style={{
                color: MINT,
                border: '2px solid #1C4D3B',
                borderRadius: 999,
                padding: '10px 26px',
                fontSize: 24,
              }}
            >
              {chain}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
