import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { getAsset, defaultChainFor, listAssets } from '../config/assets';

const router: Router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Assets this deployment can actually settle. The merchant UI builds its
 * picker from this rather than hardcoding a list that can drift.
 */
router.get('/assets', (_req: AuthRequest, res: Response) => {
  res.json(listAssets());
});

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
    if (!(Number(price) > 0)) {
      return res.status(400).json({ error: 'Price must be greater than zero' });
    }

    // Settle on the requested chain, or the asset's natural home.
    const chain = (req.body.chain || defaultChainFor(crypto)).toUpperCase();
    const asset = getAsset(chain, crypto);

    if (!asset) {
      return res.status(400).json({
        error: `${crypto} is not settleable on ${chain}`,
        supported: listAssets(),
      });
    }

    const linkId = `pl_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    queries.createLink.run(
      linkId,
      req.merchantId!,
      title,
      price,
      currency,
      asset.symbol,
      walletAddress || null,
      solanaAddress || null,
      chain,
      asset.address,
      asset.decimals
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

    // Changing the asset must re-resolve the token address and decimals too,
    // or the link would quote one asset and watch for another.
    const nextSymbol = crypto || link.crypto;
    const nextChain = (req.body.chain || link.chain || defaultChainFor(nextSymbol)).toUpperCase();
    const asset = getAsset(nextChain, nextSymbol);

    if (!asset) {
      return res.status(400).json({ error: `${nextSymbol} is not settleable on ${nextChain}` });
    }

    queries.updateLink.run(
      title || link.title,
      price !== undefined ? price : link.price,
      currency || link.currency,
      asset.symbol,
      walletAddress !== undefined ? walletAddress : link.wallet_address,
      solanaAddress !== undefined ? solanaAddress : link.solana_address,
      nextChain,
      asset.address,
      asset.decimals,
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
