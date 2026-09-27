import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GuardPay',
    short_name: 'GuardPay',
    description: 'Crypto payments with escrow protection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070B14',
    theme_color: '#070B14',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
