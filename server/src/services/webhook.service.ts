import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';

export interface WebhookPayload {
  id: string;
  event: string;
  data: any;
  timestamp: string;
}

/** Backoff schedule in seconds: ~10s, 1m, 5m, 30m, 2h, 6h. */
const RETRY_SCHEDULE = [10, 60, 300, 1800, 7200, 21600];

const REQUEST_TIMEOUT_MS = 8000;

class WebhookService {
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  /**
   * Queue an event for every webhook subscribed to it. Delivery happens in the
   * background so a slow or dead merchant endpoint can never stall the payment
   * monitor, and a failed POST is retried instead of being lost.
   */
  async trigger(merchantId: string, event: string, data: any) {
    try {
      const webhooks = queries.getWebhooksByMerchant.all(merchantId) as any[];

      for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events);
        if (!events.includes(event) && !events.includes('*')) continue;

        const payload: WebhookPayload = {
          id: `evt_${uuidv4().replace(/-/g, '').substring(0, 20)}`,
          event,
          data,
          timestamp: new Date().toISOString(),
        };

        queries.createDelivery.run(
          uuidv4(),
          webhook.id,
          merchantId,
          event,
          JSON.stringify(payload),
          new Date().toISOString()
        );
      }

      // Deliver promptly rather than waiting for the next sweep of the queue.
      void this.flush();
    } catch (error) {
      console.error(`Error queueing webhook for merchant ${merchantId}:`, error);
    }
  }

  /** Back-compat alias for the previous method name. */
  async triggerWebhook(merchantId: string, event: string, data: any) {
    return this.trigger(merchantId, event, data);
  }

  startDispatcher(intervalMs = 15000) {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), intervalMs);
    console.log('✅ Webhook dispatcher started');
  }

  stopDispatcher() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Send every delivery that is due, one attempt each. */
  async flush() {
    if (this.flushing) return;
    this.flushing = true;

    try {
      const due = queries.getDueDeliveries.all() as any[];

      for (const delivery of due) {
        const webhook = queries.getWebhookById.get(delivery.webhook_id, delivery.merchant_id) as any;
        if (!webhook) {
          queries.updateDeliveryAttempt.run(
            'failed',
            delivery.attempts,
            null,
            'webhook no longer exists',
            null,
            null,
            delivery.id
          );
          continue;
        }

        await this.attempt(delivery, webhook);
      }
    } catch (error) {
      console.error('Webhook flush error:', error);
    } finally {
      this.flushing = false;
    }
  }

  private async attempt(delivery: any, webhook: any) {
    const attempts = delivery.attempts + 1;
    const body = delivery.payload;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(timestamp, body, webhook.secret);

    try {
      const response = await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-GuardPay-Event': delivery.event,
          'X-GuardPay-Timestamp': timestamp,
          // t=<unix>,v1=<hex> — the timestamp is signed too, so a captured
          // payload cannot be replayed later.
          'X-GuardPay-Signature': `t=${timestamp},v1=${signature}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
        // Treat any non-2xx as a retryable failure rather than throwing early.
        validateStatus: () => true,
        transformRequest: [(d) => d],
      });

      if (response.status >= 200 && response.status < 300) {
        queries.updateDeliveryAttempt.run(
          'delivered',
          attempts,
          response.status,
          null,
          null,
          new Date().toISOString(),
          delivery.id
        );
        console.log(`✅ Webhook ${delivery.event} → ${webhook.url} (${response.status})`);
        return;
      }

      this.scheduleRetry(delivery, attempts, response.status, String(response.data).slice(0, 500));
    } catch (error: any) {
      this.scheduleRetry(delivery, attempts, null, error.message?.slice(0, 500) ?? 'request failed');
    }
  }

  private scheduleRetry(delivery: any, attempts: number, status: number | null, body: string | null) {
    if (attempts >= RETRY_SCHEDULE.length) {
      queries.updateDeliveryAttempt.run('failed', attempts, status, body, null, null, delivery.id);
      console.error(`❌ Webhook ${delivery.event} gave up after ${attempts} attempts`);
      return;
    }

    const delaySeconds = RETRY_SCHEDULE[attempts];
    const next = new Date(Date.now() + delaySeconds * 1000).toISOString();

    queries.updateDeliveryAttempt.run('pending', attempts, status, body, next, null, delivery.id);
    console.warn(
      `⚠️  Webhook ${delivery.event} failed (attempt ${attempts}), retrying in ${delaySeconds}s`
    );
  }

  /** HMAC-SHA256 over `<timestamp>.<raw body>`, hex encoded. */
  sign(timestamp: string, rawBody: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  }

  /**
   * Verify an inbound signature header. Exposed so merchants can copy this
   * implementation, and used by the integration tests.
   */
  verifySignature(header: string, rawBody: string, secret: string, toleranceSeconds = 300): boolean {
    const parts = Object.fromEntries(
      header.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string])
    );
    if (!parts.t || !parts.v1) return false;

    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSeconds) return false;

    const expected = this.sign(parts.t, rawBody, secret);
    const a = Buffer.from(parts.v1);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

export const webhookService = new WebhookService();
