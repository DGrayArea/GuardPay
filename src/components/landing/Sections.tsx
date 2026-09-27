import Link from 'next/link';
import { ArrowRight, Bot, Link2, Lock, ShieldCheck, Webhook, Zap } from 'lucide-react';

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#34E5A1]">{children}</p>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
    {children}
  </h2>
);

export const Chains = () => (
  <section className="border-y border-white/10 bg-[#0A0F1B]">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
      <p className="text-sm text-slate-500">Accept native coins and stablecoins on</p>
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-base font-medium text-slate-300">
        {['Ethereum', 'Base', 'BNB Chain', 'Solana'].map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  </section>
);

const products = [
  {
    id: 'links',
    icon: Link2,
    name: 'Payment links',
    body: 'Price in dollars, get paid in ETH, BNB, SOL or USDC. Every checkout gets its own address, so payments match themselves to orders.',
    points: ['Unique address per checkout', 'Confirmation in about 30 seconds', 'Swept to your wallet automatically'],
    accent: 'text-[#34E5A1]',
  },
  {
    id: 'escrow',
    icon: Lock,
    name: 'Escrow',
    body: 'For freelance work and deals between strangers. The buyer pays into escrow; the seller is paid when the buyer confirms, or refunded if the deal falls through.',
    points: ['On Base, funds sit in a public contract', 'Release, refund or dispute', 'Both sides see every step'],
    accent: 'text-[#A99BFF]',
  },
  {
    id: 'x402',
    icon: Bot,
    name: 'x402 for APIs and agents',
    body: 'Charge per request. Your API answers 402 with a price, the caller signs a USDC authorization, and GuardPay verifies and settles it on-chain.',
    points: ['Tokens go payer to you directly', 'GuardPay pays the gas', 'Replay-protected settlement'],
    accent: 'text-[#7DD3FC]',
  },
];

export const Products = () => (
  <section id="products" className="scroll-mt-20 bg-[#070B14] py-24">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Eyebrow>One gateway, three ways to get paid</Eyebrow>
      <SectionTitle>From a one-off invoice to millions of API calls.</SectionTitle>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {products.map((p) => (
          <article
            key={p.id}
            id={p.id === 'x402' ? 'x402' : undefined}
            className="scroll-mt-24 flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20"
          >
            <p.icon className={`h-6 w-6 ${p.accent}`} />
            <h3 className="mt-5 text-lg font-semibold text-white">{p.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
            <ul className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm text-slate-300">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2">
                  <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${p.accent}`} />
                  {pt}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const steps = [
  { n: '01', title: 'Connect your wallet', body: 'Sign in with MetaMask or Phantom. No forms, no KYC for testnet.' },
  { n: '02', title: 'Create a link or deal', body: 'Set a price in dollars and pick a chain, or open an escrow with the other party.' },
  { n: '03', title: 'Get paid', body: 'GuardPay watches the chain, confirms the payment and forwards it to you.' },
];

export const HowItWorks = () => (
  <section className="bg-[#0A0F1B] py-24">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Eyebrow>How it works</Eyebrow>
      <SectionTitle>Live in the time it takes to sign a message.</SectionTitle>
      <ol className="mt-12 grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="border-t border-white/15 pt-6">
            <span className="font-mono text-sm text-[#34E5A1]">{s.n}</span>
            <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

const prices = [
  { name: 'Payment links', fee: '1%', note: 'Taken from the payment. The buyer pays the listed price.' },
  { name: 'Person to person', fee: '0.5%', note: 'Added on top, so the recipient gets the full amount.' },
  { name: 'Escrow', fee: '1.5%', note: 'Charged once, on release. Minimum $1.' },
  { name: 'x402 settlement', fee: '1%', note: 'Per settled request, billed to the merchant. We cover the gas.' },
];

export const Pricing = () => (
  <section id="pricing" className="scroll-mt-20 bg-[#070B14] py-24">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Eyebrow>Pricing</Eyebrow>
      <SectionTitle>No monthly fee. You pay when you get paid.</SectionTitle>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {prices.map((p) => (
          <div key={p.name} className="bg-[#0A0F1B] p-6">
            <h3 className="text-sm text-slate-400">{p.name}</h3>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">{p.fee}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.note}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const WEBHOOK = `POST https://your-shop.com/hooks/guardpay
X-GuardPay-Event: payment.completed
X-GuardPay-Signature: t=1790000000,v1=5f2c…

{
  "id": "evt_4b1d9e…",
  "event": "payment.completed",
  "data": {
    "invoice_id": "8f3a…",
    "amount": "250",
    "expected": "250",
    "crypto": "USDC",
    "chain": "BASE",
    "tx_hash": "0x9c1e…",
    "confirmations": 3
  },
  "timestamp": "2026-09-26T14:02:11.000Z"
}`;

export const Developers = () => (
  <section id="developers" className="scroll-mt-20 bg-[#0A0F1B] py-24">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
      <div>
        <Eyebrow>Developers</Eyebrow>
        <SectionTitle>Signed webhooks, an x402 facilitator, and nothing to host.</SectionTitle>
        <ul className="mt-8 space-y-5">
          {[
            { icon: Webhook, t: 'Signed webhooks', b: 'Every payment, escrow and x402 event is HMAC-signed, timestamped, and retried for up to a day until you acknowledge it.' },
            { icon: Zap, t: 'Standard x402 endpoints', b: 'Point any x402 resource server at /api/x402. Supported, verify and settle, as the protocol defines them.' },
            { icon: ShieldCheck, t: 'Keys stay sealed', b: 'Stored key material is encrypted at rest, and the public API can run with no signing keys at all.' },
          ].map((f) => (
            <li key={f.t} className="flex gap-4">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#34E5A1]" />
              <div>
                <h3 className="font-medium text-white">{f.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.b}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070B14]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 text-xs text-slate-500">payment.completed</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-slate-300">
          <code>{WEBHOOK}</code>
        </pre>
      </div>
    </div>
  </section>
);

export const faqs = [
  {
    q: 'Does GuardPay hold my money?',
    a: 'Payment-link funds land on a one-time address and are forwarded to your wallet as soon as they confirm. Base escrow is held by the Commerce Payments contract, not by GuardPay. Solana escrow is the exception: funds sit in a vault GuardPay controls until release, and the deal page says so.',
  },
  {
    q: 'Which coins can I accept?',
    a: 'ETH on Ethereum and Base, BNB on BNB Chain, SOL on Solana, and USDC where it is available. Prices are set in USD or EUR and converted at checkout.',
  },
  {
    q: 'Is this live on mainnet?',
    a: 'Not yet. GuardPay runs on Sepolia, Base Sepolia, BSC Testnet and Solana Devnet, so you can try every flow with free test funds.',
  },
  {
    q: 'What is x402?',
    a: 'An open protocol for paying per request over HTTP. A server replies 402 Payment Required with a price, the client signs a stablecoin authorization, and a facilitator like GuardPay settles it on-chain.',
  },
];

export const Faq = () => (
  <section id="faq" className="scroll-mt-20 bg-[#070B14] py-24">
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <Eyebrow>Questions</Eyebrow>
      <SectionTitle>The short answers.</SectionTitle>
      <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
        {faqs.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-white [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-xl leading-none text-slate-500 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export const FinalCta = () => (
  <section className="bg-[#070B14] pb-24">
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#34E5A1]/20 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(52,229,161,0.18),transparent_60%),#0A0F1B] px-6 py-14 text-center sm:px-12">
        <h2 className="text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
          Take your first payment today.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-slate-400">
          It runs on testnets, so it costs nothing to try. Connect a wallet and make a link in under a minute.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#34E5A1] px-6 py-3.5 text-sm font-semibold text-[#04120C] transition-colors hover:bg-[#5EF0B8]"
        >
          Open the dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  </section>
);
