import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { webhookService } from './webhook.service';
import { sweepService } from './sweep.service';
import { getAsset } from '../config/assets';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/** Max blocks to scan per invoice per poll, to stay inside public RPC limits. */
const MAX_SCAN_RANGE = 200;

/** Re-scan a few blocks behind the last scan so a reorg can't drop a payment. */
const REORG_BUFFER = 5;

export interface ChainConfig {
  name: string;
  rpcUrl: string;
  confirmations: number;
  nativeToken: string;
  explorer: string;
}

export const CHAINS: { [key: string]: ChainConfig } = {
  ETH: {
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.ETH_RPC_URL || '',
    confirmations: Number(process.env.CONFIRMATION_BLOCKS || 3),
    nativeToken: 'ETH',
    explorer: 'https://sepolia.etherscan.io',
  },
  BSC: {
    name: 'BSC Testnet',
    rpcUrl: process.env.BSC_RPC_URL || '',
    confirmations: Number(process.env.CONFIRMATION_BLOCKS || 3),
    nativeToken: 'BNB',
    explorer: 'https://testnet.bscscan.com',
  },
  BASE: {
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    confirmations: Number(process.env.CONFIRMATION_BLOCKS || 3),
    nativeToken: 'ETH',
    explorer: 'https://sepolia.basescan.org',
  },
};

/** Tolerance below the expected amount that still counts as paid in full. */
const UNDERPAY_TOLERANCE = Number(process.env.UNDERPAY_TOLERANCE || 0.01);
/** Excess above expected that gets flagged as an overpayment. */
const OVERPAY_TOLERANCE = Number(process.env.OVERPAY_TOLERANCE || 0.01);

class BlockchainService {
  private evmProviders: Map<string, ethers.JsonRpcProvider> = new Map();
  private solanaConnection: Connection | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private tickInFlight = false;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    for (const [chain, config] of Object.entries(CHAINS)) {
      if (config.rpcUrl) {
        this.evmProviders.set(chain, new ethers.JsonRpcProvider(config.rpcUrl));
      } else {
        console.warn(`⚠️  No RPC URL for ${chain} — payments on this chain will not be detected`);
      }
    }

    const solanaRpc = process.env.SOLANA_RPC_URL;
    if (solanaRpc) {
      this.solanaConnection = new Connection(solanaRpc, 'confirmed');
    } else {
      console.warn('⚠️  No SOLANA_RPC_URL — Solana payments will not be detected');
    }

    console.log('✅ Blockchain providers initialized');
  }

  getProvider(chain: string) {
    return this.evmProviders.get(chain);
  }

  getSolanaConnection() {
    return this.solanaConnection;
  }

  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already running');
      return;
    }

    const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '10000');
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => this.tick(), pollInterval);

    console.log(`✅ Blockchain monitoring started (polling every ${pollInterval}ms)`);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️  Blockchain monitoring stopped');
  }

  /** Guard against overlapping runs when a slow RPC outlasts the poll interval. */
  private async tick() {
    if (this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      await this.checkPendingInvoices();
    } catch (error) {
      console.error('Error checking pending invoices:', error);
    } finally {
      this.tickInFlight = false;
    }
  }

  private async checkPendingInvoices() {
    const pendingInvoices = queries.getPendingInvoices.all() as any[];

    for (const invoice of pendingInvoices) {
      try {
        if (invoice.chain === 'SOLANA') {
          await this.checkSolanaPayment(invoice);
        } else {
          await this.checkEVMPayment(invoice);
        }

        // Expire only after checking: a payment that landed in the final
        // seconds should still be credited rather than silently dropped.
        const fresh = queries.getInvoiceById.get(invoice.id) as any;
        if (
          new Date(fresh.expires_at) < new Date() &&
          ['new', 'pending'].includes(fresh.status) &&
          Number(fresh.received_amount || 0) === 0
        ) {
          queries.updateInvoiceStatus.run('expired', null, invoice.id);
          console.log(`⏰ Invoice ${invoice.id} expired`);
          await webhookService.trigger(invoice.merchant_id, 'payment.expired', {
            invoice_id: invoice.id,
          });
        }
      } catch (error) {
        console.error(`Error checking invoice ${invoice.id}:`, error);
      }
    }
  }

  // --- EVM -------------------------------------------------------------------

  private async checkEVMPayment(invoice: any) {
    const provider = this.evmProviders.get(invoice.chain);
    if (!provider) return;

    const head = await provider.getBlockNumber();
    const from = Math.max(
      0,
      (invoice.last_scanned_block ?? head - MAX_SCAN_RANGE) - REORG_BUFFER
    );
    const to = Math.min(head, from + MAX_SCAN_RANGE);
    if (to < from) return;

    if (invoice.token_address) {
      await this.scanTokenTransfers(invoice, provider, from, to);
    } else {
      await this.scanNativeTransfers(invoice, provider, from, to);
    }

    queries.updateInvoiceScannedBlock.run(to, invoice.id);
    await this.reconcile(invoice.id, head);
  }

  /**
   * Native transfers emit no logs, so the blocks themselves have to be read.
   * The window is bounded and only runs while an invoice is open.
   */
  private async scanNativeTransfers(
    invoice: any,
    provider: ethers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number
  ) {
    const target = invoice.unique_address.toLowerCase();

    for (let n = fromBlock; n <= toBlock; n++) {
      const block = await provider.getBlock(n, true);
      if (!block) continue;

      for (const tx of block.prefetchedTransactions) {
        if (tx.to?.toLowerCase() !== target || tx.value === 0n) continue;

        queries.createPayment.run(
          uuidv4(),
          invoice.id,
          tx.hash,
          0,
          tx.from,
          ethers.formatEther(tx.value),
          null,
          n,
          0
        );
        console.log(
          `💰 ${ethers.formatEther(tx.value)} ${invoice.crypto} → invoice ${invoice.id} (${tx.hash})`
        );
      }
    }
  }

  /** ERC-20 receipts come straight from Transfer logs filtered by recipient. */
  private async scanTokenTransfers(
    invoice: any,
    provider: ethers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number
  ) {
    const logs = await provider.getLogs({
      address: invoice.token_address,
      topics: [TRANSFER_TOPIC, null, ethers.zeroPadValue(invoice.unique_address, 32)],
      fromBlock,
      toBlock,
    });

    if (logs.length === 0) return;

    const token = new ethers.Contract(
      invoice.token_address,
      ['function decimals() view returns (uint8)'],
      provider
    );
    const decimals = Number(await token.decimals());

    for (const log of logs) {
      const amount = ethers.formatUnits(BigInt(log.data), decimals);
      const sender = ethers.getAddress('0x' + log.topics[1].slice(26));

      queries.createPayment.run(
        uuidv4(),
        invoice.id,
        log.transactionHash,
        log.index,
        sender,
        amount,
        invoice.token_address,
        log.blockNumber,
        0
      );
      console.log(`💰 ${amount} ${invoice.crypto} → invoice ${invoice.id} (${log.transactionHash})`);
    }
  }

  // --- Solana ----------------------------------------------------------------

  private async checkSolanaPayment(invoice: any) {
    if (!this.solanaConnection) return;

    // An SPL payment never touches the wallet's lamport balance, so the native
    // path below would never see it.
    if (invoice.token_address) {
      await this.checkSolanaTokenPayment(invoice);
      return;
    }

    const publicKey = new PublicKey(invoice.solana_address || invoice.unique_address);
    const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, { limit: 20 });

    for (const sig of signatures) {
      if (sig.err) continue;

      const tx = await this.solanaConnection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) continue;

      // Credit the net lamport increase for this address in this transaction.
      const keys = tx.transaction.message.getAccountKeys();
      const idx = keys.staticAccountKeys.findIndex((k) => k.equals(publicKey));
      if (idx === -1) continue;

      const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
      if (delta <= 0) continue;

      // Identify the payer: the account that lost the most lamports. Falls back
      // to the fee payer (index 0), which is the signer of a simple transfer.
      let payer: string | null = null;
      let largestDebit = 0;
      keys.staticAccountKeys.forEach((key, i) => {
        const change = tx.meta!.postBalances[i] - tx.meta!.preBalances[i];
        if (change < largestDebit) {
          largestDebit = change;
          payer = key.toBase58();
        }
      });
      payer ??= keys.staticAccountKeys[0]?.toBase58() ?? null;

      queries.createPayment.run(
        uuidv4(),
        invoice.id,
        sig.signature,
        0,
        payer,
        (delta / LAMPORTS_PER_SOL).toString(),
        null,
        sig.slot,
        1
      );
      console.log(
        `💰 ${delta / LAMPORTS_PER_SOL} SOL → invoice ${invoice.id} (${sig.signature})`
      );
    }

    // Solana finality is fast enough that the slot itself is the confirmation.
    await this.reconcile(invoice.id, 0);
  }

  /**
   * SPL token payments.
   *
   * Reads the invoice address's associated token account rather than scanning
   * signatures: the ATA balance IS the amount received, and the account is
   * single-use so there is nothing to disambiguate. Signatures are then used
   * only to attach a transaction hash and payer to the receipt.
   */
  private async checkSolanaTokenPayment(invoice: any) {
    const connection = this.solanaConnection!;
    const owner = new PublicKey(invoice.solana_address || invoice.unique_address);
    const mint = new PublicKey(invoice.token_address);

    const { getAccount, getAssociatedTokenAddressSync } = await import('@solana/spl-token');
    const ata = getAssociatedTokenAddressSync(mint, owner, true);

    let balance = 0n;
    try {
      balance = (await getAccount(connection, ata)).amount;
    } catch {
      // No token account yet — nothing has been sent.
      return;
    }
    if (balance === 0n) return;

    const decimals = invoice.token_decimals ?? getAsset('SOLANA', invoice.crypto)?.decimals ?? 6;
    const amount = (Number(balance) / 10 ** decimals).toString();

    // Already recorded? The unique constraint would reject it anyway, but this
    // avoids a redundant signature lookup on every poll.
    const existing = queries.getPaymentsByInvoice.all(invoice.id) as any[];
    const alreadyCredited = existing.reduce((sum, p) => sum + Number(p.amount), 0);
    if (alreadyCredited >= Number(amount)) {
      await this.reconcile(invoice.id, 0);
      return;
    }

    const signatures = await connection.getSignaturesForAddress(ata, { limit: 10 });
    const settled = signatures.find((sig) => !sig.err);

    queries.createPayment.run(
      uuidv4(),
      invoice.id,
      settled?.signature ?? `spl:${ata.toBase58()}`,
      0,
      null,
      amount,
      invoice.token_address,
      settled?.slot ?? 0,
      1
    );

    console.log(`💰 ${amount} ${invoice.crypto} (SPL) → invoice ${invoice.id}`);
    await this.reconcile(invoice.id, 0);
  }

  // --- Reconciliation --------------------------------------------------------

  /**
   * Sum everything received against an invoice and move it to the right state.
   * Runs after every scan so partial payments accumulate across polls instead
   * of being judged against a single balance snapshot.
   */
  private async reconcile(invoiceId: string, head: number) {
    const invoice = queries.getInvoiceById.get(invoiceId) as any;
    if (!invoice || ['paid', 'expired', 'refunded'].includes(invoice.status)) return;

    const payments = queries.getPaymentsByInvoice.all(invoiceId) as any[];
    const received = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const expected = Number(invoice.expected_amount);

    queries.updateInvoiceReceived.run(received.toString(), invoiceId);

    if (received === 0) return;

    const required = CHAINS[invoice.chain]?.confirmations ?? 3;
    const confirmations =
      invoice.chain === 'SOLANA'
        ? required
        : Math.min(...payments.map((p) => (p.block_number ? head - p.block_number : 0)));

    if (received < expected * (1 - UNDERPAY_TOLERANCE)) {
      if (invoice.status !== 'underpaid') {
        queries.updateInvoiceStatus.run('underpaid', null, invoiceId);
        console.log(
          `⚠️  Invoice ${invoiceId} underpaid: ${received} of ${expected} ${invoice.crypto}`
        );
        await webhookService.trigger(invoice.merchant_id, 'payment.underpaid', {
          invoice_id: invoiceId,
          received: received.toString(),
          expected: invoice.expected_amount,
          shortfall: (expected - received).toString(),
          crypto: invoice.crypto,
        });
      }
      return;
    }

    if (confirmations < required) {
      if (invoice.status !== 'confirming') {
        queries.updateInvoiceStatus.run('confirming', null, invoiceId);
        await webhookService.trigger(invoice.merchant_id, 'payment.confirming', {
          invoice_id: invoiceId,
          received: received.toString(),
          confirmations,
          required,
        });
      }
      return;
    }

    // Paid in full (or better).
    const overpaid = received > expected * (1 + OVERPAY_TOLERANCE);
    queries.updateInvoiceStatus.run('paid', new Date().toISOString(), invoiceId);

    for (const p of payments) {
      queries.createTransaction.run(
        uuidv4(),
        invoiceId,
        invoice.merchant_id,
        p.tx_hash,
        p.amount,
        invoice.chain,
        'completed',
        confirmations
      );
    }

    console.log(
      `✅ Invoice ${invoiceId} paid: ${received} ${invoice.crypto}${overpaid ? ' (OVERPAID)' : ''}`
    );

    await webhookService.trigger(invoice.merchant_id, 'payment.completed', {
      invoice_id: invoiceId,
      amount: received.toString(),
      expected: invoice.expected_amount,
      overpaid,
      overpayment: overpaid ? (received - expected).toString() : '0',
      crypto: invoice.crypto,
      chain: invoice.chain,
      tx_hash: payments[0]?.tx_hash,
      confirmations,
    });

    // Forward the funds off the single-use address to the merchant.
    sweepService.enqueue(invoice, received.toString());
  }

  // --- Manual verification ---------------------------------------------------

  async verifyTransaction(txHash: string, chain: string): Promise<any> {
    return chain === 'SOLANA'
      ? this.verifySolanaTransaction(txHash)
      : this.verifyEVMTransaction(txHash, chain);
  }

  getExplorerUrl(txHash: string, chain: string): string {
    if (chain === 'SOLANA') {
      return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
    }
    return CHAINS[chain] ? `${CHAINS[chain].explorer}/tx/${txHash}` : '#';
  }

  private async verifyEVMTransaction(txHash: string, chain: string) {
    const provider = this.evmProviders.get(chain);
    if (!provider) throw new Error(`No provider for chain ${chain}`);

    const tx = await provider.getTransaction(txHash);
    if (!tx) throw new Error('Transaction not found');

    const receipt = await provider.getTransactionReceipt(txHash);
    const currentBlock = await provider.getBlockNumber();

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value),
      confirmations: receipt ? currentBlock - receipt.blockNumber : 0,
      status: receipt?.status === 1 ? 'success' : 'failed',
    };
  }

  private async verifySolanaTransaction(signature: string) {
    if (!this.solanaConnection) throw new Error('Solana connection not initialized');

    const tx = await this.solanaConnection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) throw new Error('Transaction not found');

    return {
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      status: tx.meta?.err ? 'failed' : 'success',
    };
  }
}

export const blockchainService = new BlockchainService();
