import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Get all payment links for merchant
 */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const links = queries.getLinks.all(req.merchantId!);
    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch payment links' });
  }
});

/**
 * Create new payment link
 */
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { title, price, currency, crypto, walletAddress, solanaAddress } = req.body;

    if (!title || !price || !currency || !crypto) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const linkId = `pl_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    queries.createLink.run(
      linkId,
      req.merchantId!,
      title,
      price,
      currency,
      crypto,
      walletAddress || null,
      solanaAddress || null
    );

    const newLink = queries.getLinkById.get(linkId);
    res.status(201).json(newLink);
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

/**
 * Get specific payment link
 */
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const link = queries.getLinkById.get(req.params.id) as any;

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    // Verify ownership
    if (link.merchant_id !== req.merchantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(link);
  } catch (error) {
    console.error('Error fetching link:', error);
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

/**
 * Update payment link
 */
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const link = queries.getLinkById.get(req.params.id) as any;

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    if (link.merchant_id !== req.merchantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, price, currency, crypto, walletAddress, solanaAddress } = req.body;

    const db = require('../config/database').db;
    db.prepare(`
      UPDATE payment_links
      SET title = ?, price = ?, currency = ?, crypto = ?, wallet_address = ?, solana_address = ?
      WHERE id = ?
    `).run(
      title || link.title,
      price !== undefined ? price : link.price,
      currency || link.currency,
      crypto || link.crypto,
      walletAddress !== undefined ? walletAddress : link.wallet_address,
      solanaAddress !== undefined ? solanaAddress : link.solana_address,
      req.params.id
    );

    const updatedLink = queries.getLinkById.get(req.params.id);
    res.json(updatedLink);
  } catch (error) {
    console.error('Error updating link:', error);
    res.status(500).json({ error: 'Failed to update payment link' });
  }
});

/**
 * Delete payment link
 */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const link = queries.getLinkById.get(req.params.id) as any;

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    if (link.merchant_id !== req.merchantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    queries.deleteLink.run(req.params.id, req.merchantId!);
    res.json({ message: 'Payment link deleted successfully' });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ error: 'Failed to delete payment link' });
  }
});

export default router;
