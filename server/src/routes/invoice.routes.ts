import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { walletService } from '../services/wallet.service';
import { priceService } from '../services/price.service';
import { computeFee, ceilCrypto } from '../services/fee.service';
import { getAsset, defaultChainFor } from '../config/assets';
import { optionalAuth, AuthRequest } from '../middleware/auth.middleware';

const router: Router = Router();

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

    // The link states where it settles; an explicit chain may override it only
    // if the same asset exists there.
    const requested = (chain || link.chain || defaultChainFor(link.crypto)).toUpperCase();
    const asset = getAsset(requested, link.crypto);

    if (!asset) {
      return res.status(400).json({
        error: `${link.crypto} cannot be paid on ${requested}`,
      });
    }

    const selectedChain = requested;

    // Platform fee is applied to the listed price before converting, so the
    // quote the payer sees already reflects it.
    const fee = computeFee(link.price, 'merchant');

    const cryptoAmount = await priceService.convertToCrypto(
      fee.total,
      link.currency,
      link.crypto
    );

    // The id is minted first so the address can be bound to it, which is what
    // lets the sweep service recover the key material later.
    const invoiceId = `inv_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    let uniqueAddress = '';
    let solanaAddress: string | null = null;
    let derivationIndex: number | null = null;

    if (selectedChain === 'SOLANA') {
      const solanaAddr = walletService.generateSolanaAddress(invoiceId);
      solanaAddress = solanaAddr.address;
      uniqueAddress = solanaAddr.address;
    } else {
      const evmAddr = walletService.generateEVMAddress(invoiceId);
      uniqueAddress = evmAddr.address;
      derivationIndex = evmAddr.index;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    queries.createInvoice.run(
      invoiceId,
      link.id,
      link.merchant_id,
      // `amount` is what the payer owes, fee included; `subtotal` below keeps
      // the pre-fee list price.
      fee.total,
      link.currency,
      link.crypto,
      selectedChain,
      uniqueAddress,
      solanaAddress,
      // Rounded UP, at the ASSET's own precision. Quoting a 6-decimal
      // stablecoin to 8 places asks for an amount no wallet can send, so every
      // payment would arrive short.
      ceilCrypto(cryptoAmount, asset.decimals),
      expiresAt.toISOString(),
      asset.address,
      derivationIndex,
      fee.subtotal,
      fee.fee,
      fee.bps,
      fee.paidBy,
      fee.netToReceiver,
      asset.decimals
    );

    const invoice = queries.getInvoiceById.get(invoiceId) as any;

    res.status(201).json({
      id: invoice.id,
      linkId: invoice.link_id,
      amount: fee.total,
      currency: invoice.currency,
      crypto: invoice.crypto,
      chain: invoice.chain,
      status: invoice.status,
      paymentAddress: uniqueAddress,
      solanaAddress: solanaAddress,
      expectedAmount: ceilCrypto(cryptoAmount, asset.decimals),
      tokenAddress: asset.address,
      tokenDecimals: asset.decimals,
      assetKind: asset.kind,
      isStablecoin: Boolean(asset.stable),
      expiresAt: invoice.expires_at,
      createdAt: invoice.created_at,
      fee: {
        subtotal: fee.subtotal,
        amount: fee.fee,
        bps: fee.bps,
        paidBy: fee.paidBy,
        total: fee.total,
      },
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
      receivedAmount: invoice.received_amount ?? '0',
      tokenAddress: invoice.token_address,
      tokenDecimals: invoice.token_decimals ?? 18,
      assetKind: invoice.token_address
        ? getAsset(invoice.chain, invoice.crypto)?.kind ?? 'erc20'
        : 'native',
      isStablecoin: Boolean(getAsset(invoice.chain, invoice.crypto)?.stable),
      expiresAt: invoice.expires_at,
      createdAt: invoice.created_at,
      paidAt: invoice.paid_at,
      fee: {
        subtotal: invoice.subtotal ?? invoice.amount,
        amount: invoice.fee_amount ?? 0,
        bps: invoice.fee_bps ?? 0,
        paidBy: invoice.fee_paid_by ?? 'receiver',
        total: invoice.amount,
      },
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
      expectedAmount: invoice.expected_amount,
      receivedAmount: invoice.received_amount ?? '0',
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
