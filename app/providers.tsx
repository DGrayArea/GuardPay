'use client';

import React, { useMemo } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, base, baseSepolia } from 'wagmi/chains';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, base, baseSepolia],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [bsc.id]: http(),
      [bscTestnet.id]: http(),
      [polygon.id]: http(),
      [polygonAmoy.id]: http(),
      [base.id]: http(),
      [baseSepolia.id]: http(),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    appName: 'GuardPay',
    appDescription: 'Crypto Payment Gateway',
    appUrl: 'https://guardpay.demo',
    appIcon: '/favicon.ico',
  })
);

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet'),
    []
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="soft"
          customTheme={{
            '--ck-font-family': '"Inter", sans-serif',
            '--ck-border-radius': '12px',
          }}
        >
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                <AuthProvider>
                  <TooltipProvider>
                    {children}
                    <Toaster />
                    <Sonner />
                  </TooltipProvider>
                </AuthProvider>
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
