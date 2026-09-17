import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The Solana wallet adapters ship untranspiled ESM + a CSS file.
  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
  ],

  webpack: (config) => {
    // WalletConnect and some wallet SDKs reference optional Node built-ins that
    // have no browser equivalent; stub them rather than failing the build.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Optional native deps of WalletConnect's transport.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
