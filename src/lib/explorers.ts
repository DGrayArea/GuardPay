/** Block explorers for the testnets GuardPay settles on, keyed by chain. */
const EXPLORERS: Record<string, { tx: (hash: string) => string; address: (a: string) => string }> = {
  ETH: {
    tx: (h) => `https://sepolia.etherscan.io/tx/${h}`,
    address: (a) => `https://sepolia.etherscan.io/address/${a}`,
  },
  BASE: {
    tx: (h) => `https://sepolia.basescan.org/tx/${h}`,
    address: (a) => `https://sepolia.basescan.org/address/${a}`,
  },
  BSC: {
    tx: (h) => `https://testnet.bscscan.com/tx/${h}`,
    address: (a) => `https://testnet.bscscan.com/address/${a}`,
  },
  SOLANA: {
    tx: (h) => `https://explorer.solana.com/tx/${h}?cluster=devnet`,
    address: (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`,
  },
};

export const explorerTx = (chain: string, hash: string): string | null =>
  EXPLORERS[chain?.toUpperCase()]?.tx(hash) ?? null;

export const explorerAddress = (chain: string, address: string): string | null =>
  EXPLORERS[chain?.toUpperCase()]?.address(address) ?? null;

export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-8)}`;
