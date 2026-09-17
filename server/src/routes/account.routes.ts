import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, queries } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { CHAIN_ASSETS } from '../config/assets';

const router: Router = Router();

/** Explorer link for a receipt, per chain. */
function explorerTx(chain: string, hash: string): string | null {
  if (!hash || hash.startsWith('spl:')) return null;
  if (chain === 'SOLANA') return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
  const c = CHAIN_ASSETS[chain?.toUpperCase()];
  return c ? `${c.explorer}/tx/${hash}` : null;
}

/**
 * Public profile for an address.
 *
 * Deliberately thin: a display name and avatar, nothing else. Counterparties
 * need to recognise each other in an escrow; they do not need each other's
 * email or trading history.
 */
router.get('/users/:address', (req: Request, res: Response) => {
  const user = queries.getUserByWallet.get(req.params.address) as any;

  res.json({
    walletAddress: req.params.address,
    displayName: user?.display_name ?? null,
    avatarUrl: user?.avatar_url ?? null,
    registered: Boolean(user),
  });
});

router.use(authenticateJWT);

/** The wallet behind this session. */
function wallet(req: AuthRequest): string | null {
  const merchant = queries.getMerchantById.get(req.merchantId!) as any;
  return merchant?.wallet_address ?? null;
}

function ensureUser(address: string) {
  let user = queries.getUserByWallet.get(address) as any;
  if (!user) {
    const id = uuidv4();
    queries.createUser.run(id, address, null);
    user = queries.getUserById.get(id);
  }
  return user;
}

/**
 * The signed-in person, across both sides of the marketplace.
 * `isSeller` is derived from having published a link, not from a flag — it is
 * true exactly when it is useful.
 */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const address = wallet(req);
    if (!address) return res.status(400).json({ error: 'No wallet on this session' });

    const user = ensureUser(address);
    const merchant = queries.getMerchantById.get(req.merchantId!) as any;

    const { count: linkCount } = db
      .prepare('SELECT COUNT(*) AS count FROM payment_links WHERE merchant_id = ?')
      .get(req.merchantId!) as { count: number };

    const spent = queries.getPayerStats.get(address) as {
      payments: number;
      total_spent: number;
      merchants: number;
    };

    const { count: escrowCount } = db
      .prepare(
        `SELECT COUNT(*) AS count FROM escrows
          WHERE (buyer_address = ? COLLATE NOCASE OR seller_address = ? COLLATE NOCASE)
            AND status IN ('draft','pending_funding','funded','active','disputed')`
      )
      .get(address, address) as { count: number };

    res.json({
      id: user.id,
      walletAddress: address,
      displayName: user.display_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      isSeller: linkCount > 0,
      merchantName: merchant?.merchant_name ?? null,
      stats: {
        paymentsMade: spent.payments ?? 0,
        totalSpent: Math.round((spent.total_spent ?? 0) * 100) / 100,
        merchantsPaid: spent.merchants ?? 0,
        openEscrows: escrowCount,
        linksPublished: linkCount,
      },
    });
  } catch (error) {
    console.error('Error loading account:', error);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

/** Update the buyer-side profile. */
router.put('/', (req: AuthRequest, res: Response) => {
  try {
    const address = wallet(req);
    if (!address) return res.status(400).json({ error: 'No wallet on this session' });

    const { displayName, email, avatarUrl } = req.body;

    if (displayName != null && String(displayName).length > 60) {
      return res.status(400).json({ error: 'Display name must be 60 characters or fewer' });
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return res.status(400).json({ error: 'That email address is not valid' });
    }
    if (avatarUrl && !/^https:\/\//.test(String(avatarUrl))) {
      return res.status(400).json({ error: 'Avatar URL must be https' });
    }

    const user = ensureUser(address);
    queries.updateUser.run(
      displayName?.trim() || null,
      email?.trim() || null,
      avatarUrl?.trim() || null,
      user.id
    );

    const updated = queries.getUserById.get(user.id) as any;
    res.json({
      id: updated.id,
      walletAddress: updated.wallet_address,
      displayName: updated.display_name,
      email: updated.email,
      avatarUrl: updated.avatar_url,
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Everything this wallet has paid for, across every merchant.
 *
 * This is the half of the ledger merchants could already see and buyers could
 * not: the same payment, from the other side.
 */
router.get('/payments', (req: AuthRequest, res: Response) => {
  try {
    const address = wallet(req);
    if (!address) return res.json([]);

    const rows = queries.getPaymentsByPayer.all(address) as any[];

    res.json(
      rows.map((r) => ({
        invoiceId: r.invoice_id,
        title: r.item_title ?? 'Payment',
        merchantName: r.merchant_name || 'Merchant',
        merchantWallet: r.merchant_wallet,
        amount: r.amount,
        currency: r.currency,
        cryptoAmount: r.paid_amount,
        crypto: r.crypto,
        chain: r.chain,
        status: r.status,
        txHash: r.tx_hash,
        explorerUrl: explorerTx(r.chain, r.tx_hash),
        paidAt: r.paid_at,
        createdAt: r.created_at,
      }))
    );
  } catch (error) {
    console.error('Error loading buyer payments:', error);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

/**
 * Display names for a batch of addresses, so counterparties show up as people
 * rather than hex. Unregistered addresses simply come back without a name.
 */
router.post('/directory', (req: AuthRequest, res: Response) => {
  try {
    const addresses: string[] = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
    if (addresses.length === 0) return res.json({});
    if (addresses.length > 100) {
      return res.status(400).json({ error: 'Too many addresses in one lookup' });
    }

    const rows = queries.getUsersByWallets.all(JSON.stringify(addresses)) as any[];

    res.json(
      Object.fromEntries(
        rows
          .filter((r) => r.display_name || r.avatar_url)
          .map((r) => [
            r.wallet_address,
            { displayName: r.display_name, avatarUrl: r.avatar_url },
          ])
      )
    );
  } catch (error) {
    console.error('Error looking up directory:', error);
    res.status(500).json({ error: 'Failed to look up profiles' });
  }
});

export default router;
