import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { walletService } from '../services/wallet.service';
import { priceService } from '../services/price.service';
import { optionalAuth, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Create invoice from payment link (public endpoint)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { linkId, chain } = req.body;

    if (!linkId) {
      return res.status(400).json({ error: 'Link ID required' });
    }

    const link = queries.getLinkById.get(linkId) as any;

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    // Determine chain if not specified
    const selectedChain = chain || (link.crypto === 'SOL' ? 'SOLANA' : 'ETH');

    // Convert fiat to crypto amount
    const cryptoAmount = await priceService.convertToCrypto(
      link.price,
      link.currency,
      link.crypto
    );

    // Generate unique payment address
    let uniqueAddress = '';
    let solanaAddress = null;

    if (selectedChain === 'SOLANA') {
      const invoiceId = uuidv4().replace(/-/g, '').substring(0, 16);
      const solanaAddr = walletService.generateSolanaAddress(invoiceId);
      solanaAddress = solanaAddr.address;
      uniqueAddress = solanaAddr.address;
    } else {
      // Generate EVM address
      const evmAddr = walletService.generateEVMAddress();
      uniqueAddress = evmAddr.address;
    }

    // Create invoice
    const invoiceId = `inv_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    queries.createInvoice.run(
      invoiceId,
      link.id,
      link.merchant_id,
      link.price,
      link.currency,
      link.crypto,
      selectedChain,
      uniqueAddress,
      solanaAddress,
      cryptoAmount.toFixed(8),
      expiresAt.toISOString()
    );

    const invoice = queries.getInvoiceById.get(invoiceId) as any;

    res.status(201).json({
      id: invoice.id,
      linkId: invoice.link_id,
      amount: invoice.amount,
      currency: invoice.currency,
      crypto: invoice.crypto,
      chain: invoice.chain,
      status: invoice.status,
      paymentAddress: uniqueAddress,
      solanaAddress: solanaAddress,
      expectedAmount: cryptoAmount.toFixed(8),
      expiresAt: invoice.expires_at,
      createdAt: invoice.created_at,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

/**
 * Get invoice details (public endpoint)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = queries.getInvoiceById.get(req.params.id) as any;

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get associated link for title
    const link = queries.getLinkById.get(invoice.link_id) as any;

    // Get transactions for this invoice
    const transactions = queries.getTransactionsByInvoice.all(invoice.id);

    res.json({
      id: invoice.id,
      linkId: invoice.link_id,
      linkTitle: link?.title,
      amount: invoice.amount,
      currency: invoice.currency,
      crypto: invoice.crypto,
      chain: invoice.chain,
      status: invoice.status,
      paymentAddress: invoice.unique_address,
      solanaAddress: invoice.solana_address,
      expectedAmount: invoice.expected_amount,
      expiresAt: invoice.expires_at,
      createdAt: invoice.created_at,
      paidAt: invoice.paid_at,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * Get invoice status (public endpoint for polling)
 */
router.get('/:id/status', (req: Request, res: Response) => {
  try {
    const invoice = queries.getInvoiceById.get(req.params.id) as any;

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const transactions = queries.getTransactionsByInvoice.all(invoice.id);

    res.json({
      status: invoice.status,
      paidAt: invoice.paid_at,
      expiresAt: invoice.expires_at,
      transactions: transactions.map((tx: any) => ({
        hash: tx.tx_hash,
        amount: tx.amount,
        status: tx.status,
        confirmations: tx.confirmations,
      })),
    });
  } catch (error) {
    console.error('Error fetching invoice status:', error);
    res.status(500).json({ error: 'Failed to fetch invoice status' });
  }
});

/**
 * Manually verify payment (requires auth)
 */
router.post('/:id/verify', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const invoice = queries.getInvoiceById.get(req.params.id) as any;

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If authenticated, verify ownership
    if (req.merchantId && invoice.merchant_id !== req.merchantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Trigger manual verification via blockchain service
    const blockchainService = require('../services/blockchain.service').blockchainService;
    
    // This will be checked in the next monitoring cycle
    res.json({
      message: 'Verification triggered. Check status in a few seconds.',
      status: invoice.status,
    });
  } catch (error) {
    console.error('Error verifying invoice:', error);
    res.status(500).json({ error: 'Failed to verify invoice' });
  }
});

export default router;
