import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { authenticateJWT, AuthRequest, generateAPIKey } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Get merchant profile
 */
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const merchant = await queries.getMerchantById(req.merchantId!) as any;
    
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
router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { merchantName, receivingAddress, solanaAddress, defaultCurrency } = req.body;

    await queries.updateMerchant(
      merchantName || 'Merchant',
      receivingAddress || '',
      solanaAddress || '',
      defaultCurrency || 'USD',
      req.merchantId!
    );

    const updatedMerchant = await queries.getMerchantById(req.merchantId!) as any;

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
 * Generate new API key
 */
router.post('/api-key', async (req: AuthRequest, res: Response) => {
  try {
    const newApiKey = generateAPIKey();
    
    const merchant = await queries.getMerchantById(req.merchantId!) as any;
    
    // Update API key
    const { getDb, saveDatabase } = require('../config/database');
    const db = await getDb();
    db.run('UPDATE merchants SET api_key = ? WHERE id = ?', [newApiKey, req.merchantId]);
    saveDatabase();

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
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const { getDb } = require('../config/database');
    const db = await getDb();

    // Get total volume
    const volumeResult = db.exec(`
      SELECT SUM(CAST(amount AS REAL)) as total_volume
      FROM transactions
      WHERE merchant_id = ? AND status = 'completed'
    `, [req.merchantId!]);
    const totalVolume = volumeResult[0]?.values[0]?.[0] || 0;

    // Get total transactions
    const txCountResult = db.exec(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE merchant_id = ?
    `, [req.merchantId!]);
    const totalTransactions = txCountResult[0]?.values[0]?.[0] || 0;

    // Get pending invoices
    const pendingResult = db.exec(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE merchant_id = ? AND status IN ('new', 'pending', 'confirming')
    `, [req.merchantId!]);
    const pendingInvoices = pendingResult[0]?.values[0]?.[0] || 0;

    // Get recent transactions
    const recentTxsResult = db.exec(`
      SELECT t.*, i.link_id, i.amount as invoice_amount
      FROM transactions t
      JOIN invoices i ON t.invoice_id = i.id
      WHERE t.merchant_id = ?
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [req.merchantId!]);

    const recentTransactions = recentTxsResult[0] ? 
      recentTxsResult[0].values.map(row => {
        const obj: any = {};
        recentTxsResult[0].columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      }) : [];

    res.json({
      totalVolume,
      totalTransactions,
      pendingInvoices,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
