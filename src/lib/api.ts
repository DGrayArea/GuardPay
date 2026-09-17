'use client';

import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PaymentLink {
  id: string;
  title: string;
  price: number;
  currency: 'USD' | 'EUR';
  crypto: string;
  /** Settlement chain, e.g. BASE, ETH, BSC, SOLANA. */
  chain?: string;
  tokenAddress?: string | null;
  walletAddress?: string;
  solanaAddress?: string;
  createdAt: string;
}

export interface SupportedAsset {
  symbol: string;
  name: string;
  kind: 'native' | 'erc20' | 'spl';
  decimals: number;
  address: string | null;
  stable: boolean;
}

export interface SupportedChain {
  chain: string;
  name: string;
  family: 'EVM' | 'SOLANA';
  assets: SupportedAsset[];
}

export interface Transaction {
  id: string;
  invoiceId: string;
  linkId?: string | null;
  /** Product title from the originating payment link. */
  linkTitle: string;
  txHash: string;
  /** Fiat amount the invoice was priced at. */
  amount: number;
  currency: string;
  /** Amount actually received on-chain. */
  cryptoAmount: string;
  crypto: string;
  chain: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  confirmations: number;
  /** Payer's address, when the chain exposes it. */
  customer: string | null;
  type: 'link' | 'direct' | 'escrow';
  confirmedAt?: string;
  timestamp: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  linkId: string;
  linkTitle?: string;
  amount: number;
  currency: string;
  crypto: string;
  chain: string;
  status: 'new' | 'pending' | 'confirming' | 'underpaid' | 'paid' | 'expired';
  /** Total received so far — may be less than expectedAmount. */
  receivedAmount?: string;
  paymentAddress: string;
  solanaAddress?: string;
  expectedAmount: string;
  /** ERC-20/SPL contract or mint. Null for a chain's native asset. */
  tokenAddress?: string | null;
  tokenDecimals?: number;
  assetKind?: 'native' | 'erc20' | 'spl';
  /** True for USD-pegged assets — no rate volatility during the lock window. */
  isStablecoin?: boolean;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
  fee?: InvoiceFee;
  transactions?: Transaction[];
}

export interface InvoiceFee {
  /** Listed price before the platform fee. */
  subtotal: number;
  /** Platform fee in fiat. */
  amount: number;
  /** Fee rate in basis points (100 = 1%). */
  bps: number;
  paidBy: 'receiver' | 'payer';
  /** What the payer owes in total. */
  total: number;
}

export type EscrowStatus =
  | 'draft'
  | 'pending_funding'
  | 'funded'
  | 'active'
  | 'disputed'
  | 'released'
  | 'refunded'
  | 'cancelled';

export interface Escrow {
  id: string;
  title: string;
  description?: string | null;
  conditions?: string | null;
  buyerAddress: string;
  sellerAddress: string;
  amount: string;
  currency: string;
  chain: string;
  token?: string | null;
  /** 'contract' = held by an audited on-chain escrow; 'custodial' = held by GuardPay. */
  custody: 'contract' | 'custodial';
  contractAddress?: string | null;
  /** Vault address for custodial deals — where the buyer sends funds. */
  depositAddress?: string | null;
  status: EscrowStatus;
  fundedTxHash?: string | null;
  releaseTxHash?: string | null;
  refundTxHash?: string | null;
  deadlineAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowEvent {
  id: string;
  escrow_id: string;
  type: string;
  actor: string | null;
  note: string | null;
  tx_hash: string | null;
  created_at: string;
}

export interface EscrowDetail extends Escrow {
  events: EscrowEvent[];
  viewerRole: 'buyer' | 'seller';
  /** Live state read from the escrow contract; null if unfunded or unreadable. */
  onchain: {
    hasCollectedPayment: boolean;
    capturableAmount: string;
    refundableAmount: string;
    /** Custodial deals only: whether the vault holds the full amount. */
    funded?: boolean;
  } | null;
}

export interface EscrowChainConfig {
  configured: boolean;
  custody: 'contract' | 'custodial';
  chain: string;
  operator?: string | null;
  escrowContract?: string;
  preApprovalCollector?: string;
  token: { address?: string; mint?: string; symbol: string; decimals: number };
}

export interface EscrowConfig {
  configured: boolean;
  chain: string;
  operator: string | null;
  escrowContract: string;
  preApprovalCollector: string;
  token: { address: string; symbol: string; decimals: number };
  fee: { bps: number; fee: number; paidBy: string };
  chains: { evm: EscrowChainConfig; solana: EscrowChainConfig };
}

/** The exact struct the buyer must pre-approve, as the operator will submit it. */
export interface EscrowPaymentInfo {
  paymentInfo: {
    operator: string;
    payer: string;
    receiver: string;
    token: string;
    maxAmount: string;
    preApprovalExpiry: number;
    authorizationExpiry: number;
    refundExpiry: number;
    minFeeBps: number;
    maxFeeBps: number;
    feeReceiver: string;
    salt: string;
  };
  collector: string;
  escrowContract: string;
  token: { address: string; symbol: string; decimals: number };
  amount: string;
}

export interface Account {
  id: string;
  walletAddress: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  /** True once they've published a payment link — a role, not a flag. */
  isSeller: boolean;
  merchantName: string | null;
  stats: {
    paymentsMade: number;
    totalSpent: number;
    merchantsPaid: number;
    openEscrows: number;
    linksPublished: number;
  };
}

/** A payment as the BUYER sees it — the other half of the merchant ledger. */
export interface BuyerPayment {
  invoiceId: string;
  title: string;
  merchantName: string;
  merchantWallet: string | null;
  amount: number;
  currency: string;
  cryptoAmount: string;
  crypto: string;
  chain: string;
  status: string;
  txHash: string;
  explorerUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PublicProfile {
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
  registered: boolean;
}

export interface Settings {
  merchantName: string;
  receivingAddress: string;
  solanaAddress: string;
  defaultCurrency: 'USD' | 'EUR';
}

export interface MerchantProfile {
  id: string;
  walletAddress: string;
  merchantName: string;
  receivingAddress: string;
  solanaAddress: string;
  defaultCurrency: string;
  apiKey?: string;
}

export interface Stats {
  /** Net of platform fees — what the merchant actually keeps. */
  totalVolume: number;
  /** Before platform fees. */
  grossVolume: number;
  /** Platform fees charged to date. */
  feesPaid: number;
  totalTransactions: number;
  /** Alias of totalTransactions. */
  totalTx: number;
  pendingInvoices: number;
  activeEscrows: number;
  recentTransactions: any[];
}

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // The token is NOT read here: this module is imported during server
    // rendering, where localStorage does not exist. AuthProvider calls
    // loadStoredSession() once the client has hydrated.

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear auth
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  private setAuthHeader(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /** Restore the persisted token. Safe to call repeatedly; client-side only. */
  loadStoredSession() {
    if (typeof window === 'undefined') return;

    this.token = localStorage.getItem('guardpay_token');
    if (this.token) {
      this.setAuthHeader(this.token);
    }
  }

  // Authentication
  async getNonce(walletAddress: string): Promise<string> {
    const response = await this.client.post('/auth/nonce', { walletAddress });
    return response.data.nonce;
  }

  async verifySignature(walletAddress: string, signature: string): Promise<{ token: string; merchant: any }> {
    const response = await this.client.post('/auth/verify', { walletAddress, signature });
    this.token = response.data.token;
    localStorage.setItem('guardpay_token', this.token);
    this.setAuthHeader(this.token);
    return response.data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('guardpay_token');
    delete this.client.defaults.headers.common['Authorization'];
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Merchant
  async getProfile(): Promise<MerchantProfile> {
    const response = await this.client.get('/merchant/profile');
    return response.data;
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await this.client.put('/merchant/settings', settings);
    return response.data;
  }

  async generateApiKey(): Promise<{ apiKey: string; message: string }> {
    const response = await this.client.post('/merchant/api-key');
    return response.data;
  }

  async getStats(): Promise<Stats> {
    const response = await this.client.get('/merchant/stats');
    return response.data;
  }

  /** Merchant settings, as the settings and checkout screens consume them. */
  async getSettings(): Promise<Settings> {
    const profile = await this.getProfile();
    return {
      merchantName: profile.merchantName,
      receivingAddress: profile.receivingAddress,
      solanaAddress: profile.solanaAddress,
      defaultCurrency: (profile.defaultCurrency as 'USD' | 'EUR') ?? 'USD',
    };
  }

  async getTransactions(): Promise<Transaction[]> {
    const response = await this.client.get('/merchant/transactions');
    return response.data;
  }

  async getInvoices(): Promise<Invoice[]> {
    const response = await this.client.get('/merchant/invoices');
    return response.data;
  }

  /** Assets this deployment can settle, for the link-creation picker. */
  async getSupportedAssets(): Promise<SupportedChain[]> {
    const response = await this.client.get('/links/assets');
    return response.data;
  }

  // Payment Links
  async getLinks(): Promise<PaymentLink[]> {
    const response = await this.client.get('/links');
    return response.data;
  }

  async createLink(
    data: Omit<PaymentLink, 'id' | 'createdAt'> & { chain?: string }
  ): Promise<PaymentLink> {
    const response = await this.client.post('/links', data);
    return response.data;
  }

  async getLink(id: string): Promise<PaymentLink> {
    const response = await this.client.get(`/links/${id}`);
    return response.data;
  }

  async updateLink(id: string, data: Partial<PaymentLink>): Promise<PaymentLink> {
    const response = await this.client.put(`/links/${id}`, data);
    return response.data;
  }

  async deleteLink(id: string): Promise<void> {
    await this.client.delete(`/links/${id}`);
  }

  // Invoices
  async createInvoice(linkId: string, chain?: string): Promise<Invoice> {
    const response = await this.client.post('/invoices', { linkId, chain });
    return response.data;
  }

  async getInvoice(id: string): Promise<Invoice> {
    const response = await this.client.get(`/invoices/${id}`);
    return response.data;
  }

  async getInvoiceStatus(
    id: string
  ): Promise<{ status: string; paidAt?: string; receivedAmount?: string; transactions: any[] }> {
    const response = await this.client.get(`/invoices/${id}/status`);
    return response.data;
  }

  async verifyInvoice(id: string): Promise<void> {
    await this.client.post(`/invoices/${id}/verify`);
  }

  // Account (buyer side)
  async getAccount(): Promise<Account> {
    const response = await this.client.get('/account');
    return response.data;
  }

  async updateAccount(data: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<Account> {
    const response = await this.client.put('/account', data);
    return response.data;
  }

  async getMyPayments(): Promise<BuyerPayment[]> {
    const response = await this.client.get('/account/payments');
    return response.data;
  }

  async getPublicProfile(address: string): Promise<PublicProfile> {
    const response = await this.client.get(`/account/users/${address}`);
    return response.data;
  }

  /** Display names for counterparty addresses, so escrows show people not hex. */
  async lookupProfiles(
    addresses: string[]
  ): Promise<Record<string, { displayName: string | null; avatarUrl: string | null }>> {
    const response = await this.client.post('/account/directory', { addresses });
    return response.data;
  }

  // Escrow
  async getEscrowConfig(): Promise<EscrowConfig> {
    const response = await this.client.get('/escrows/config');
    return response.data;
  }

  async getEscrows(): Promise<Escrow[]> {
    const response = await this.client.get('/escrows');
    return response.data;
  }

  async getEscrow(id: string): Promise<EscrowDetail> {
    const response = await this.client.get(`/escrows/${id}`);
    return response.data;
  }

  async createEscrow(data: {
    title: string;
    description?: string;
    conditions?: string;
    counterparty: string;
    role: 'buyer' | 'seller';
    amount: string;
    network?: 'evm' | 'solana';
    deadlineAt?: string;
  }): Promise<Escrow> {
    const response = await this.client.post('/escrows', data);
    return response.data;
  }

  async getEscrowPaymentInfo(id: string): Promise<EscrowPaymentInfo> {
    const response = await this.client.get(`/escrows/${id}/payment-info`);
    return response.data;
  }

  /** Called after the buyer's wallet has approved and pre-approved. */
  async authorizeEscrow(id: string): Promise<Escrow & { txHash: string }> {
    const response = await this.client.post(`/escrows/${id}/authorize`);
    return response.data;
  }

  /** Custodial deals: re-read the vault balance and flip to funded if it's there. */
  async checkEscrowFunding(
    id: string
  ): Promise<Escrow & { held: string; expected: string; funded: boolean }> {
    const response = await this.client.post(`/escrows/${id}/check-funding`);
    return response.data;
  }

  async releaseEscrow(id: string): Promise<Escrow & { txHash: string }> {
    const response = await this.client.post(`/escrows/${id}/release`);
    return response.data;
  }

  async cancelEscrow(id: string): Promise<Escrow> {
    const response = await this.client.post(`/escrows/${id}/cancel`);
    return response.data;
  }

  async disputeEscrow(id: string, reason?: string): Promise<Escrow> {
    const response = await this.client.post(`/escrows/${id}/dispute`, { reason });
    return response.data;
  }

  // Webhooks
  async getWebhooks(): Promise<any[]> {
    const response = await this.client.get('/webhooks');
    return response.data;
  }

  async createWebhook(url: string, events: string[]): Promise<any> {
    const response = await this.client.post('/webhooks', { url, events });
    return response.data;
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.client.delete(`/webhooks/${id}`);
  }

  async testWebhook(id: string): Promise<void> {
    await this.client.post(`/webhooks/${id}/test`);
  }
}

export const api = new ApiService();
