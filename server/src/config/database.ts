import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../guardpay.db');

export const db: Database.Database = new Database(dbPath);

// WAL keeps readers from blocking the payment monitor while it writes.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Lazily-prepared statement. Preserves the `queries.x.get()/all()/run()` call
 * style used across the routes while deferring preparation until after
 * initializeDatabase() has created the tables.
 */
function stmt(sql: string) {
  let prepared: Database.Statement | null = null;
  const get = () => (prepared ??= db.prepare(sql));
  return {
    get: (...args: any[]) => get().get(...args),
    all: (...args: any[]) => get().all(...args),
    run: (...args: any[]) => get().run(...args),
  };
}

/** Add a column only if it isn't already there (idempotent migration). */
function addColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeDatabase() {
  db.exec(`
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
    );

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
    );

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
    );

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
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_address ON invoices(unique_address);
    CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON payment_links(merchant_id);
  `);

  // --- Payment address key material -----------------------------------------
  // Previously held in memory, which lost Solana private keys on restart and
  // reset the EVM derivation index to 0 (address reuse across invoices).
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_keys (
      address TEXT PRIMARY KEY,
      invoice_id TEXT,
      chain TEXT NOT NULL,
      derivation_index INTEGER,
      secret_key TEXT,
      swept_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_keys_invoice ON wallet_keys(invoice_id);
  `);

  // --- Under/overpayment tracking -------------------------------------------
  // One row per on-chain receipt against an invoice, so partial payments
  // accumulate instead of being compared against a single balance snapshot.
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      log_index INTEGER DEFAULT 0,
      from_address TEXT,
      amount TEXT NOT NULL,
      token TEXT,
      block_number INTEGER,
      confirmations INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tx_hash, log_index),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
  `);

  // A link now carries the settlement asset, not just a ticker string.
  addColumn('payment_links', 'chain', 'TEXT');
  addColumn('payment_links', 'token_address', 'TEXT');
  addColumn('payment_links', 'token_decimals', 'INTEGER');

  addColumn('invoices', 'received_amount', "TEXT DEFAULT '0'");
  addColumn('invoices', 'token_decimals', 'INTEGER');
  // Fee accounting, recorded at quote time so a later rate change never
  // retroactively alters what an existing invoice charged.
  addColumn('invoices', 'subtotal', 'REAL');
  addColumn('invoices', 'fee_amount', 'REAL DEFAULT 0');
  addColumn('invoices', 'fee_bps', 'INTEGER DEFAULT 0');
  addColumn('invoices', 'fee_paid_by', "TEXT DEFAULT 'receiver'");
  addColumn('invoices', 'net_to_merchant', 'REAL');
  addColumn('invoices', 'token_address', 'TEXT');
  addColumn('invoices', 'derivation_index', 'INTEGER');
  addColumn('invoices', 'last_scanned_block', 'INTEGER');

  // --- Settlement (auto-sweep to merchant) ----------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS sweeps (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      chain TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      token TEXT,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sweeps_status ON sweeps(status);
    CREATE INDEX IF NOT EXISTS idx_sweeps_invoice ON sweeps(invoice_id);
  `);

  // A sweep is either the merchant's settlement or the platform's fee cut.
  addColumn('sweeps', 'kind', "TEXT DEFAULT 'settlement'");
  db.exec('CREATE INDEX IF NOT EXISTS idx_sweeps_kind ON sweeps(kind)');

  // --- Webhook delivery log (signing + retries) -----------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      response_status INTEGER,
      response_body TEXT,
      next_attempt_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
  `);

  // --- x402: per-request API payments ---------------------------------------
  // A ledger of authorizations this facilitator has verified or settled. The
  // `payment_id` unique index is the replay guard: the token contract would
  // also reject a reused EIP-3009 nonce, but only after a broadcast has cost
  // gas, so duplicates are refused here before submission.
  db.exec(`
    CREATE TABLE IF NOT EXISTS x402_payments (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      payment_id TEXT UNIQUE,
      scheme TEXT NOT NULL,
      network TEXT NOT NULL,
      payer TEXT,
      pay_to TEXT,
      asset TEXT,
      amount TEXT,
      resource TEXT,
      status TEXT NOT NULL DEFAULT 'verified',
      tx_hash TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      settled_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_x402_merchant ON x402_payments(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_x402_status ON x402_payments(status);
  `);

  // --- Two-sided marketplace: buyer/seller identities ------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
  `);

  // --- Escrow ----------------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS escrows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      conditions TEXT,
      buyer_address TEXT NOT NULL,
      seller_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      chain TEXT NOT NULL,
      token_address TEXT,
      custody TEXT NOT NULL DEFAULT 'contract',
      contract_address TEXT,
      onchain_id TEXT,
      deposit_address TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      funded_tx_hash TEXT,
      release_tx_hash TEXT,
      refund_tx_hash TEXT,
      deadline_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS escrow_events (
      id TEXT PRIMARY KEY,
      escrow_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor TEXT,
      note TEXT,
      tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (escrow_id) REFERENCES escrows(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_escrows_buyer ON escrows(buyer_address);
    CREATE INDEX IF NOT EXISTS idx_escrows_seller ON escrows(seller_address);
    CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);
    CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow ON escrow_events(escrow_id);
  `);

  console.log('✅ Database initialized successfully');
}

/**
 * Retained for source compatibility with the previous sql.js layer. Writes go
 * straight to disk now, so there is nothing to flush.
 */
export function saveDatabase() {}

export const queries = {
  // Merchants
  getMerchantByWallet: stmt('SELECT * FROM merchants WHERE wallet_address = ?'),
  getMerchantById: stmt('SELECT * FROM merchants WHERE id = ?'),
  getMerchantByApiKey: stmt('SELECT * FROM merchants WHERE api_key = ?'),
  createMerchant: stmt(
    'INSERT INTO merchants (id, wallet_address, api_key, merchant_name, receiving_address, solana_address) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  updateMerchant: stmt(
    'UPDATE merchants SET merchant_name = ?, receiving_address = ?, solana_address = ?, default_currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  setMerchantApiKey: stmt('UPDATE merchants SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),

  // Payment Links
  getLinks: stmt('SELECT * FROM payment_links WHERE merchant_id = ? ORDER BY created_at DESC'),
  getLinkById: stmt('SELECT * FROM payment_links WHERE id = ?'),
  createLink: stmt(
    'INSERT INTO payment_links (id, merchant_id, title, price, currency, crypto, wallet_address, solana_address, chain, token_address, token_decimals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateLink: stmt(
    'UPDATE payment_links SET title = ?, price = ?, currency = ?, crypto = ?, wallet_address = ?, solana_address = ?, chain = ?, token_address = ?, token_decimals = ? WHERE id = ?'
  ),
  deleteLink: stmt('DELETE FROM payment_links WHERE id = ? AND merchant_id = ?'),

  // Invoices
  getInvoiceById: stmt('SELECT * FROM invoices WHERE id = ?'),
  getInvoicesByMerchant: stmt('SELECT * FROM invoices WHERE merchant_id = ? ORDER BY created_at DESC'),
  getInvoiceByAddress: stmt('SELECT * FROM invoices WHERE unique_address = ? OR solana_address = ?'),
  createInvoice: stmt(
    'INSERT INTO invoices (id, link_id, merchant_id, amount, currency, crypto, chain, unique_address, solana_address, expected_amount, expires_at, token_address, derivation_index, subtotal, fee_amount, fee_bps, fee_paid_by, net_to_merchant, token_decimals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateInvoiceStatus: stmt('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?'),
  updateInvoiceReceived: stmt('UPDATE invoices SET received_amount = ? WHERE id = ?'),
  updateInvoiceScannedBlock: stmt('UPDATE invoices SET last_scanned_block = ? WHERE id = ?'),
  getPendingInvoices: stmt(
    "SELECT * FROM invoices WHERE status IN ('new', 'pending', 'confirming', 'underpaid')"
  ),

  // Payments (individual receipts against an invoice)
  getPaymentsByInvoice: stmt('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at ASC'),
  createPayment: stmt(
    'INSERT OR IGNORE INTO payments (id, invoice_id, tx_hash, log_index, from_address, amount, token, block_number, confirmations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updatePaymentConfirmations: stmt('UPDATE payments SET confirmations = ? WHERE id = ?'),

  // Transactions
  getTransactionsByMerchant: stmt('SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC'),
  getTransactionsByInvoice: stmt('SELECT * FROM transactions WHERE invoice_id = ?'),
  createTransaction: stmt(
    'INSERT OR IGNORE INTO transactions (id, invoice_id, merchant_id, tx_hash, amount, chain, status, confirmations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  updateTransactionStatus: stmt(
    'UPDATE transactions SET status = ?, confirmations = ?, confirmed_at = ? WHERE id = ?'
  ),

  // Webhooks
  getWebhooksByMerchant: stmt('SELECT * FROM webhooks WHERE merchant_id = ? AND enabled = 1'),
  getWebhookById: stmt('SELECT * FROM webhooks WHERE id = ? AND merchant_id = ?'),
  createWebhook: stmt('INSERT INTO webhooks (id, merchant_id, url, events, secret) VALUES (?, ?, ?, ?, ?)'),
  deleteWebhook: stmt('DELETE FROM webhooks WHERE id = ? AND merchant_id = ?'),

  // Webhook deliveries
  createDelivery: stmt(
    'INSERT INTO webhook_deliveries (id, webhook_id, merchant_id, event, payload, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  getDueDeliveries: stmt(
    "SELECT * FROM webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= datetime('now') ORDER BY next_attempt_at ASC LIMIT 25"
  ),
  getDeliveriesByWebhook: stmt(
    'SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50'
  ),
  updateDeliveryAttempt: stmt(
    'UPDATE webhook_deliveries SET status = ?, attempts = ?, response_status = ?, response_body = ?, next_attempt_at = ?, delivered_at = ? WHERE id = ?'
  ),

  // Wallet key material
  createWalletKey: stmt(
    'INSERT OR REPLACE INTO wallet_keys (address, invoice_id, chain, derivation_index, secret_key) VALUES (?, ?, ?, ?, ?)'
  ),
  getWalletKeyByAddress: stmt('SELECT * FROM wallet_keys WHERE address = ?'),
  markWalletKeySwept: stmt("UPDATE wallet_keys SET swept_at = datetime('now') WHERE address = ?"),

  // Counters
  getCounter: stmt('SELECT value FROM counters WHERE name = ?'),
  bumpCounter: stmt(
    'INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1'
  ),

  // Sweeps
  createSweep: stmt(
    'INSERT INTO sweeps (id, invoice_id, merchant_id, chain, from_address, to_address, amount, token, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  // kind ASC puts 'fee' before 'settlement', so the exact fee leaves first and
  // the settlement leg can safely drain whatever remains.
  getPendingSweeps: stmt(
    "SELECT * FROM sweeps WHERE status = 'pending' AND attempts < 5 ORDER BY invoice_id, kind ASC LIMIT 25"
  ),
  hasPendingFeeSweep: stmt(
    "SELECT COUNT(*) AS n FROM sweeps WHERE invoice_id = ? AND kind = 'fee' AND status = 'pending'"
  ),
  getSweepsByMerchant: stmt(
    "SELECT * FROM sweeps WHERE merchant_id = ? AND kind = 'settlement' ORDER BY created_at DESC"
  ),
  getFeeRevenue: stmt(
    "SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS total, COUNT(*) AS count FROM sweeps WHERE kind = 'fee' AND status = 'completed'"
  ),
  updateSweep: stmt(
    'UPDATE sweeps SET status = ?, tx_hash = ?, error = ?, attempts = ?, completed_at = ? WHERE id = ?'
  ),

  // x402
  recordX402: stmt(
    `INSERT OR IGNORE INTO x402_payments
       (id, merchant_id, payment_id, scheme, network, payer, pay_to, asset, amount, resource, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  getX402ByPaymentId: stmt('SELECT * FROM x402_payments WHERE payment_id = ?'),
  settleX402: stmt(
    "UPDATE x402_payments SET status = ?, tx_hash = ?, error = ?, settled_at = datetime('now') WHERE id = ?"
  ),
  getX402ByMerchant: stmt(
    'SELECT * FROM x402_payments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200'
  ),
  getX402Stats: stmt(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) AS settled,
            COALESCE(SUM(CASE WHEN status = 'settled' THEN CAST(amount AS REAL) ELSE 0 END), 0) AS volume
       FROM x402_payments WHERE merchant_id = ?`
  ),

  // Users (marketplace side)
  getUserByWallet: stmt('SELECT * FROM users WHERE wallet_address = ? COLLATE NOCASE'),
  getUserById: stmt('SELECT * FROM users WHERE id = ?'),
  createUser: stmt('INSERT INTO users (id, wallet_address, display_name) VALUES (?, ?, ?)'),
  updateUser: stmt(
    'UPDATE users SET display_name = ?, email = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),

  /**
   * Everything this wallet has paid for.
   *
   * Keyed on payments.from_address — the payer recorded by the chain scanner —
   * which is what makes a buyer-side history possible at all without asking
   * people to register before checking out.
   */
  getPaymentsByPayer: stmt(
    `SELECT i.id            AS invoice_id,
            i.amount, i.currency, i.crypto, i.chain, i.status,
            i.expected_amount, i.received_amount, i.paid_at, i.created_at,
            i.unique_address, i.solana_address,
            l.title         AS item_title,
            m.merchant_name AS merchant_name,
            m.wallet_address AS merchant_wallet,
            p.tx_hash, p.amount AS paid_amount, p.from_address
       FROM payments p
       JOIN invoices i        ON p.invoice_id = i.id
       LEFT JOIN payment_links l ON i.link_id = l.id
       LEFT JOIN merchants m     ON i.merchant_id = m.id
      WHERE p.from_address = ? COLLATE NOCASE
      ORDER BY p.created_at DESC`
  ),

  /** Totals for the buyer overview tiles. */
  getPayerStats: stmt(
    `SELECT COUNT(DISTINCT p.invoice_id)                     AS payments,
            COALESCE(SUM(DISTINCT i.amount), 0)              AS total_spent,
            COUNT(DISTINCT i.merchant_id)                    AS merchants
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
      WHERE p.from_address = ? COLLATE NOCASE
        AND i.status = 'paid'`
  ),

  /** Public directory: profiles for a set of counterparty addresses. */
  getUsersByWallets: stmt(
    'SELECT wallet_address, display_name, avatar_url FROM users WHERE wallet_address IN (SELECT value FROM json_each(?))'
  ),

  // Escrows
  createEscrow: stmt(
    'INSERT INTO escrows (id, title, description, conditions, buyer_address, seller_address, amount, currency, chain, token_address, custody, contract_address, deposit_address, status, deadline_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  getEscrowById: stmt('SELECT * FROM escrows WHERE id = ?'),
  getEscrowsByParty: stmt(
    'SELECT * FROM escrows WHERE buyer_address = ? OR seller_address = ? ORDER BY created_at DESC'
  ),
  updateEscrowStatus: stmt(
    'UPDATE escrows SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  updateEscrowOnchain: stmt(
    'UPDATE escrows SET onchain_id = ?, funded_tx_hash = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  setEscrowReleaseTx: stmt(
    'UPDATE escrows SET release_tx_hash = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  setEscrowRefundTx: stmt(
    'UPDATE escrows SET refund_tx_hash = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),

  // Escrow events
  createEscrowEvent: stmt(
    'INSERT INTO escrow_events (id, escrow_id, type, actor, note, tx_hash) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  getEscrowEvents: stmt('SELECT * FROM escrow_events WHERE escrow_id = ? ORDER BY created_at ASC'),
};
