import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';

class WalletService {
  private hdNode: ethers.HDNodeWallet | null = null;
  private addressIndex = 0;
  private solanaKeypairs: Map<string, Keypair> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize() {
    const masterSeed = process.env.MASTER_SEED;
    
    if (!masterSeed) {
      console.warn('⚠️  MASTER_SEED not set. Generating temporary seed (NOT FOR PRODUCTION!)');
      const mnemonic = bip39.generateMnemonic();
      console.log('🔑 Temporary Mnemonic:', mnemonic);
      this.hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    } else {
      // Validate mnemonic
      if (!bip39.validateMnemonic(masterSeed)) {
        throw new Error('Invalid MASTER_SEED mnemonic phrase');
      }
      this.hdNode = ethers.HDNodeWallet.fromPhrase(masterSeed);
    }

    console.log('✅ Wallet service initialized');
  }

  /**
   * Generate unique EVM address for payment
   * Uses BIP44 derivation path: m/44'/60'/0'/0/index
   */
  generateEVMAddress(index?: number): { address: string; privateKey: string; index: number } {
    if (!this.hdNode) {
      throw new Error('HD Node not initialized');
    }

    const derivationIndex = index ?? this.addressIndex++;
    
    // BIP44 path for Ethereum: m/44'/60'/0'/0/index
    const path = `m/44'/60'/0'/0/${derivationIndex}`;
    const wallet = this.hdNode.derivePath(path);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      index: derivationIndex,
    };
  }

  /**
   * Generate unique Solana address for payment
   * Creates new keypair and stores it
   */
  generateSolanaAddress(invoiceId: string): { address: string; publicKey: string } {
    const keypair = Keypair.generate();
    this.solanaKeypairs.set(invoiceId, keypair);

    return {
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58(),
    };
  }

  /**
   * Get Solana keypair for an invoice
   */
  getSolanaKeypair(invoiceId: string): Keypair | undefined {
    return this.solanaKeypairs.get(invoiceId);
  }

  /**
   * Derive wallet from index (for monitoring)
   */
  getWalletByIndex(index: number): ethers.Wallet {
    if (!this.hdNode) {
      throw new Error('HD Node not initialized');
    }

    const path = `m/44'/60'/0'/0/${index}`;
    return this.hdNode.derivePath(path);
  }

  /**
   * Get current address index
   */
  getCurrentIndex(): number {
    return this.addressIndex;
  }

  /**
   * Set address index (useful for recovery)
   */
  setAddressIndex(index: number) {
    this.addressIndex = index;
  }
}

export const walletService = new WalletService();
