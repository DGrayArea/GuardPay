import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase | null = null;
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../guardpay.db');

// Initialize SQL.js
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

// Save database to disk
export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Get database instance
export async function getDb(): Promise<SqlJsDatabase> {
  if (!db) {
    db = await initDatabase();
  }
  return db;
}

// Initialize database schema
export async function initializeDatabase() {
  const database = await getDb();

  // Merchants table
  database.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      api_key TEXT UNIQUE,
      merchant_name TEXT DEFAULT 'Merchant',
      receiving_address TEXT,
      solana_address TEXT,
      default_currency TEXT DEFAULT 'USD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Payment Links table
  database.run(`
    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      crypto TEXT NOT NULL,
      wallet_address TEXT,
      solana_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    )
  `);

  // Invoices table
  database.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      crypto TEXT NOT NULL,
      chain TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      unique_address TEXT NOT NULL,
      solana_address TEXT,
      expected_amount TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (link_id) REFERENCES payment_links(id) ON DELETE CASCADE,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    )
  `);

  // Transactions table
  database.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      tx_hash TEXT UNIQUE NOT NULL,
      amount TEXT NOT NULL,
      chain TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      confirmations INTEGER DEFAULT 0,
      confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    )
  `);

  // Webhooks table
  database.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  database.run(`CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_invoices_address ON invoices(unique_address)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON payment_links(merchant_id)`);

  saveDatabase();
  console.log('✅ Database initialized successfully');
}

// Helper query functions
export const queries = {
  // Merchants
  getMerchantByWallet: async (walletAddress: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM merchants WHERE wallet_address = ?', [walletAddress]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  getMerchantById: async (id: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM merchants WHERE id = ?', [id]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  getMerchantByApiKey: async (apiKey: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM merchants WHERE api_key = ?', [apiKey]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  createMerchant: async (id: string, walletAddress: string, apiKey: string, merchantName: string, receivingAddress: string, solanaAddress: string) => {
    const db = await getDb();
    db.run('INSERT INTO merchants (id, wallet_address, api_key, merchant_name, receiving_address, solana_address) VALUES (?, ?, ?, ?, ?, ?)',
      [id, walletAddress, apiKey, merchantName, receivingAddress, solanaAddress]);
    saveDatabase();
  },

  updateMerchant: async (merchantName: string, receivingAddress: string, solanaAddress: string, defaultCurrency: string, id: string) => {
    const db = await getDb();
    db.run('UPDATE merchants SET merchant_name = ?, receiving_address = ?, solana_address = ?, default_currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [merchantName, receivingAddress, solanaAddress, defaultCurrency, id]);
    saveDatabase();
  },

  // Payment Links
  getLinks: async (merchantId: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM payment_links WHERE merchant_id = ? ORDER BY created_at DESC', [merchantId]);
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  getLinkById: async (id: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM payment_links WHERE id = ?', [id]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  createLink: async (id: string, merchantId: string, title: string, price: number, currency: string, crypto: string, walletAddress: string | null, solanaAddress: string | null) => {
    const db = await getDb();
    db.run('INSERT INTO payment_links (id, merchant_id, title, price, currency, crypto, wallet_address, solana_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, merchantId, title, price, currency, crypto, walletAddress, solanaAddress]);
    saveDatabase();
  },

  deleteLink: async (id: string, merchantId: string) => {
    const db = await getDb();
    db.run('DELETE FROM payment_links WHERE id = ? AND merchant_id = ?', [id, merchantId]);
    saveDatabase();
  },

  // Invoices
  getInvoiceById: async (id: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM invoices WHERE id = ?', [id]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  getInvoicesByMerchant: async (merchantId: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM invoices WHERE merchant_id = ? ORDER BY created_at DESC', [merchantId]);
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  getInvoiceByAddress: async (address: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM invoices WHERE unique_address = ? OR solana_address = ?', [address, address]);
    return result[0]?.values[0] ? rowToObject(result[0].columns, result[0].values[0]) : null;
  },

  createInvoice: async (id: string, linkId: string, merchantId: string, amount: number, currency: string, crypto: string, chain: string, uniqueAddress: string, solanaAddress: string | null, expectedAmount: string, expiresAt: string) => {
    const db = await getDb();
    db.run('INSERT INTO invoices (id, link_id, merchant_id, amount, currency, crypto, chain, unique_address, solana_address, expected_amount, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, linkId, merchantId, amount, currency, crypto, chain, uniqueAddress, solanaAddress, expectedAmount, expiresAt]);
    saveDatabase();
  },

  updateInvoiceStatus: async (status: string, paidAt: string | null, id: string) => {
    const db = await getDb();
    db.run('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?', [status, paidAt, id]);
    saveDatabase();
  },

  getPendingInvoices: async () => {
    const db = await getDb();
    const result = db.exec("SELECT * FROM invoices WHERE status IN ('new', 'pending', 'confirming') AND expires_at > datetime('now')");
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  // Transactions
  getTransactionsByMerchant: async (merchantId: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC', [merchantId]);
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  getTransactionsByInvoice: async (invoiceId: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM transactions WHERE invoice_id = ?', [invoiceId]);
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  createTransaction: async (id: string, invoiceId: string, merchantId: string, txHash: string, amount: string, chain: string, status: string, confirmations: number) => {
    const db = await getDb();
    db.run('INSERT INTO transactions (id, invoice_id, merchant_id, tx_hash, amount, chain, status, confirmations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, invoiceId, merchantId, txHash, amount, chain, status, confirmations]);
    saveDatabase();
  },

  updateTransactionStatus: async (status: string, confirmations: number, confirmedAt: string | null, id: string) => {
    const db = await getDb();
    db.run('UPDATE transactions SET status = ?, confirmations = ?, confirmed_at = ? WHERE id = ?', [status, confirmations, confirmedAt, id]);
    saveDatabase();
  },

  // Webhooks
  getWebhooksByMerchant: async (merchantId: string) => {
    const db = await getDb();
    const result = db.exec('SELECT * FROM webhooks WHERE merchant_id = ? AND enabled = 1', [merchantId]);
    return result[0] ? result[0].values.map(row => rowToObject(result[0].columns, row)) : [];
  },

  createWebhook: async (id: string, merchantId: string, url: string, events: string, secret: string) => {
    const db = await getDb();
    db.run('INSERT INTO webhooks (id, merchant_id, url, events, secret) VALUES (?, ?, ?, ?, ?)',
      [id, merchantId, url, events, secret]);
    saveDatabase();
  },

  deleteWebhook: async (id: string, merchantId: string) => {
    const db = await getDb();
    db.run('DELETE FROM webhooks WHERE id = ? AND merchant_id = ?', [id, merchantId]);
    saveDatabase();
  },
};

// Helper function to convert row array to object
function rowToObject(columns: string[], values: any[]): any {
  const obj: any = {};
  columns.forEach((col, index) => {
    obj[col] = values[index];
  });
  return obj;
}

// Export db for direct queries
export { db };
