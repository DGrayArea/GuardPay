'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { LogoMark } from '@/components/brand/Logo';

interface BrandedQRProps {
  value: string;
  /** Accessible description, e.g. "Payment address QR code". */
  label?: string;
  className?: string;
}

/**
 * QR code with the GuardPay helm centred in it.
 *
 * Safe because the code is generated at error-correction level H, which can
 * reconstruct ~30% of a damaged symbol. The badge below covers ~16% of the
 * area, well inside that budget — do not enlarge it without dropping the
 * coverage back under about 25%, or some scanners will fail to read it.
 */
const BrandedQR: React.FC<BrandedQRProps> = ({ value, label = 'Payment QR code', className }) => (
  <div className={className}>
    <div className="relative aspect-square w-full" role="img" aria-label={label}>
      <QRCode
        value={value}
        level="H"
        className="h-full w-full"
        style={{ width: '100%', height: '100%' }}
        aria-hidden
      />

      {/* Centre badge. Pointer-events off so it never blocks a long-press save. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-[24%] w-[24%] items-center justify-center rounded-[22%] bg-white shadow-[0_0_0_3px_white]">
          <LogoMark className="h-[78%] w-[78%] text-ink" title="" />
        </div>
      </div>
    </div>
  </div>
);

export default BrandedQR;
