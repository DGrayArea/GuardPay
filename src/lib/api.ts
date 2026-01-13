
 

export interface PaymentLink {
  id: string;
  title: string;
  price: number;
  currency: 'USD' | 'EUR';
  crypto: 'ETH' | 'USDT';
  walletAddress?: string; 
  solanaAddress?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  linkId: string;
  linkTitle?: string;
  amount: number;
  currency: string;
  cryptoAmount: number;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  customer?: string;
  timestamp: string;
  type: 'direct' | 'escrow';
  chain: 'ETH' | 'BSC' | 'POLYGON' | 'BASE' | 'SOLANA';
  invoiceId?: string;
}

export interface Invoice {
  id: string;
  linkId: string;
  amount: number;
  currency: string;
  status: 'new' | 'pending' | 'confirming' | 'paid' | 'expired';
  expiresAt: string; // ISO Date
  createdAt: string;
  walletAddress?: string;
  solanaAddress?: string;
  linkTitle?: string;
}

export interface Settings {
  merchantName: string;
  receivingAddress: string;
  solanaAddress: string;
  defaultCurrency: 'USD' | 'EUR';
}

const STORAGE_KEYS = {
    SETTINGS: 'guardpay_settings',
    LINKS: 'guardpay_links',
    TXS: 'guardpay_transactions',
    INVOICES: 'guardpay_invoices'
};

class ApiService {
  private settings: Settings = {
    merchantName: 'Premium Merchant',
    receivingAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    solanaAddress: 'AnayTw3f5Jv6X6U9xF6R9m8jC3zD3r5yH7k9d4f1j2h3',
    defaultCurrency: 'USD'
  };

  private links: PaymentLink[] = [];
  private transactions: Transaction[] = [];
  private invoices: Invoice[] = [];

  constructor() {
      this.loadFromStorage();
  }

  private loadFromStorage() {
      try {
          const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
          if (s) this.settings = JSON.parse(s);

          const l = localStorage.getItem(STORAGE_KEYS.LINKS);
          if (l) this.links = JSON.parse(l);
          else this.links = [{
            id: 'pl_1',
            title: 'Demo Subscription',
            price: 49.99,
            currency: 'USD',
            crypto: 'ETH',
            createdAt: new Date().toISOString(),
          }];

          const t = localStorage.getItem(STORAGE_KEYS.TXS);
          if (t) this.transactions = JSON.parse(t);
          
          const i = localStorage.getItem(STORAGE_KEYS.INVOICES);
          if (i) this.invoices = JSON.parse(i);

      } catch (e) {
          console.error("Failed to load storage", e);
      }
  }

  private saveToStorage() {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(this.links));
      localStorage.setItem(STORAGE_KEYS.TXS, JSON.stringify(this.transactions));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage();
    return this.settings;
  }

  // Links
  async getLinks(): Promise<PaymentLink[]> {
    return [...this.links];
  }

  async createLink(data: Omit<PaymentLink, 'id' | 'createdAt'>): Promise<PaymentLink> {
    const newLink = { 
      ...data, 
      id: `pl_${Math.random().toString(36).substr(2, 9)}`, 
      createdAt: new Date().toISOString() 
    };
    this.links.push(newLink);
    this.saveToStorage();
    return newLink;
  }

  async getLink(id: string): Promise<PaymentLink | undefined> {
    return this.links.find(l => l.id === id);
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return [...this.transactions];
  }

  async createTransaction(data: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    const newTx = { 
      ...data, 
      id: `tx_${Math.random().toString(36).substr(2, 9)}`, 
      timestamp: new Date().toISOString() 
    };
    this.transactions.unshift(newTx);
    this.saveToStorage();
    return newTx;
  }

  // Invoices
  async createInvoice(linkId: string): Promise<Invoice> {
    const link = this.links.find(l => l.id === linkId);
    if (!link) throw new Error("Link not found");

    const invoice: Invoice = {
        id: Math.random().toString(36).substr(2, 9),
        linkId: link.id,
        linkTitle: link.title,
        amount: link.price,
        currency: link.currency,
        status: 'new',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        walletAddress: link.walletAddress || this.settings.receivingAddress,
        solanaAddress: link.solanaAddress || this.settings.solanaAddress
    };

    this.invoices.push(invoice);
    this.saveToStorage();
    return invoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.find(i => i.id === id);
  }

  async updateInvoiceStatus(id: string, status: Invoice['status']) {
      const inv = this.invoices.find(i => i.id === id);
      if (inv) {
          inv.status = status;
          this.saveToStorage();
      }
  }
  
  // Stats
  async getStats() {
    const totalVolume = this.transactions
      .filter(t => t.status === 'completed')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const activeEscrows = this.transactions.filter(t => t.status === 'pending' && t.type === 'escrow').length;
    
    return {
      totalVolume,
      totalTx: this.transactions.length,
      activeEscrows
    };
  }
}

export const api = new ApiService();
