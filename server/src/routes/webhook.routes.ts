import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { queries } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { webhookService } from '../services/webhook.service';

const router: Router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * Get all webhooks for merchant
 */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const webhooks = queries.getWebhooksByMerchant.all(req.merchantId!);
    
    // Don't expose secrets
    const safeWebhooks = (webhooks as any[]).map(wh => ({
      id: wh.id,
      url: wh.url,
      events: JSON.parse(wh.events),
      enabled: wh.enabled === 1,
      createdAt: wh.created_at,
    }));

    res.json(safeWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * Create new webhook
 */
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { url, events } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'URL and events array required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex');
    const webhookId = uuidv4();

    queries.createWebhook.run(
      webhookId,
      req.merchantId!,
      url,
      JSON.stringify(events),
      secret
    );

    res.status(201).json({
      id: webhookId,
      url,
      events,
      secret,
      message: 'Webhook created. Store the secret securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * Delete webhook
 */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    queries.deleteWebhook.run(req.params.id, req.merchantId!);
    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * Test webhook
 */
router.post('/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    const webhook = queries.getWebhookById.get(req.params.id, req.merchantId!) as any;

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Send test webhook
    await webhookService.triggerWebhook(req.merchantId!, 'test', {
      message: 'This is a test webhook from GuardPay',
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Test webhook sent' });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;
