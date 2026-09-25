import { ethers } from 'ethers';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';
import { queries } from '../config/database';
import { walletService } from './wallet.service';
import { webhookService } from './webhook.service';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

/**
 * Moves funds off the single-use invoice address to the merchant's receiving
 * address. Without this step money accumulates on throwaway addresses and the
 * merchant never actually gets paid.
 */
class SweepService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  /**
   * Record the intent to settle; the worker performs the transfers.
   *
   * Splits the receipt into the merchant's net and the platform's fee. The fee
   * leg is skipped when it would cost more in gas than it collects — a 1% cut
   * of a small invoice is not worth its own transaction — and the fee is then
   * recorded as waived rather than silently kept.
   */
  enqueue(invoice: any, received: string) {
    const merchant = queries.getMerchantById.get(invoice.merchant_id) as any;
    if (!merchant) return;

    const destination =
      invoice.chain === 'SOLANA' ? merchant.solana_address : merchant.receiving_address;

    if (!destination) {
      console.warn(
        `⚠️  Invoice ${invoice.id} paid but merchant ${invoice.merchant_id} has no ` +
          `${invoice.chain === 'SOLANA' ? 'Solana' : 'EVM'} receiving address — funds held on the invoice address`
      );
      return;
    }

    const source = invoice.chain === 'SOLANA' ? invoice.solana_address : invoice.unique_address;
    const treasury =
      invoice.chain === 'SOLANA'
        ? process.env.PLATFORM_FEE_SOLANA_ADDRESS
        : process.env.PLATFORM_FEE_ADDRESS;

    // The fee was quoted in fiat; take the same proportion of what arrived so
    // a price move between quote and payment can't skew the split.
    const receivedNum = Number(received);
    const feeRatio =
      invoice.amount > 0 ? Math.min(Number(invoice.fee_amount || 0) / invoice.amount, 0.5) : 0;
    const feeCrypto = receivedNum * feeRatio;
    const minFee = Number(process.env.MIN_FEE_SWEEP || 0);

    const collectFee = Boolean(treasury) && feeRatio > 0 && feeCrypto > minFee;

    if (!collectFee && feeRatio > 0) {
      console.warn(
        `⚠️  Invoice ${invoice.id}: fee of ${feeCrypto} ${invoice.crypto} waived — ` +
          (treasury ? 'below the economic minimum for its own transaction' : 'no platform fee address configured')
      );
    }

    // Merchant settlement.
    queries.createSweep.run(
      uuidv4(),
      invoice.id,
      invoice.merchant_id,
      invoice.chain,
      source,
      destination,
      collectFee ? String(receivedNum - feeCrypto) : received,
      invoice.token_address,
      'settlement'
    );

    // Platform fee.
    if (collectFee) {
      queries.createSweep.run(
        uuidv4(),
        invoice.id,
        invoice.merchant_id,
        invoice.chain,
        source,
        treasury,
        String(feeCrypto),
        invoice.token_address,
        'fee'
      );
    }
  }

  start(intervalMs = 30000) {
    if (this.timer) return;
    this.timer = setInterval(() => void this.processPending(), intervalMs);
    console.log('✅ Sweep service started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async processPending() {
    if (this.running) return;
    this.running = true;

    try {
      const pending = queries.getPendingSweeps.all() as any[];
      for (const sweep of pending) {
        await this.execute(sweep);
      }
    } catch (error) {
      console.error('Sweep worker error:', error);
    } finally {
      this.running = false;
    }
  }

  private async execute(sweep: any) {
    const attempts = sweep.attempts + 1;

    // The settlement leg drains the address, so it must not run until the fee
    // leg for the same invoice has left.
    if (sweep.kind !== 'fee') {
      const { n } = queries.hasPendingFeeSweep.get(sweep.invoice_id) as { n: number };
      if (n > 0) return;
    }

    try {
      const txHash =
        sweep.chain === 'SOLANA' ? await this.sweepSolana(sweep) : await this.sweepEVM(sweep);

      queries.updateSweep.run('completed', txHash, null, attempts, new Date().toISOString(), sweep.id);
      if (sweep.kind !== 'fee') queries.markWalletKeySwept.run(sweep.from_address);

      console.log(
        `💸 ${sweep.kind === 'fee' ? 'Fee' : 'Settlement'} of ${sweep.amount} → ${sweep.to_address} (${txHash})`
      );

      // A fee transfer is platform accounting, not a merchant payout event.
      if (sweep.kind === 'fee') return;

      await webhookService.trigger(sweep.merchant_id, 'payout.completed', {
        invoice_id: sweep.invoice_id,
        amount: sweep.amount,
        chain: sweep.chain,
        to: sweep.to_address,
        tx_hash: txHash,
      });
    } catch (error: any) {
      const message = error?.message?.slice(0, 500) ?? 'sweep failed';
      const status = attempts >= 5 ? 'failed' : 'pending';

      queries.updateSweep.run(status, null, message, attempts, null, sweep.id);
      console.error(`❌ Sweep ${sweep.id} attempt ${attempts} failed: ${message}`);

      if (status === 'failed') {
        await webhookService.trigger(sweep.merchant_id, 'payout.failed', {
          invoice_id: sweep.invoice_id,
          amount: sweep.amount,
          chain: sweep.chain,
          error: message,
        });
      }
    }
  }

  /**
   * The relayer that funds gas for token sweeps.
   *
   * Same identity as the escrow/x402 operator — one address to keep topped up
   * rather than three.
   */
  private operatorWallet(provider: ethers.Provider): ethers.Wallet | null {
    const explicit = process.env.OPERATOR_PRIVATE_KEY;
    if (explicit) return new ethers.Wallet(explicit, provider);

    const seed = process.env.MASTER_SEED;
    if (!seed || !bip39.validateMnemonic(seed)) return null;

    const root = ethers.HDNodeWallet.fromSeed(bip39.mnemonicToSeedSync(seed));
    return new ethers.Wallet(root.derivePath("44'/60'/7'/0/0").privateKey, provider);
  }

  /**
   * Gas station: send just enough native currency for a token transfer.
   *
   * A single-use invoice address receives ERC-20 tokens and nothing else, so it
   * has no way to pay for the transfer that forwards them. Without this the
   * payment is detected, the invoice is marked paid, and the sweep fails
   * forever — the merchant sees a completed payment and never gets the money.
   *
   * Deliberately sends a bounded amount rather than a fixed constant, so a gas
   * spike doesn't under-fund it and a quiet chain doesn't overspend. Whatever
   * is left over is swept back out with the tokens' own sweep later.
   */
  private async fundGasFor(
    address: string,
    provider: ethers.Provider,
    gasLimit: bigint
  ): Promise<void> {
    const operator = this.operatorWallet(provider);
    if (!operator) {
      throw new Error(
        'No operator key configured — cannot fund gas for a token sweep. ' +
          'Set OPERATOR_PRIVATE_KEY (or MASTER_SEED) and fund that address.'
      );
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) throw new Error('could not read gas price');

    // 50% headroom: the price can move between funding and the transfer.
    const needed = (gasPrice * gasLimit * 15n) / 10n;
    const held = await provider.getBalance(address);
    if (held >= needed) return;

    const topUp = needed - held;
    const cap = ethers.parseEther(process.env.MAX_GAS_TOPUP_ETH || '0.002');
    if (topUp > cap) {
      throw new Error(
        `gas top-up of ${ethers.formatEther(topUp)} exceeds MAX_GAS_TOPUP_ETH — refusing to overspend`
      );
    }

    const operatorBalance = await provider.getBalance(operator.address);
    if (operatorBalance < topUp) {
      throw new Error(
        `operator ${operator.address} has ${ethers.formatEther(operatorBalance)} ETH, ` +
          `needs ${ethers.formatEther(topUp)} to fund this token sweep`
      );
    }

    const tx = await operator.sendTransaction({ to: address, value: topUp });
    await tx.wait();
    console.log(`⛽ Funded ${address} with ${ethers.formatEther(topUp)} for its token sweep`);
  }

  private async sweepEVM(sweep: any): Promise<string> {
    // Imported lazily to avoid a circular import with blockchain.service.
    const { blockchainService } = await import('./blockchain.service');
    const provider = blockchainService.getProvider(sweep.chain);
    if (!provider) throw new Error(`No provider for chain ${sweep.chain}`);

    const derived = walletService.getEVMWallet(sweep.from_address);
    if (!derived) throw new Error(`No key material for ${sweep.from_address}`);

    const signer = derived.connect(provider);

    const isFeeLeg = sweep.kind === 'fee';

    if (sweep.token) {
      // ERC-20: move the token balance, paying gas in the native asset.
      const token = new ethers.Contract(sweep.token, ERC20_ABI, signer);
      const decimals = Number(await token.decimals());
      const balance: bigint = await token.balanceOf(sweep.from_address);
      if (balance === 0n) throw new Error('token balance is zero');

      // An invoice address holds only the token it was paid in, so the gas for
      // forwarding has to come from somewhere. Top it up before transferring.
      const transferGas = await token.transfer
        .estimateGas(sweep.to_address, balance)
        .catch(() => 100_000n);
      await this.fundGasFor(sweep.from_address, provider, transferGas);

      // The fee leg takes an exact cut; the settlement leg takes the rest.
      const amount = isFeeLeg
        ? ethers.parseUnits(Number(sweep.amount).toFixed(decimals), decimals)
        : balance;
      if (amount > balance) throw new Error('token balance is below the sweep amount');

      const tx = await token.transfer(sweep.to_address, amount);
      await tx.wait();
      return tx.hash;
    }

    const balance = await provider.getBalance(sweep.from_address);
    if (balance === 0n) throw new Error('balance is zero');

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) throw new Error('could not read gas price');

    const gasLimit = 21000n;
    const gasCost = gasPrice * gasLimit;

    // Fee leg: an exact amount. Settlement leg: whatever is left, minus the gas
    // for this send, so no dust is stranded on the address.
    const value = isFeeLeg
      ? ethers.parseEther(Number(sweep.amount).toFixed(18))
      : balance - gasCost;

    if (value <= 0n) throw new Error('balance does not cover gas');
    if (isFeeLeg && value + gasCost > balance) throw new Error('balance does not cover fee plus gas');

    const tx = await signer.sendTransaction({
      to: sweep.to_address,
      value,
      gasLimit,
    });
    await tx.wait();
    return tx.hash;
  }

  private async sweepSolana(sweep: any): Promise<string> {
    const { blockchainService } = await import('./blockchain.service');
    const connection = blockchainService.getSolanaConnection();
    if (!connection) throw new Error('Solana connection not initialized');

    const keypair = walletService.getSolanaKeypair(sweep.from_address);
    if (!keypair) throw new Error(`No key material for ${sweep.from_address}`);

    // SPL tokens live in an associated account, not the wallet's lamports.
    if (sweep.token) {
      return this.sweepSplToken(connection, keypair, sweep);
    }

    const balance = await connection.getBalance(keypair.publicKey);
    if (balance === 0) throw new Error('balance is zero');

    const networkFee = await this.solanaFee(connection, keypair, sweep.to_address);
    const lamports =
      sweep.kind === 'fee'
        ? Math.floor(Number(sweep.amount) * LAMPORTS_PER_SOL)
        : balance - networkFee;

    if (lamports <= 0) throw new Error('balance does not cover the transaction fee');
    if (sweep.kind === 'fee' && lamports + networkFee > balance) {
      throw new Error('balance does not cover fee plus network fee');
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(sweep.to_address),
        lamports,
      })
    );

    return sendAndConfirmTransaction(connection, transaction, [keypair]);
  }

  /**
   * Move an SPL balance to the merchant.
   *
   * The invoice address pays the rent to open the merchant's token account if
   * they have never held this token, which is why a token invoice address needs
   * a little SOL alongside the tokens.
   */
  private async sweepSplToken(
    connection: Connection,
    vault: Keypair,
    sweep: any
  ): Promise<string> {
    const mint = new PublicKey(sweep.token);
    const fromAta = getAssociatedTokenAddressSync(mint, vault.publicKey, true);
    const destOwner = new PublicKey(sweep.to_address);
    const destAta = getAssociatedTokenAddressSync(mint, destOwner, true);

    const held = (await getAccount(connection, fromAta)).amount;
    if (held === 0n) throw new Error('token balance is zero');

    // Same problem as ERC-20: this address holds only the token it was paid
    // in, so it cannot pay the transaction fee — or the rent to open the
    // merchant's token account if they have never held this token before.
    await this.fundSolanaFor(connection, vault.publicKey, destAta);

    const tx = new Transaction();

    if (!(await connection.getAccountInfo(destAta))) {
      tx.add(createAssociatedTokenAccountInstruction(vault.publicKey, destAta, destOwner, mint));
    }

    // Decimals come from the mint itself — the authoritative source — rather
    // than from anything carried along with the sweep row.
    const { decimals } = await getMint(connection, mint);
    const amount =
      sweep.kind === 'fee'
        ? BigInt(Math.round(Number(sweep.amount) * 10 ** decimals))
        : held;

    if (amount > held) throw new Error('token balance is below the sweep amount');

    tx.add(
      createTransferInstruction(fromAta, destAta, vault.publicKey, amount, [], TOKEN_PROGRAM_ID)
    );

    return sendAndConfirmTransaction(connection, tx, [vault], { commitment: 'confirmed' });
  }

  /**
   * Solana gas station: top an address up with enough SOL for a token transfer,
   * plus rent if a new token account has to be created.
   */
  private async fundSolanaFor(
    connection: Connection,
    address: PublicKey,
    destinationAta: PublicKey
  ): Promise<void> {
    const needsRent = (await connection.getAccountInfo(destinationAta)) === null;
    // Rent-exempt minimum for a token account, plus a margin for fees.
    const rent = needsRent ? await connection.getMinimumBalanceForRentExemption(165) : 0;
    const needed = rent + 10_000;

    const held = await connection.getBalance(address);
    if (held >= needed) return;

    const funder = walletService.getSolanaOperator();
    if (!funder) {
      throw new Error(
        'No Solana operator configured — cannot fund rent for a token sweep. ' +
          'Set SOLANA_OPERATOR_SECRET (or MASTER_SEED) and fund that address.'
      );
    }

    const topUp = needed - held;
    const funderBalance = await connection.getBalance(funder.publicKey);
    if (funderBalance < topUp) {
      throw new Error(
        `Solana operator ${funder.publicKey.toBase58()} has ${funderBalance / LAMPORTS_PER_SOL} SOL, ` +
          `needs ${topUp / LAMPORTS_PER_SOL} to fund this sweep`
      );
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: address,
        lamports: topUp,
      })
    );
    await sendAndConfirmTransaction(connection, tx, [funder], { commitment: 'confirmed' });
    console.log(`⛽ Funded ${address.toBase58()} with ${topUp / LAMPORTS_PER_SOL} SOL for its sweep`);
  }

  private async solanaFee(connection: Connection, from: Keypair, to: string): Promise<number> {
    const { blockhash } = await connection.getLatestBlockhash();
    const probe = new Transaction({ feePayer: from.publicKey, blockhash, lastValidBlockHeight: 0 }).add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: new PublicKey(to),
        lamports: LAMPORTS_PER_SOL / 1000,
      })
    );

    const fee = await connection.getFeeForMessage(probe.compileMessage());
    return fee.value ?? 5000;
  }
}

export const sweepService = new SweepService();
