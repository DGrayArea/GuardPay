
import React, { useMemo } from 'react';
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy, base, baseSepolia } from "wagmi/chains";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles for Solana
import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

// Wagmi Config
const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
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
    // Required API Keys
    walletConnectProjectId: "38920150d0325492211624b518cf0336", // Public generic ID for demo
    appName: "GuardPay",
    appDescription: "Crypto Payment Gateway",
    appUrl: "https://guardpay.demo",
    appIcon: "https://family.co/logo.png", // specific icon
  }),
);

interface Web3ProviderProps {
    children: React.ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
    // Solana Config
    const network = 'devnet'; // Hardcoded to devnet for this demo phase
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter()
    ], []);

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitProvider 
                    theme="soft"
                    customTheme={{
                        "--ck-font-family": '"Inter", sans-serif',
                        "--ck-border-radius": "12px",
                    }}
                >
                    <ConnectionProvider endpoint={endpoint}>
                        <WalletProvider wallets={wallets} autoConnect>
                            <WalletModalProvider>
                                {children}
                            </WalletModalProvider>
                        </WalletProvider>
                    </ConnectionProvider>
                </ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};
