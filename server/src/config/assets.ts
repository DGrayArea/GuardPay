/**
 * Supported payment assets.
 *
 * One registry so the quote, the on-chain scanner, the sweep and the checkout
 * UI all agree on an asset's contract address and decimals. Getting decimals
 * wrong is not a cosmetic bug: quoting a 6-decimal stablecoin at 8 decimals
 * asks the payer for an amount their wallet cannot express, and every payment
 * lands as an underpayment.
 */

export type AssetKind = 'native' | 'erc20' | 'spl';

export interface Asset {
  /** Ticker as merchants and payers see it. */
  symbol: string;
  name: string;
  kind: AssetKind;
  /** Contract/mint address. Null for a chain's native asset. */
  address: string | null;
  decimals: number;
  /** CoinGecko id for fiat conversion. */
  priceId: string;
  /** True for assets pegged to USD — lets the UI skip volatility warnings. */
  stable?: boolean;
}

export interface ChainAssets {
  key: string;
  name: string;
  /** 'EVM' family or 'SOLANA'. */
  family: 'EVM' | 'SOLANA';
  explorer: string;
  assets: Record<string, Asset>;
}

const usdc = (address: string, decimals = 6): Asset => ({
  symbol: 'USDC',
  name: 'USD Coin',
  kind: 'erc20',
  address,
  decimals,
  priceId: 'usd-coin',
  stable: true,
});

const usdt = (address: string, decimals = 6): Asset => ({
  symbol: 'USDT',
  name: 'Tether USD',
  kind: 'erc20',
  address,
  decimals,
  priceId: 'tether',
  stable: true,
});

/**
 * Testnet addresses. Mainnet deployment must revisit every one of these —
 * a wrong token address silently accepts a worthless token.
 */
export const CHAIN_ASSETS: Record<string, ChainAssets> = {
  ETH: {
    key: 'ETH',
    name: 'Ethereum Sepolia',
    family: 'EVM',
    explorer: 'https://sepolia.etherscan.io',
    assets: {
      ETH: {
        symbol: 'ETH',
        name: 'Ether',
        kind: 'native',
        address: null,
        decimals: 18,
        priceId: 'ethereum',
      },
      // Circle's Sepolia USDC.
      USDC: usdc('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'),
    },
  },

  BASE: {
    key: 'BASE',
    name: 'Base Sepolia',
    family: 'EVM',
    explorer: 'https://sepolia.basescan.org',
    assets: {
      ETH: {
        symbol: 'ETH',
        name: 'Ether',
        kind: 'native',
        address: null,
        decimals: 18,
        priceId: 'ethereum',
      },
      USDC: usdc('0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
    },
  },

  BSC: {
    key: 'BSC',
    name: 'BSC Testnet',
    family: 'EVM',
    explorer: 'https://testnet.bscscan.com',
    assets: {
      BNB: {
        symbol: 'BNB',
        name: 'BNB',
        kind: 'native',
        address: null,
        decimals: 18,
        priceId: 'binancecoin',
      },
      // BSC stablecoins use 18 decimals, unlike most chains.
      USDT: usdt('0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', 18),
    },
  },

  SOLANA: {
    key: 'SOLANA',
    name: 'Solana Devnet',
    family: 'SOLANA',
    explorer: 'https://explorer.solana.com',
    assets: {
      SOL: {
        symbol: 'SOL',
        name: 'Solana',
        kind: 'native',
        address: null,
        decimals: 9,
        priceId: 'solana',
      },
      USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        kind: 'spl',
        address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        decimals: 6,
        priceId: 'usd-coin',
        stable: true,
      },
    },
  },
};

/** Look up an asset on a chain. */
export function getAsset(chain: string, symbol: string): Asset | null {
  return CHAIN_ASSETS[chain?.toUpperCase()]?.assets[symbol?.toUpperCase()] ?? null;
}

export function getChain(chain: string): ChainAssets | null {
  return CHAIN_ASSETS[chain?.toUpperCase()] ?? null;
}

/** Which chains can settle a given ticker. */
export function chainsFor(symbol: string): string[] {
  return Object.values(CHAIN_ASSETS)
    .filter((c) => c.assets[symbol?.toUpperCase()])
    .map((c) => c.key);
}

/** Flat list for the merchant UI. */
export function listAssets() {
  return Object.values(CHAIN_ASSETS).map((chain) => ({
    chain: chain.key,
    name: chain.name,
    family: chain.family,
    assets: Object.values(chain.assets).map((a) => ({
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
      decimals: a.decimals,
      address: a.address,
      stable: Boolean(a.stable),
    })),
  }));
}

/**
 * The chain an asset settles on by default.
 * SOL only exists on Solana; USDC defaults to Base (cheapest of the three).
 */
export function defaultChainFor(symbol: string): string {
  const s = symbol?.toUpperCase();
  if (s === 'SOL') return 'SOLANA';
  if (s === 'BNB') return 'BSC';
  if (s === 'ETH') return 'ETH';
  const available = chainsFor(s);
  if (available.includes('BASE')) return 'BASE';
  return available[0] ?? 'ETH';
}
