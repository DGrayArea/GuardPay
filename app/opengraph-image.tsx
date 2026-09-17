import { ImageResponse } from 'next/og';

export const alt = 'GuardPay — Crypto payments with escrow protection';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social card, rendered at request time from the brand palette. */
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
          background: '#0A1024',
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <mask id="k">
              <rect width="32" height="32" fill="black" />
              <path d="M10.2 13.8V8.2a5.8 5.8 0 0 1 11.6 0v5.6z" fill="white" />
              <path d="M11 14.6h10l5.6 2.5A5 5 0 0 1 29.6 21.7V31H2.4v-9.3a5 5 0 0 1 3-4.6z" fill="white" />
              <rect x="11.7" y="8.3" width="8.6" height="2.2" rx="1.1" fill="black" />
              <rect x="8.8" y="16.6" width="14.4" height="2" rx="1" fill="black" />
              <rect x="14.8" y="18.6" width="2.4" height="9" fill="black" />
              <path d="M14.8 27.6 16 30.8l1.2-3.2z" fill="black" />
              <path d="M4.6 25.4 13.9 21.1M27.4 25.4 18.1 21.1" stroke="black" strokeWidth="1.6" strokeLinecap="round" />
            </mask>
            <rect width="32" height="32" fill="#12A594" mask="url(#k)" />
          </svg>
          <div style={{ color: '#fff', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em' }}>
            GuardPay
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              maxWidth: 900,
            }}
          >
            Crypto payments with escrow protection
          </div>
          <div style={{ color: '#8FA3B8', fontSize: 30, maxWidth: 820, lineHeight: 1.4 }}>
            Shareable payment links, automatic on-chain confirmation, and escrow that protects both sides.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['Ethereum', 'Base', 'BSC', 'Solana'].map((chain) => (
            <div
              key={chain}
              style={{
                color: '#12A594',
                border: '2px solid #14483F',
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
