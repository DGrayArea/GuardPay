'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePublicClient } from 'wagmi';
import { baseSepolia, bscTestnet, sepolia } from 'wagmi/chains';
import { formatUnits, parseAbi } from 'viem';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/AuthProvider';
import { api, Settings, Transaction } from '@/lib/api';

const ERC20 = parseAbi(['function balanceOf(address) view returns (uint256)']);

/** Testnet assets GuardPay settles in, and where to read each balance. */
const EVM_ASSETS = [
  { chain: baseSepolia, label: 'Base Sepolia', symbol: 'ETH', token: null },
  { chain: baseSepolia, label: 'Base Sepolia', symbol: 'USDC', token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const },
  { chain: sepolia, label: 'Sepolia', symbol: 'ETH', token: null },
  { chain: sepolia, label: 'Sepolia', symbol: 'USDC', token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const },
  { chain: bscTestnet, label: 'BSC Testnet', symbol: 'BNB', token: null },
];

const FAUCETS = [
  { label: 'Base Sepolia ETH', href: 'https://www.alchemy.com/faucets/base-sepolia' },
  { label: 'Testnet USDC', href: 'https://faucet.circle.com/' },
  { label: 'BSC Testnet BNB', href: 'https://testnet.bnbchain.org/faucet-smart' },
  { label: 'Solana Devnet SOL', href: 'https://faucet.solana.com/' },
];

const isEvm = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

const fmt = (value: string) => {
  const n = Number(value);
  return n === 0 ? '0' : n < 0.0001 ? '<0.0001' : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

/** One EVM balance row, read straight from the chain. */
const EvmBalance: React.FC<{ address: `0x${string}`; asset: (typeof EVM_ASSETS)[number] }> = ({ address, asset }) => {
  const client = usePublicClient({ chainId: asset.chain.id });
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    const read = asset.token
      ? client
          .readContract({ address: asset.token, abi: ERC20, functionName: 'balanceOf', args: [address] } as never)
          .then((v) => formatUnits(v as unknown as bigint, 6))
      : client.getBalance({ address }).then((v) => formatUnits(v, 18));
    read.then(setValue).catch(() => setValue('—'));
  }, [client, address, asset]);

  return <BalanceRow label={asset.label} symbol={asset.symbol} value={value} />;
};

const SolBalance: React.FC<{ address: string }> = ({ address }) => {
  const { connection } = useConnection();
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    try {
      connection
        .getBalance(new PublicKey(address))
        .then((lamports) => setValue(String(lamports / 1e9)))
        .catch(() => setValue('—'));
    } catch {
      setValue('—');
    }
  }, [connection, address]);

  return <BalanceRow label="Solana Devnet" symbol="SOL" value={value} />;
};

const BalanceRow: React.FC<{ label: string; symbol: string; value: string | null }> = ({ label, symbol, value }) => (
  <li className="flex items-center justify-between gap-4 py-3">
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
        {symbol.slice(0, 1)}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{symbol}</p>
        <p className="text-xs text-ink-soft">{label}</p>
      </div>
    </div>
    <p className="text-right font-mono text-sm text-ink">
      {value === null ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-ink-soft" /> : value === '—' ? '—' : fmt(value)}
    </p>
  </li>
);

const AddressCard: React.FC<{ title: string; address: string; explorer: string }> = ({ title, address, explorer }) => (
  <div className="rounded-lg bg-muted/60 p-4">
    <p className="text-sm text-ink-soft">{title}</p>
    <div className="mt-1 flex items-start justify-between gap-2">
      <p className="min-w-0 break-all font-mono text-sm text-ink">{address}</p>
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Copy address"
          onClick={() => {
            navigator.clipboard.writeText(address);
            toast.success('Address copied');
          }}
        >
          <Copy size={16} />
        </Button>
        <a href={explorer} target="_blank" rel="noopener noreferrer" aria-label="View on explorer">
          <Button variant="ghost" size="sm">
            <ExternalLink size={16} />
          </Button>
        </a>
      </div>
    </div>
  </div>
);

/**
 * GuardPay never holds a merchant's money: payments are forwarded to the
 * payout addresses below. This page shows those addresses and their live
 * testnet balances, read directly from each chain.
 */
const DashboardWallet: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [payouts, setPayouts] = useState<Transaction[]>([]);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => undefined);
    api
      .getTransactions()
      .then((tx) => setPayouts(tx.filter((t) => t.status === 'completed').slice(0, 6)))
      .catch(() => undefined);
  }, []);

  const login = user?.address ?? '';
  const evmAddress = settings?.receivingAddress || (isEvm(login) ? login : '');
  const solAddress = settings?.solanaAddress || (!isEvm(login) ? login : '');

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Wallet</h1>
        <Link href="/dashboard/settings">
          <Button variant="outline" size="sm">
            Change payout addresses
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Payout addresses</CardTitle>
              <CardDescription>Payments are forwarded here as soon as they confirm. GuardPay never holds them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {evmAddress && (
                <AddressCard
                  title="EVM (Base, Ethereum, BNB Chain)"
                  address={evmAddress}
                  explorer={`https://sepolia.basescan.org/address/${evmAddress}`}
                />
              )}
              {solAddress && (
                <AddressCard
                  title="Solana"
                  address={solAddress}
                  explorer={`https://explorer.solana.com/address/${solAddress}?cluster=devnet`}
                />
              )}
              {!evmAddress && !solAddress && (
                <p className="text-sm text-ink-soft">
                  No payout address yet. <Link href="/dashboard/settings" className="text-brand hover:underline">Add one in settings</Link>.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
              <CardDescription>Live testnet balances of your payout addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {evmAddress &&
                  EVM_ASSETS.map((asset) => (
                    <EvmBalance
                      key={`${asset.chain.id}-${asset.symbol}`}
                      address={evmAddress as `0x${string}`}
                      asset={asset}
                    />
                  ))}
                {solAddress && <SolBalance address={solAddress} />}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent payouts</CardTitle>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-sm text-ink-soft">No completed payments yet.</p>
              ) : (
                <ul className="divide-y">
                  {payouts.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{t.linkTitle || 'Direct payment'}</p>
                        <p className="text-xs text-ink-soft">{new Date(t.timestamp).toLocaleDateString()}</p>
                      </div>
                      <p className="shrink-0 font-medium text-ink">
                        +{t.cryptoAmount} {t.crypto}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard/payments" className="mt-3 block text-sm text-brand hover:underline">
                All payments
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Testnet faucets</CardTitle>
              <CardDescription>Free test funds for trying a checkout</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {FAUCETS.map((f) => (
                  <li key={f.href}>
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-ink transition-colors hover:bg-muted"
                    >
                      {f.label}
                      <ExternalLink size={14} className="text-ink-soft" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardWallet;
