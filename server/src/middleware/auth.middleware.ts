import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queries } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  merchantId?: string;
  merchant?: any;
}

/**
 * Verify JWT token from Authorization header
 */
export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.merchantId = decoded.merchantId;
    
    // Optionally load merchant data
    const merchant = queries.getMerchantById.get(decoded.merchantId);
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.merchant = merchant;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Verify API key from X-API-Key header
 */
export function authenticateAPIKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'No API key provided' });
  }

  try {
    const merchant = queries.getMerchantByApiKey.get(apiKey);
    
    if (!merchant) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.merchantId = (merchant as any).id;
    req.merchant = merchant;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
}

/**
 * Optional authentication - allows both JWT and API key
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  } else if (apiKey) {
    return authenticateAPIKey(req, res, next);
  } else {
    // No authentication provided - continue without merchant context
    next();
  }
}

/**
 * Generate JWT token
 */
export function generateToken(merchantId: string): string {
  return jwt.sign(
    { merchantId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Generate API key
 */
export function generateAPIKey(): string {
  const crypto = require('crypto');
  return `gp_${crypto.randomBytes(32).toString('hex')}`;
}
