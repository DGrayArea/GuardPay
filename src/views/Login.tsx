'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useModal } from 'connectkit';
import { useAccount, useSignMessage } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Logo } from '@/components/brand/Logo';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';

type Family = 'evm' | 'solana';

const message = (nonce: string) =>
  `Sign this message to authenticate with GuardPay.\n\nNonce: ${nonce}`;

/** Turn a failed sign-in into something a person can act on. */
function describeError(error: any): string {
  const text = String(error?.message ?? '');
  if (/reject|denied|cancel/i.test(text)) return 'You cancelled the signature.';
  // No response at all means the API itself is unreachable (down, or CORS).
  if (error?.isAxiosError && !error.response) {
    return "GuardPay's API is offline right now, so sign-in isn't available.";
  }
  return error?.response?.data?.error ?? 'Sign-in failed. Please try again.';
}

/**
 * Wallet sign-in. The person picks ONE wallet family; only that one is asked to
 * sign. Signing never starts just because a wallet happens to be connected (a
 * wallet like Phantom exposes both EVM and Solana, and a remembered session
 * reconnects on load), which is what used to fire two prompts at once.
 */
const Login: React.FC = () => {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { setOpen: openEvmModal } = useModal();

  const { publicKey, connected: solConnected, signMessage: signSolana } = useWallet();
  const { setVisible: openSolModal } = useWalletModal();

  const [pending, setPending] = useState<Family | null>(null);
  const [busy, setBusy] = useState(false);
  const signing = useRef(false);

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  const signIn = useCallback(
    async (family: Family) => {
      if (signing.current) return;
      signing.current = true;
      setBusy(true);
      try {
        if (family === 'evm') {
          if (!evmAddress) return;
          const nonce = await api.getNonce(evmAddress);
          const signature = await signMessageAsync({ account: evmAddress, message: message(nonce) });
          const { merchant } = await api.verifySignature(evmAddress, signature);
          login(evmAddress, 'evm', merchant.id);
        } else {
          if (!publicKey || !signSolana) return;
          const address = publicKey.toString();
          const nonce = await api.getNonce(address);
          const signature = await signSolana(new TextEncoder().encode(message(nonce)));
          const { merchant } = await api.verifySignature(address, Buffer.from(signature).toString('base64'));
          login(address, 'solana', merchant.id);
        }
        toast.success('Signed in');
        router.push('/dashboard');
      } catch (error) {
        console.error('Sign-in failed:', error);
        toast.error(describeError(error));
      } finally {
        signing.current = false;
        setBusy(false);
        setPending(null);
      }
    },
    [evmAddress, publicKey, signSolana, signMessageAsync, login, router]
  );

  // Finish a sign-in the person started, once the chosen wallet connects.
  useEffect(() => {
    if (pending === 'evm' && evmConnected && evmAddress) signIn('evm');
  }, [pending, evmConnected, evmAddress, signIn]);

  useEffect(() => {
    if (pending === 'solana' && solConnected && publicKey) signIn('solana');
  }, [pending, solConnected, publicKey, signIn]);

  const start = (family: Family) => {
    setPending(family);
    if (family === 'evm' && !evmConnected) openEvmModal(true);
    if (family === 'solana' && !solConnected) openSolModal(true);
  };

  const options: { family: Family; title: string; hint: string }[] = [
    { family: 'evm', title: 'Ethereum wallet', hint: 'MetaMask, Rainbow, Coinbase Wallet' },
    { family: 'solana', title: 'Solana wallet', hint: 'Phantom, Solflare' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070B14] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(52,229,161,0.14),transparent_70%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mx-auto mb-10 flex w-fit">
          <Logo markClassName="h-8 w-8 text-[#34E5A1]" wordClassName="text-xl text-white [&>span]:text-[#34E5A1]" />
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#0C1220] p-6 shadow-2xl shadow-black/40 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Sign in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Pick one wallet. You'll sign a message to prove it's yours; nothing is sent on-chain.
          </p>

          <div className="mt-6 space-y-3">
            {options.map((o) => (
              <button
                key={o.family}
                type="button"
                disabled={busy}
                onClick={() => start(o.family)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-colors hover:border-[#34E5A1]/50 hover:bg-white/[0.06] disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-medium text-white">{o.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{o.hint}</span>
                </span>
                {busy && pending === o.family ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#34E5A1]" />
                ) : (
                  <span className="text-slate-500">→</span>
                )}
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-500">
            GuardPay runs on testnets. New to wallets?{' '}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#34E5A1] hover:underline"
            >
              Get MetaMask
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
