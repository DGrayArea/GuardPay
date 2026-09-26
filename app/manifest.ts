import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GuardPay',
    short_name: 'GuardPay',
    description: 'Crypto payments with escrow protection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A1024',
    theme_color: '#0A1024',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
