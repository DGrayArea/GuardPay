import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Payment links', href: '/#products' },
      { label: 'Escrow', href: '/escrow' },
      { label: 'x402 facilitator', href: '/#x402' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'My payments', href: '/account' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Webhooks', href: '/#developers' },
      { label: 'x402 endpoints', href: '/#x402' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-white/10 bg-[#070B14]">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div className="max-w-xs">
        <Logo markClassName="text-[#34E5A1]" wordClassName="text-white [&>span]:text-[#34E5A1]" />
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Crypto payments, on-chain escrow and x402 settlement. Funds go to your own wallet.
        </p>
      </div>
      {columns.map((col) => (
        <div key={col.title}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{col.title}</h3>
          <ul className="mt-4 space-y-3">
            {col.links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} GuardPay</p>
        <p>Running on testnets: Sepolia, Base Sepolia, BSC Testnet, Solana Devnet.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
