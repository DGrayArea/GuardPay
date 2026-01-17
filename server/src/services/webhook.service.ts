import axios from 'axios';
import crypto from 'crypto';
import { queries } from '../config/database';

interface WebhookPayload {
  event: string;
  data: any;
  timestamp: string;
}

class WebhookService {
  /**
   * Trigger webhook for merchant
   */
  async triggerWebhook(merchantId: string, event: string, data: any) {
    try {
      const webhooks = queries.getWebhooksByMerchant.all(merchantId) as any[];

      for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events);
        
        // Check if webhook is subscribed to this event
        if (events.includes(event) || events.includes('*')) {
          await this.sendWebhook(webhook.url, webhook.secret, event, data);
        }
      }
    } catch (error) {
      console.error(`Error triggering webhook for merchant ${merchantId}:`, error);
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(url: string, secret: string, event: string, data: any) {
    try {
      const payload: WebhookPayload = {
        event,
        data,
        timestamp: new Date().toISOString(),
      };

      // Generate signature
      const signature = this.generateSignature(payload, secret);

      // Send webhook
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-GuardPay-Signature': signature,
          'X-GuardPay-Event': event,
        },
        timeout: 5000, // 5 second timeout
      });

      console.log(`✅ Webhook sent to ${url} for event ${event}`);
    } catch (error) {
      console.error(`Failed to send webhook to ${url}:`, error);
      // In production, you'd want to implement retry logic here
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: WebhookPayload, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

export const webhookService = new WebhookService();
