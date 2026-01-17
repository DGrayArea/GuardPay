import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { generateToken, generateAPIKey } from '../middleware/auth.middleware';

const router = Router();

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

  // Generate random nonce
  const nonce = Math.random().toString(36).substring(2, 15);
  
  // Store nonce with 5 minute expiration
  nonces.set(walletAddress.toLowerCase(), {
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
    const addressLower = walletAddress.toLowerCase();
    const nonceData = nonces.get(addressLower);

    if (!nonceData) {
      return res.status(400).json({ error: 'Nonce not found or expired' });
    }

    // Verify signature
    const message = `Sign this message to authenticate with GuardPay.\n\nNonce: ${nonceData.nonce}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== addressLower) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Delete used nonce
    nonces.delete(addressLower);

    // Check if merchant exists
    let merchant = queries.getMerchantByWallet.get(walletAddress) as any;

    if (!merchant) {
      // Create new merchant
      const merchantId = uuidv4();
      const apiKey = generateAPIKey();

      queries.createMerchant.run(
        merchantId,
        walletAddress,
        apiKey,
        'Merchant',
        '',
        ''
      );

      merchant = queries.getMerchantById.get(merchantId);
    }

    // Generate JWT token
    const token = generateToken(merchant.id);

    res.json({
      token,
      merchant: {
        id: merchant.id,
        walletAddress: merchant.wallet_address,
        merchantName: merchant.merchant_name,
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
