import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { queries } from '../config/database';
import { walletService } from './wallet.service';
import { priceService } from './price.service';
import { webhookService } from './webhook.service';
import { v4 as uuidv4 } from 'uuid';

interface ChainConfig {
  name: string;
  rpcUrl: string;
  confirmations: number;
  nativeToken: string;
}

class BlockchainService {
  private evmProviders: Map<string, ethers.JsonRpcProvider> = new Map();
  private solanaConnection: Connection | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private chains: { [key: string]: ChainConfig } = {
    ETH: {
      name: 'Ethereum Sepolia',
      rpcUrl: process.env.ETH_RPC_URL || '',
      confirmations: 3,
      nativeToken: 'ETH',
    },
    BSC: {
      name: 'BSC Testnet',
      rpcUrl: process.env.BSC_RPC_URL || '',
      confirmations: 3,
      nativeToken: 'BNB',
    },
  };

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize EVM providers
    for (const [chain, config] of Object.entries(this.chains)) {
      if (config.rpcUrl) {
        this.evmProviders.set(chain, new ethers.JsonRpcProvider(config.rpcUrl));
      }
    }

    // Initialize Solana connection
    const solanaRpc = process.env.SOLANA_RPC_URL;
    if (solanaRpc) {
      this.solanaConnection = new Connection(solanaRpc, 'confirmed');
    }

    console.log('✅ Blockchain providers initialized');
  }

  /**
   * Start monitoring pending invoices for payments
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already running');
      return;
    }

    const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '10000');
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkPendingInvoices();
    }, pollInterval);

    console.log(`✅ Blockchain monitoring started (polling every ${pollInterval}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️  Blockchain monitoring stopped');
  }

  /**
   * Check all pending invoices for payments
   */
  private async checkPendingInvoices() {
    try {
      const pendingInvoices = await queries.getPendingInvoices();

      for (const invoice of pendingInvoices as any[]) {
        // Check if expired
        if (new Date(invoice.expires_at) < new Date()) {
          queries.updateInvoiceStatus.run('expired', null, invoice.id);
          console.log(`⏰ Invoice ${invoice.id} expired`);
          continue;
        }

        // Check for payment based on chain
        if (invoice.chain === 'SOLANA') {
          await this.checkSolanaPayment(invoice);
        } else {
          await this.checkEVMPayment(invoice);
        }
      }
    } catch (error) {
      console.error('Error checking pending invoices:', error);
    }
  }

  /**
   * Check EVM chain for payment
   */
  private async checkEVMPayment(invoice: any) {
    try {
      const provider = this.evmProviders.get(invoice.chain);
      if (!provider) {
        console.error(`No provider for chain ${invoice.chain}`);
        return;
      }

      const balance = await provider.getBalance(invoice.unique_address);
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      const expectedAmount = parseFloat(invoice.expected_amount);

      // Check if payment received (with 1% tolerance for gas/rounding)
      if (balanceInEth >= expectedAmount * 0.99) {
        // Get transaction details
        const blockNumber = await provider.getBlockNumber();
        const history = await provider.getHistory(invoice.unique_address);
        
        if (history.length > 0) {
          const tx = history[history.length - 1]; // Most recent transaction
          
          // Create transaction record
          const txId = uuidv4();
          queries.createTransaction.run(
            txId,
            invoice.id,
            invoice.merchant_id,
            tx.hash,
            balanceInEth.toString(),
            invoice.chain,
            'confirming',
            0
          );

          // Update invoice status
          queries.updateInvoiceStatus.run('confirming', null, invoice.id);

          console.log(`💰 Payment detected for invoice ${invoice.id}: ${balanceInEth} ${invoice.crypto}`);

          // Check confirmations
          if (tx.blockNumber) {
            const confirmations = blockNumber - tx.blockNumber;
            const requiredConfirmations = this.chains[invoice.chain].confirmations;

            if (confirmations >= requiredConfirmations) {
              // Payment confirmed
              queries.updateInvoiceStatus.run('paid', new Date().toISOString(), invoice.id);
              queries.updateTransactionStatus.run('completed', confirmations, new Date().toISOString(), txId);

              console.log(`✅ Payment confirmed for invoice ${invoice.id} (${confirmations} confirmations)`);

              // Trigger webhook
              await webhookService.triggerWebhook(invoice.merchant_id, 'payment.completed', {
                invoice_id: invoice.id,
                amount: balanceInEth,
                crypto: invoice.crypto,
                chain: invoice.chain,
                tx_hash: tx.hash,
                confirmations,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking EVM payment for invoice ${invoice.id}:`, error);
    }
  }

  /**
   * Check Solana for payment
   */
  private async checkSolanaPayment(invoice: any) {
    try {
      if (!this.solanaConnection) {
        console.error('Solana connection not initialized');
        return;
      }

      const publicKey = new PublicKey(invoice.solana_address || invoice.unique_address);
      const balance = await this.solanaConnection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      const expectedAmount = parseFloat(invoice.expected_amount);

      // Check if payment received
      if (balanceInSol >= expectedAmount * 0.99) {
        // Get transaction signatures
        const signatures = await this.solanaConnection.getSignaturesForAddress(publicKey, { limit: 1 });
        
        if (signatures.length > 0) {
          const signature = signatures[0].signature;
          
          // Create transaction record
          const txId = uuidv4();
          queries.createTransaction.run(
            txId,
            invoice.id,
            invoice.merchant_id,
            signature,
            balanceInSol.toString(),
            'SOLANA',
            'completed', // Solana confirmations are fast
            1
          );

          // Update invoice status
          queries.updateInvoiceStatus.run('paid', new Date().toISOString(), invoice.id);

          console.log(`✅ Solana payment confirmed for invoice ${invoice.id}: ${balanceInSol} SOL`);

          // Trigger webhook
          await webhookService.triggerWebhook(invoice.merchant_id, 'payment.completed', {
            invoice_id: invoice.id,
            amount: balanceInSol,
            crypto: 'SOL',
            chain: 'SOLANA',
            tx_hash: signature,
          });
        }
      }
    } catch (error) {
      console.error(`Error checking Solana payment for invoice ${invoice.id}:`, error);
    }
  }

  /**
   * Manually verify a transaction
   */
  async verifyTransaction(txHash: string, chain: string): Promise<any> {
    if (chain === 'SOLANA') {
      return this.verifySolanaTransaction(txHash);
    } else {
      return this.verifyEVMTransaction(txHash, chain);
    }
  }

  private getExplorerUrl(txHash: string, chain: string): string {
    const explorers: { [key: string]: string } = {
      ETH: `https://sepolia.etherscan.io/tx/${txHash}`,
      BSC: `https://testnet.bscscan.com/tx/${txHash}`,
      SOLANA: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    };
    return explorers[chain] || '#';
  }

  private async verifyEVMTransaction(txHash: string, chain: string) {
    const provider = this.evmProviders.get(chain);
    if (!provider) {
      throw new Error(`No provider for chain ${chain}`);
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      throw new Error('Transaction not found');
    }

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
    if (!this.solanaConnection) {
      throw new Error('Solana connection not initialized');
    }

    const tx = await this.solanaConnection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    return {
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      status: tx.meta?.err ? 'failed' : 'success',
    };
  }
}

export const blockchainService = new BlockchainService();
