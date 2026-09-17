import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { queries } from '../config/database';
import { generateToken, generateAPIKey } from '../middleware/auth.middleware';

const isEvmAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

/**
 * Verify a wallet signature over `message`.
 * EVM wallets sign with secp256k1; Solana wallets sign with ed25519, which
 * ethers cannot check — each needs its own verification path.
 */
function verifyWalletSignature(address: string, message: string, signature: string): boolean {
  if (isEvmAddress(address)) {
    try {
      return ethers.verifyMessage(message, signature).toLowerCase() === address.toLowerCase();
    } catch {
      return false;
    }
  }

  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      Buffer.from(signature, 'base64'),
      bs58.decode(address)
    );
  } catch {
    return false;
  }
}

const router: Router = Router();

// Store nonces temporarily (in production, use Redis)
const nonces = new Map<string, { nonce: string; timestamp: number }>();

/**
 * Get nonce for wallet signature
 */
router.post('/nonce', (req: Request, res: Response) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  // Math.random() is not a CSPRNG; a login challenge must not be guessable.
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store nonce with 5 minute expiration. Solana addresses are case-sensitive
  // base58, so only EVM addresses get lowercased.
  nonces.set(isEvmAddress(walletAddress) ? walletAddress.toLowerCase() : walletAddress, {
    nonce,
    timestamp: Date.now(),
  });

  // Clean up old nonces
  for (const [address, data] of nonces.entries()) {
    if (Date.now() - data.timestamp > 5 * 60 * 1000) {
      nonces.delete(address);
    }
  }

  res.json({ nonce });
});

/**
 * Verify wallet signature and authenticate
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { walletAddress, signature } = req.body;

  if (!walletAddress || !signature) {
    return res.status(400).json({ error: 'Wallet address and signature required' });
  }

  try {
    // Solana addresses are base58 and case-sensitive, so only EVM addresses
    // may be lowercased when looking up the nonce.
    const nonceKey = isEvmAddress(walletAddress) ? walletAddress.toLowerCase() : walletAddress;
    const nonceData = nonces.get(nonceKey);

    if (!nonceData) {
      return res.status(400).json({ error: 'Nonce not found or expired' });
    }

    const message = `Sign this message to authenticate with GuardPay.\n\nNonce: ${nonceData.nonce}`;

    if (!verifyWalletSignature(walletAddress, message, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Delete used nonce
    nonces.delete(nonceKey);

    // Every wallet is a user. Being a merchant is a role taken on later, when
    // they create their first payment link — not a precondition for paying or
    // for being a party to an escrow.
    let user = queries.getUserByWallet.get(walletAddress) as any;
    if (!user) {
      const userId = uuidv4();
      queries.createUser.run(userId, walletAddress, null);
      user = queries.getUserById.get(userId);
    }

    // The merchant record backs the seller-side dashboard. It is still created
    // eagerly so existing JWT-keyed routes keep working.
    let merchant = queries.getMerchantByWallet.get(walletAddress) as any;

    if (!merchant) {
      const merchantId = uuidv4();
      const apiKey = generateAPIKey();

      queries.createMerchant.run(merchantId, walletAddress, apiKey, 'Merchant', '', '');
      merchant = queries.getMerchantById.get(merchantId);
    }

    const token = generateToken(merchant.id);

    res.json({
      token,
      merchant: {
        id: merchant.id,
        walletAddress: merchant.wallet_address,
        merchantName: merchant.merchant_name,
      },
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Refresh JWT token
 */
router.post('/refresh', (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production') as any;
    
    // Generate new token
    const newToken = generateToken(decoded.merchantId);
    
    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
