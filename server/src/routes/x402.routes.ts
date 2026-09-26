import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { x402Service } from '../services/x402.service';
import { webhookService } from '../services/webhook.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { computeX402Fee, X402_FEE } from '../services/fee.service';
import { x402FeeLedger, feeRequirements } from '../services/x402-fees.service';

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

/**
 * Who the facilitator will pay gas for. `any` settles for every payee, which
 * is the open-infrastructure default. `merchants` settles only for payees
 * registered here, since a fee can only be accrued against an account that
 * exists — otherwise every stranger's settlement is gas GuardPay never recoups.
 */
const PAYEE_POLICY = process.env.X402_PAYEES === 'merchants' ? 'merchants' : 'any';

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

/** What this facilitator charges payees, so a resource server can see it before integrating. */
router.get('/fees', (_req: Request, res: Response) => {
  res.json({
    bps: Number(X402_FEE.bps),
    minAtomic: X402_FEE.min.toString(),
    payees: PAYEE_POLICY,
    creditLimitAtomic: X402_FEE.creditLimit.toString(),
    collection: 'accrued per settlement against the payee merchant account',
  });
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
    ? (queries.getMerchantByWalletNoCase.get(info.payTo) as any)
    : null;

  // A merchant who has run up more unpaid fees than the credit limit allows
  // gets no more gas from us until they settle up from the dashboard.
  if (merchant?.id && X402_FEE.creditLimit > 0n && info.asset) {
    const owed = x402FeeLedger(merchant.id).find(
      (row) => row.network === info.network && row.asset === info.asset!.toLowerCase()
    );
    if (owed && BigInt(owed.owed) >= X402_FEE.creditLimit) {
      return res.status(402).json({
        success: false,
        errorReason: 'facilitator_fee_overdue',
        detail: 'The payee owes GuardPay facilitator fees above its credit limit.',
      });
    }
  }

  if (PAYEE_POLICY === 'merchants' && !merchant) {
    return res.status(403).json({
      success: false,
      errorReason: 'payee_not_registered',
      detail: 'This facilitator only settles for payees with a GuardPay merchant account.',
    });
  }

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

    // Fixed at settlement so a later rate change never rewrites what was owed.
    // Only a known payee can owe anything.
    const fee = success && merchant?.id ? computeX402Fee(info.amount) : '0';

    queries.settleX402.run(
      success ? 'settled' : 'failed',
      txHash,
      success ? null : ((result as any)?.errorReason ?? 'settlement failed'),
      fee,
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
        fee_amount: fee,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('x402 settle error:', error);
    queries.settleX402.run('failed', null, error?.message ?? 'settlement failed', '0', rowId);
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
        // Facilitator fees owed on settled payments, atomic units of the asset.
        fees: stats?.fees ?? 0,
      },
      payments: rows.map((r) => ({
        id: r.id,
        paymentId: r.payment_id,
        scheme: r.scheme,
        network: r.network,
        payer: r.payer,
        amount: r.amount,
        fee: r.fee_amount ?? '0',
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

/** Facilitator fees this merchant owes, per network and asset, with the terms to pay them. */
router.get('/fees/owed', async (req: AuthRequest, res: Response) => {
  try {
    const rows = x402FeeLedger(req.merchantId!);
    const withTerms = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        paymentRequirements:
          BigInt(row.owed) > 0n && x402Service.isConfigured
            ? await feeRequirements(row.network, row.asset, row.owed).catch(() => null)
            : null,
      }))
    );
    res.json({ fees: withTerms, collecting: Boolean(process.env.PLATFORM_FEE_ADDRESS) });
  } catch (error) {
    console.error('Error loading x402 fees owed:', error);
    res.status(500).json({ error: 'Failed to load x402 fees owed' });
  }
});

/**
 * Pay down accrued fees with a signed EIP-3009 authorization to the platform
 * fee address, settled through this facilitator. The requirements are rebuilt
 * here from the signed amount, never taken from the client, and the amount
 * must not exceed what is owed.
 */
router.post('/fees/pay', async (req: AuthRequest, res: Response) => {
  if (!x402Service.isConfigured) return unavailable(res);

  const { paymentPayload } = req.body ?? {};
  const network = paymentPayload?.accepted?.network;
  const asset = String(paymentPayload?.accepted?.asset ?? '').toLowerCase();
  const auth = paymentPayload?.payload?.authorization;
  if (!network || !asset || !auth?.value) {
    return res.status(400).json({ error: 'a signed x402 v2 paymentPayload is required' });
  }

  let value: bigint;
  try {
    value = BigInt(auth.value);
  } catch {
    return res.status(400).json({ error: 'authorization.value is not an integer' });
  }

  const owed = x402FeeLedger(req.merchantId!).find(
    (row) => row.network === network && row.asset === asset
  );
  if (!owed || value <= 0n || value > BigInt(owed.owed)) {
    return res.status(400).json({
      error: 'amount must be positive and no more than what is owed',
      owed: owed?.owed ?? '0',
    });
  }

  let requirements;
  try {
    requirements = await feeRequirements(network, asset, value.toString());
  } catch (error: any) {
    return res.status(503).json({ error: error?.message ?? 'fee collection is not configured' });
  }
  const payload = { ...paymentPayload, accepted: requirements };

  const paymentId = x402Service.paymentId(payload);
  const rowId = uuidv4();
  try {
    queries.recordX402FeePayment.run(
      rowId,
      req.merchantId!,
      paymentId,
      network,
      asset,
      value.toString(),
      auth.from ?? null
    );
  } catch {
    return res.status(409).json({ error: 'this authorization was already submitted' });
  }

  try {
    const result: any = await x402Service.settle(payload, requirements);
    const success = result?.success !== false;
    queries.settleX402FeePayment.run(
      success ? 'settled' : 'failed',
      result?.transaction ?? null,
      success ? null : (result?.errorReason ?? 'settlement failed'),
      rowId
    );
    if (!success) return res.status(400).json(result);
    res.json({ ...result, fees: x402FeeLedger(req.merchantId!) });
  } catch (error: any) {
    console.error('x402 fee payment error:', error);
    queries.settleX402FeePayment.run('failed', null, error?.message ?? 'settlement failed', rowId);
    res.status(502).json({ error: 'facilitator could not settle the fee payment' });
  }
});

export default router;
