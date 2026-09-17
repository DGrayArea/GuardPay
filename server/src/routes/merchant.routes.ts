import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, queries } from '../config/database';
import { authenticateJWT, AuthRequest, generateAPIKey } from '../middleware/auth.middleware';

const router: Router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Get merchant profile
 */
router.get('/profile', (req: AuthRequest, res: Response) => {
  try {
    const merchant = queries.getMerchantById.get(req.merchantId!) as any;

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      id: merchant.id,
      walletAddress: merchant.wallet_address,
      merchantName: merchant.merchant_name,
      receivingAddress: merchant.receiving_address,
      solanaAddress: merchant.solana_address,
      defaultCurrency: merchant.default_currency,
      apiKey: merchant.api_key ? `${merchant.api_key.substring(0, 10)}...` : null, // Masked
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Update merchant settings
 */
router.put('/settings', (req: AuthRequest, res: Response) => {
  try {
    const { merchantName, receivingAddress, solanaAddress, defaultCurrency } = req.body;

    queries.updateMerchant.run(
      merchantName || 'Merchant',
      receivingAddress || '',
      solanaAddress || '',
      defaultCurrency || 'USD',
      req.merchantId!
    );

    const updatedMerchant = queries.getMerchantById.get(req.merchantId!) as any;

    res.json({
      merchantName: updatedMerchant.merchant_name,
      receivingAddress: updatedMerchant.receiving_address,
      solanaAddress: updatedMerchant.solana_address,
      defaultCurrency: updatedMerchant.default_currency,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Transaction history, shaped for the dashboard client.
 */
router.get('/transactions', (req: AuthRequest, res: Response) => {
  try {
    // Joined so the dashboard gets the fiat amount, product title and payer
    // address alongside the on-chain transaction.
    const rows = db
      .prepare(
        `SELECT t.*,
                i.amount        AS fiat_amount,
                i.currency      AS fiat_currency,
                i.crypto        AS crypto,
                i.link_id       AS link_id,
                l.title         AS link_title,
                (SELECT p.from_address FROM payments p
                  WHERE p.tx_hash = t.tx_hash LIMIT 1) AS payer
           FROM transactions t
           LEFT JOIN invoices i      ON t.invoice_id = i.id
           LEFT JOIN payment_links l ON i.link_id = l.id
          WHERE t.merchant_id = ?
          ORDER BY t.created_at DESC`
      )
      .all(req.merchantId!) as any[];

    res.json(
      rows.map((t) => ({
        id: t.id,
        invoiceId: t.invoice_id,
        linkId: t.link_id,
        linkTitle: t.link_title ?? 'Payment',
        txHash: t.tx_hash,
        amount: t.fiat_amount ?? 0,
        currency: t.fiat_currency ?? 'USD',
        cryptoAmount: t.amount,
        crypto: t.crypto,
        chain: t.chain,
        status: t.status,
        confirmations: t.confirmations,
        customer: t.payer ?? null,
        type: t.link_id ? 'link' : 'direct',
        confirmedAt: t.confirmed_at,
        timestamp: t.created_at,
        createdAt: t.created_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * Invoice history, shaped for the dashboard client.
 */
router.get('/invoices', (req: AuthRequest, res: Response) => {
  try {
    const rows = queries.getInvoicesByMerchant.all(req.merchantId!) as any[];

    res.json(
      rows.map((i) => ({
        id: i.id,
        linkId: i.link_id,
        amount: i.amount,
        currency: i.currency,
        crypto: i.crypto,
        chain: i.chain,
        status: i.status,
        paymentAddress: i.unique_address,
        solanaAddress: i.solana_address,
        expectedAmount: i.expected_amount,
        receivedAmount: i.received_amount ?? '0',
        expiresAt: i.expires_at,
        createdAt: i.created_at,
        paidAt: i.paid_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Generate new API key
 */
router.post('/api-key', (req: AuthRequest, res: Response) => {
  try {
    const newApiKey = generateAPIKey();

    queries.setMerchantApiKey.run(newApiKey, req.merchantId!);

    res.json({
      apiKey: newApiKey,
      message: 'New API key generated. Store it securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

/**
 * Get merchant statistics
 */
router.get('/stats', (req: AuthRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;

    // Volume comes from the invoice in fiat, not from transactions — a
    // transaction's `amount` is the on-chain crypto figure, and summing those
    // across different assets is meaningless. net_to_merchant is what the
    // merchant actually keeps after the platform fee.
    const { total_volume: totalVolume, gross_volume: grossVolume } = db
      .prepare(
        `SELECT COALESCE(SUM(COALESCE(net_to_merchant, amount)), 0) AS total_volume,
                COALESCE(SUM(amount), 0)                          AS gross_volume
           FROM invoices
          WHERE merchant_id = ? AND status = 'paid'`
      )
      .get(merchantId) as { total_volume: number; gross_volume: number };

    const { count: totalTransactions } = db
      .prepare('SELECT COUNT(*) as count FROM transactions WHERE merchant_id = ?')
      .get(merchantId) as { count: number };

    const { count: pendingInvoices } = db
      .prepare(
        `SELECT COUNT(*) as count FROM invoices
         WHERE merchant_id = ? AND status IN ('new', 'pending', 'confirming', 'underpaid')`
      )
      .get(merchantId) as { count: number };

    // Escrows are keyed by wallet address, since either party may be a
    // non-merchant user.
    const merchant = queries.getMerchantById.get(merchantId) as any;
    const { count: activeEscrows } = db
      .prepare(
        `SELECT COUNT(*) as count FROM escrows
         WHERE (buyer_address = ? OR seller_address = ?)
           AND status IN ('funded', 'active', 'disputed')`
      )
      .get(merchant?.wallet_address ?? '', merchant?.wallet_address ?? '') as { count: number };

    const recentTransactions = db
      .prepare(
        `SELECT t.*, i.link_id, i.amount as invoice_amount, i.currency as invoice_currency
         FROM transactions t
         JOIN invoices i ON t.invoice_id = i.id
         WHERE t.merchant_id = ?
         ORDER BY t.created_at DESC
         LIMIT 10`
      )
      .all(merchantId);

    const feesPaid = Math.round((grossVolume - totalVolume) * 100) / 100;

    res.json({
      totalVolume: Math.round(totalVolume * 100) / 100,
      grossVolume: Math.round(grossVolume * 100) / 100,
      feesPaid,
      totalTransactions,
      // Alias kept for the dashboard's shorter field name.
      totalTx: totalTransactions,
      pendingInvoices,
      activeEscrows,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
