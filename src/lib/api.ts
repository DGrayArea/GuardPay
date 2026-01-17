import axios, { AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface PaymentLink {
  id: string;
  title: string;
  price: number;
  currency: 'USD' | 'EUR';
  crypto: 'ETH' | 'USDT' | 'SOL';
  walletAddress?: string;
  solanaAddress?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  invoiceId: string;
  txHash: string;
  amount: string;
  chain: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  confirmations: number;
  confirmedAt?: string;
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
  status: 'new' | 'pending' | 'confirming' | 'paid' | 'expired';
  paymentAddress: string;
  solanaAddress?: string;
  expectedAmount: string;
  expiresAt: string;
  createdAt: string;
  paidAt?: string;
  transactions?: Transaction[];
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
  totalVolume: number;
  totalTransactions: number;
  pendingInvoices: number;
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

    // Load token from localStorage
    this.token = localStorage.getItem('guardpay_token');
    if (this.token) {
      this.setAuthHeader(this.token);
    }

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

  // Payment Links
  async getLinks(): Promise<PaymentLink[]> {
    const response = await this.client.get('/links');
    return response.data;
  }

  async createLink(data: Omit<PaymentLink, 'id' | 'createdAt'>): Promise<PaymentLink> {
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

  async getInvoiceStatus(id: string): Promise<{ status: string; paidAt?: string; transactions: any[] }> {
    const response = await this.client.get(`/invoices/${id}/status`);
    return response.data;
  }

  async verifyInvoice(id: string): Promise<void> {
    await this.client.post(`/invoices/${id}/verify`);
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
