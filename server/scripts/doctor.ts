/**
 * Readiness check: `pnpm doctor`
 *
 * Tells you what still blocks a real payment. Every line is either something
 * the server needs to function, or something that silently degrades (fees
 * waived, settlement failing) rather than erroring loudly.
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const ok = (s: string) => `\x1b[32m✓\x1b[0m ${s}`;
const warn = (s: string) => `\x1b[33m!\x1b[0m ${s}`;
const bad = (s: string) => `\x1b[31m✗\x1b[0m ${s}`;

(async () => {
  const blockers: string[] = [];

  console.log('\nGuardPay readiness\n' + '─'.repeat(52));

  // --- secrets -------------------------------------------------------------
  const seed = process.env.MASTER_SEED;
  console.log(seed ? ok('MASTER_SEED set') : bad('MASTER_SEED missing — server will not start'));
  if (!seed) blockers.push('Set MASTER_SEED');

  console.log(
    process.env.KEY_ENCRYPTION_KEY
      ? ok('KEY_ENCRYPTION_KEY set (independent of the wallet seed)')
      : warn('KEY_ENCRYPTION_KEY unset — stored keys are encrypted under MASTER_SEED')
  );

  const jwt = process.env.JWT_SECRET;
  console.log(
    jwt && !jwt.includes('change-this')
      ? ok('JWT_SECRET set')
      : bad('JWT_SECRET is the placeholder — sessions are forgeable')
  );
  if (!jwt || jwt.includes('change-this')) blockers.push('Set a real JWT_SECRET');

  // --- relayer gas ---------------------------------------------------------
  const key = process.env.OPERATOR_PRIVATE_KEY;
  if (!key) {
    console.log(warn('OPERATOR_PRIVATE_KEY unset — falls back to a seed-derived key'));
  }

  try {
    const wallet = key
      ? new ethers.Wallet(key)
      : ethers.HDNodeWallet.fromSeed(
          require('bip39').mnemonicToSeedSync(seed!)
        ).derivePath("44'/60'/7'/0/0");

    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://sepolia.base.org');
    const balance = await provider.getBalance(wallet.address);
    const eth = Number(ethers.formatEther(balance));

    if (eth === 0) {
      console.log(bad(`operator ${wallet.address} has 0 ETH`));
      console.log('    blocks: escrow release/refund, x402 settlement');
      blockers.push(`Fund ${wallet.address} with Base Sepolia ETH`);
    } else if (eth < 0.005) {
      console.log(warn(`operator has ${eth} ETH — low, a few transactions' worth`));
    } else {
      console.log(ok(`operator funded (${eth} ETH)`));
    }
  } catch (e: any) {
    console.log(bad('could not read operator balance: ' + e.message));
  }

  // --- fee collection ------------------------------------------------------
  const feeEvm = process.env.PLATFORM_FEE_ADDRESS;
  const feeSol = process.env.PLATFORM_FEE_SOLANA_ADDRESS;
  console.log(feeEvm ? ok('PLATFORM_FEE_ADDRESS set') : warn('PLATFORM_FEE_ADDRESS unset — EVM fees are waived'));
  console.log(feeSol ? ok('PLATFORM_FEE_SOLANA_ADDRESS set') : warn('PLATFORM_FEE_SOLANA_ADDRESS unset — Solana fees are waived'));

  // --- chains reachable ----------------------------------------------------
  for (const [label, url] of [
    ['Base Sepolia', process.env.BASE_RPC_URL || 'https://sepolia.base.org'],
    ['Ethereum Sepolia', process.env.ETH_RPC_URL],
    ['BSC Testnet', process.env.BSC_RPC_URL],
  ] as [string, string | undefined][]) {
    if (!url) { console.log(warn(`${label}: no RPC configured — payments there go undetected`)); continue; }
    try {
      const n = await new ethers.JsonRpcProvider(url).getBlockNumber();
      console.log(ok(`${label} reachable (block ${n})`));
    } catch {
      console.log(bad(`${label} unreachable at ${url}`));
    }
  }

  try {
    const conn = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    console.log(ok(`Solana devnet reachable (slot ${await conn.getSlot()})`));

    if (feeSol) {
      const lamports = await conn.getBalance(new PublicKey(feeSol));
      if (lamports === 0) {
        console.log(warn(`Solana treasury holds 0 SOL — needs rent to receive token fees`));
      }
    }
  } catch {
    console.log(bad('Solana RPC unreachable'));
  }

  // --- summary -------------------------------------------------------------
  console.log('─'.repeat(52));
  if (blockers.length === 0) {
    console.log('\nNothing blocking. Run a real payment end to end next.\n');
  } else {
    console.log('\nBlocking a real payment:\n');
    blockers.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    console.log('\nFaucets:');
    console.log('  Base Sepolia ETH  https://portal.cdp.coinbase.com/products/faucet');
    console.log('  Base Sepolia USDC https://faucet.circle.com');
    console.log('  Solana devnet SOL https://faucet.solana.com\n');
  }
})();
