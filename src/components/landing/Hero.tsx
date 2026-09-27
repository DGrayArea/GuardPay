import Link from 'next/link';
import { ArrowRight, Check, Lock } from 'lucide-react';

/** Illustrative checkout, drawn in markup so it stays sharp and costs no image weight. */
const CheckoutCard = () => (
  <div className="relative mx-auto w-full max-w-sm">
    <div className="absolute -inset-6 rounded-[2rem] bg-[#34E5A1]/10 blur-2xl" aria-hidden />
    <div className="relative rounded-2xl border border-white/10 bg-[#0C1220] p-5 shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Checkout</span>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">Base Sepolia</span>
      </div>
      <p className="mt-4 text-sm text-slate-400">Logo design, 3 concepts</p>
      <p className="mt-1 text-4xl font-semibold tracking-[-0.03em] text-white">
        250.00 <span className="text-xl text-slate-500">USDC</span>
      </p>

      <div className="mt-5 rounded-xl border border-[#8B7CF6]/30 bg-[#8B7CF6]/10 p-3.5">
        <div className="flex items-center gap-2 text-sm font-medium text-[#C4BBFF]">
          <Lock className="h-4 w-4" /> Held in escrow
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Released to the seller when you confirm delivery. Refundable until then.
        </p>
      </div>

      <ol className="mt-5 space-y-3">
        {[
          { label: 'Payment detected', done: true },
          { label: '3 confirmations', done: true },
          { label: 'Awaiting delivery', done: false },
        ].map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={
                step.done
                  ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#34E5A1] text-[#04120C]'
                  : 'h-5 w-5 rounded-full border-2 border-dashed border-slate-600'
              }
            >
              {step.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className={step.done ? 'text-slate-200' : 'text-slate-500'}>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <span className="rounded-lg bg-[#34E5A1] py-2.5 text-center text-sm font-semibold text-[#04120C]">
          Release funds
        </span>
        <span className="rounded-lg border border-white/10 py-2.5 text-center text-sm text-slate-300">
          Open dispute
        </span>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <section className="relative overflow-hidden bg-[#070B14] pb-20 pt-28 sm:pt-36">
    <div
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_10%,rgba(52,229,161,0.14),transparent_70%),radial-gradient(40%_40%_at_10%_90%,rgba(139,124,246,0.10),transparent_70%)]"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      aria-hidden
    />

    <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34E5A1]" />
          Live on testnets. No mainnet funds at risk.
        </span>
        <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl">
          Get paid in crypto.
          <br />
          <span className="text-[#34E5A1]">Hold it in escrow</span> when trust is thin.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
          Share a payment link and every payment is forwarded to your own wallet. For deals between strangers,
          funds wait in on-chain escrow until the work is delivered. For APIs and agents, GuardPay settles
          x402 payments per request.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#34E5A1] px-6 py-3.5 text-sm font-semibold text-[#04120C] transition-colors hover:bg-[#5EF0B8]"
          >
            Start accepting payments <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/escrow"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            Start an escrow deal
          </Link>
        </div>
        <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {[
            { k: '4', v: 'chains' },
            { k: '~30s', v: 'to confirmation' },
            { k: '1%', v: 'merchant fee' },
          ].map((s) => (
            <div key={s.v}>
              <dt className="text-xl font-semibold tracking-[-0.02em] text-white">{s.k}</dt>
              <dd className="mt-1 text-xs text-slate-500">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <CheckoutCard />
    </div>
  </section>
);

export default Hero;
