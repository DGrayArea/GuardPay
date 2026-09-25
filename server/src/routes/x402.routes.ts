import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { x402Service } from '../services/x402.service';
import { webhookService } from '../services/webhook.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';

const router: Router = Router();

/**
 * x402 facilitator endpoints.
 *
 * `/supported`, `/verify` and `/settle` are the protocol's standard surface,
 * deliberately unauthenticated: any resource server should be able to point at
 * this facilitator, which is the whole premise of being infrastructure rather
 * than a closed integration. Access control belongs in front of it (rate limit,
 * allowlist) rather than in the protocol shape.
 *
 * The merchant-scoped reporting routes below it are authenticated as usual.
 */

/**
 * Pull the useful fields out of a payload/requirements pair for the ledger.
 *
 * x402 v2 carries the agreed terms on `payload.accepted` and names the figure
 * `amount`; v1 put scheme/network at the top level and called it
 * `maxAmountRequired`. Both are read so a v1 client still records correctly.
 */
function describe(payload: any, requirements: any) {
  const auth = payload?.payload?.authorization ?? payload?.payload ?? {};
  const accepted = payload?.accepted ?? {};

  return {
    scheme: accepted.scheme ?? payload?.scheme ?? requirements?.scheme ?? 'exact',
    network: accepted.network ?? payload?.network ?? requirements?.network ?? 'unknown',
    payer: auth?.from ?? payload?.payer ?? null,
    payTo: requirements?.payTo ?? accepted.payTo ?? auth?.to ?? null,
    asset: requirements?.asset ?? accepted.asset ?? null,
    amount: String(
      requirements?.amount ?? requirements?.maxAmountRequired ?? auth?.value ?? ''
    ),
    resource:
      (typeof requirements?.resource === 'string' ? requirements.resource : null) ??
      payload?.resource?.url ??
      null,
  };
}

/**
 * Reject a payload the facilitator cannot even interpret.
 *
 * Without this an unreadable request surfaces as `isValid: false`, which tells
 * a caller their signature was rejected when in fact we never looked at it.
 */
function shapeError(payload: any, requirements: any): string | null {
  if (typeof payload !== 'object' || payload === null) return 'paymentPayload must be an object';
  if (typeof requirements !== 'object' || requirements === null) {
    return 'paymentRequirements must be an object';
  }
  if (!payload.payload) return 'paymentPayload.payload is missing';

  const scheme = payload.accepted?.scheme ?? payload.scheme;
  if (!scheme) {
    return 'paymentPayload.accepted is missing (x402 v2) and no top-level scheme was given (v1)';
  }
  return null;
}

function unavailable(res: Response) {
  return res.status(503).json({
    error: 'x402 facilitator is not configured on this server',
    reason: x402Service.unavailableReason,
  });
}

/** Payment kinds, extensions and signer addresses this facilitator supports. */
router.get('/supported', (_req: Request, res: Response) => {
  if (!x402Service.isConfigured) return unavailable(res);
  res.json(x402Service.getSupported());
});

/**
 * Verify a signed payment authorization without moving anything.
 * A resource server calls this before serving the paid response.
 */
router.post('/verify', async (req: Request, res: Response) => {
  if (!x402Service.isConfigured) return unavailable(res);

  const { paymentPayload, paymentRequirements } = req.body ?? {};
  if (!paymentPayload || !paymentRequirements) {
    return res
      .status(400)
      .json({ error: 'paymentPayload and paymentRequirements are required' });
  }

  const malformed = shapeError(paymentPayload, paymentRequirements);
  if (malformed) return res.status(400).json({ error: malformed });

  try {
    const result = await x402Service.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error: any) {
    // Deliberately NOT reported as `isValid: false`: that would tell the caller
    // their signature was rejected when the facilitator actually failed to run
    // the check at all, and would hide our own faults as their bad payments.
    console.error('x402 verify error:', error);
    res.status(502).json({
      error: 'facilitator could not complete verification',
      detail: error?.message ?? String(error),
    });
  }
});

/**
 * Settle a verified authorization on-chain.
 *
 * GuardPay submits and pays the gas; the tokens move payer → payee directly
 * via EIP-3009, so the facilitator never takes custody.
 */
router.post('/settle', async (req: Request, res: Response) => {
  if (!x402Service.isConfigured) return unavailable(res);

  const { paymentPayload, paymentRequirements } = req.body ?? {};
  if (!paymentPayload || !paymentRequirements) {
    return res
      .status(400)
      .json({ error: 'paymentPayload and paymentRequirements are required' });
  }

  const malformed = shapeError(paymentPayload, paymentRequirements);
  if (malformed) return res.status(400).json({ error: malformed });

  const info = describe(paymentPayload, paymentRequirements);
  const paymentId = x402Service.paymentId(paymentPayload);

  // Replay guard. The token contract also rejects a reused EIP-3009 nonce, but
  // only after a broadcast has already cost gas — refuse it before submitting.
  if (paymentId) {
    const existing = queries.getX402ByPaymentId.get(paymentId) as any;
    if (existing?.status === 'settled') {
      return res.status(409).json({
        success: false,
        errorReason: 'payment_already_settled',
        transaction: existing.tx_hash,
        network: existing.network,
      });
    }
  }

  const rowId = uuidv4();
  // The merchant is whoever is being paid, if they are known to us. An unknown
  // payee is still settled — this is a public facilitator.
  const merchant = info.payTo
    ? (queries.getMerchantByWallet.get(info.payTo) as any)
    : null;

  queries.recordX402.run(
    rowId,
    merchant?.id ?? null,
    paymentId,
    info.scheme,
    info.network,
    info.payer,
    info.payTo,
    info.asset,
    info.amount,
    info.resource,
    'settling'
  );

  try {
    const result = await x402Service.settle(paymentPayload, paymentRequirements);
    const success = (result as any)?.success !== false;
    const txHash = (result as any)?.transaction ?? null;

    queries.settleX402.run(
      success ? 'settled' : 'failed',
      txHash,
      success ? null : ((result as any)?.errorReason ?? 'settlement failed'),
      rowId
    );

    if (success && merchant?.id) {
      await webhookService.trigger(merchant.id, 'x402.settled', {
        payment_id: paymentId,
        payer: info.payer,
        amount: info.amount,
        asset: info.asset,
        network: info.network,
        resource: info.resource,
        tx_hash: txHash,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('x402 settle error:', error);
    queries.settleX402.run('failed', null, error?.message ?? 'settlement failed', rowId);
    res.status(502).json({
      success: false,
      errorReason: 'facilitator could not complete settlement',
      detail: error?.message ?? String(error),
    });
  }
});

// --- Merchant-facing reporting ---------------------------------------------
router.use(authenticateJWT);

/** Per-request payments taken through this facilitator, for the dashboard. */
router.get('/payments', (req: AuthRequest, res: Response) => {
  try {
    const rows = queries.getX402ByMerchant.all(req.merchantId!) as any[];
    const stats = queries.getX402Stats.get(req.merchantId!) as any;

    res.json({
      stats: {
        total: stats?.total ?? 0,
        settled: stats?.settled ?? 0,
        volume: stats?.volume ?? 0,
      },
      payments: rows.map((r) => ({
        id: r.id,
        paymentId: r.payment_id,
        scheme: r.scheme,
        network: r.network,
        payer: r.payer,
        amount: r.amount,
        asset: r.asset,
        resource: r.resource,
        status: r.status,
        txHash: r.tx_hash,
        error: r.error,
        createdAt: r.created_at,
        settledAt: r.settled_at,
      })),
    });
  } catch (error) {
    console.error('Error loading x402 payments:', error);
    res.status(500).json({ error: 'Failed to load x402 payments' });
  }
});

export default router;
