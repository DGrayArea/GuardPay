import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { queries } from '../config/database';
import { escrowService } from '../services/escrow.service';
import { solanaEscrowService } from '../services/solana-escrow.service';
import { webhookService } from '../services/webhook.service';
import { computeFee } from '../services/fee.service';
import { COMMERCE_PAYMENTS } from '../config/escrow.contracts';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';

const router: Router = Router();

const isAddress = (v: unknown): v is string => typeof v === 'string' && ethers.isAddress(v);

/** Base58, 32-44 chars — a Solana public key. */
const isSolanaAddress = (v: unknown): v is string =>
  typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

const isSolanaDeal = (row: { chain?: string; custody?: string }) =>
  row.custody === 'custodial' || String(row.chain).startsWith('solana');
const same = (a?: string | null, b?: string | null) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** The wallet behind the JWT — escrow parties are addresses, not merchant ids. */
function callerAddress(req: AuthRequest): string | null {
  const merchant = queries.getMerchantById.get(req.merchantId!) as any;
  return merchant?.wallet_address ?? null;
}

function shape(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    conditions: row.conditions,
    buyerAddress: row.buyer_address,
    sellerAddress: row.seller_address,
    amount: row.amount,
    currency: row.currency,
    chain: row.chain,
    token: row.token_address,
    custody: row.custody,
    contractAddress: row.contract_address,
    depositAddress: row.deposit_address,
    status: row.status,
    fundedTxHash: row.funded_tx_hash,
    releaseTxHash: row.release_tx_hash,
    refundTxHash: row.refund_tx_hash,
    deadlineAt: row.deadline_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Protocol metadata the client needs to build the same struct we do. */
router.get('/config', (_req: Request, res: Response) => {
  res.json({
    fee: computeFee(100, 'escrow'),
    chains: {
      // Non-custodial: Base's audited escrow contract holds the funds.
      evm: {
        configured: escrowService.isConfigured,
        custody: 'contract',
        chain: escrowService.chainKey,
        operator: escrowService.operatorAddress,
        escrowContract: COMMERCE_PAYMENTS.authCaptureEscrow,
        preApprovalCollector: COMMERCE_PAYMENTS.collectors.preApproval,
        token: escrowService.token,
      },
      // Custodial: GuardPay holds a per-deal vault between funding and release.
      solana: {
        configured: solanaEscrowService.isConfigured,
        custody: 'custodial',
        chain: 'solana-devnet',
        token: solanaEscrowService.token,
      },
    },
    // Back-compat for clients written against the EVM-only shape.
    configured: escrowService.isConfigured,
    chain: escrowService.chainKey,
    operator: escrowService.operatorAddress,
    escrowContract: COMMERCE_PAYMENTS.authCaptureEscrow,
    preApprovalCollector: COMMERCE_PAYMENTS.collectors.preApproval,
    token: escrowService.token,
  });
});

router.use(authenticateJWT);

/**
 * Create a deal. Nothing goes on-chain here — the buyer funds it separately,
 * which is what makes the arrangement non-custodial.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, conditions, counterparty, role, amount, deadlineAt } = req.body;
    const network: 'evm' | 'solana' = req.body.network === 'solana' ? 'solana' : 'evm';

    if (!title || !amount || !counterparty) {
      return res.status(400).json({ error: 'title, amount and counterparty are required' });
    }
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ error: 'amount must be greater than zero' });
    }

    const validAddress = network === 'solana' ? isSolanaAddress : isAddress;
    if (!validAddress(counterparty)) {
      return res.status(400).json({
        error: `counterparty must be a valid ${network === 'solana' ? 'Solana' : 'EVM'} address`,
      });
    }

    const me = callerAddress(req);
    if (!me) return res.status(400).json({ error: 'No wallet address on this account' });
    if (same(me, counterparty)) {
      return res.status(400).json({ error: 'Buyer and seller must be different addresses' });
    }
    // Both parties must be addressable on the deal's own network.
    if (!validAddress(me)) {
      return res.status(400).json({
        error: `Your account wallet is not a ${network === 'solana' ? 'Solana' : 'EVM'} address, so you cannot be a party to this deal`,
      });
    }
    if (network === 'solana' && !solanaEscrowService.isConfigured) {
      return res.status(503).json({ error: 'Solana escrow is not configured on this server' });
    }

    // The creator states their own side; the counterparty takes the other.
    const asBuyer = role !== 'seller';
    const buyer = asBuyer ? me : counterparty;
    const seller = asBuyer ? counterparty : me;

    const id = `esc_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    if (network === 'solana') {
      const token = solanaEscrowService.token;
      // A fresh vault per deal: deals stay isolated and the buyer can verify
      // the exact balance on-chain.
      const vault = solanaEscrowService.createVault(id);

      queries.createEscrow.run(
        id,
        title,
        description ?? null,
        conditions ?? null,
        buyer,
        seller,
        String(amount),
        token.symbol,
        'solana-devnet',
        token.mint,
        'custodial',
        null,
        vault,
        'pending_funding',
        deadlineAt ?? null,
        me
      );

      escrowService.logEvent(
        id,
        'created',
        me,
        `${asBuyer ? 'Buyer' : 'Seller'} opened the deal — GuardPay holds the vault until release`
      );
    } else {
      const token = escrowService.token;

      queries.createEscrow.run(
        id,
        title,
        description ?? null,
        conditions ?? null,
        ethers.getAddress(buyer),
        ethers.getAddress(seller),
        String(amount),
        token.symbol,
        escrowService.chainKey,
        token.address,
        'contract',
        COMMERCE_PAYMENTS.authCaptureEscrow,
        null,
        'draft',
        deadlineAt ?? null,
        me
      );

      escrowService.logEvent(id, 'created', me, `${asBuyer ? 'Buyer' : 'Seller'} opened the deal`);
    }

    res.status(201).json(shape(queries.getEscrowById.get(id)));
  } catch (error: any) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ error: 'Failed to create escrow' });
  }
});

/** Deals where the caller is a party. */
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const me = callerAddress(req);
    if (!me) return res.json([]);
    const rows = queries.getEscrowsByParty.all(me, me) as any[];
    res.json(rows.map(shape));
  } catch (error) {
    console.error('Error listing escrows:', error);
    res.status(500).json({ error: 'Failed to list escrows' });
  }
});

/** One deal, with its audit trail and live on-chain state. */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });

    const me = callerAddress(req);
    if (!same(me, row.buyer_address) && !same(me, row.seller_address)) {
      return res.status(403).json({ error: 'Not a party to this escrow' });
    }

    const events = queries.getEscrowEvents.all(row.id);

    // The chain is the source of truth; the row is a cache of it.
    let onchain = null;

    if (isSolanaDeal(row) && row.deposit_address && solanaEscrowService.isConfigured) {
      try {
        const held = await solanaEscrowService.getVaultBalance(row.deposit_address);
        const expected = BigInt(
          Math.round(Number(row.amount) * 10 ** solanaEscrowService.token.decimals)
        );
        onchain = {
          hasCollectedPayment: held > 0n,
          capturableAmount: held.toString(),
          refundableAmount: '0',
          funded: held >= expected,
        };
      } catch (err) {
        console.error('Could not read Solana escrow vault:', err);
      }
    } else if (escrowService.isConfigured && row.onchain_id) {
      try {
        const info = escrowService.deserialize(JSON.parse(row.onchain_id));
        const state = await escrowService.getOnchainState(info);
        onchain = {
          hasCollectedPayment: state.hasCollectedPayment,
          capturableAmount: state.capturableAmount.toString(),
          refundableAmount: state.refundableAmount.toString(),
        };
      } catch (err) {
        console.error('Could not read on-chain escrow state:', err);
      }
    }

    res.json({ ...shape(row), events, onchain, viewerRole: same(me, row.buyer_address) ? 'buyer' : 'seller' });
  } catch (error) {
    console.error('Error fetching escrow:', error);
    res.status(500).json({ error: 'Failed to fetch escrow' });
  }
});

/**
 * The exact PaymentInfo the buyer must pre-approve.
 *
 * Returned to the client so its wallet signs the identical struct the operator
 * will submit — the contract hashes every field, so a mismatch anywhere makes
 * the authorize call reference a different, unfunded payment.
 */
router.get('/:id/payment-info', (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });
    if (isSolanaDeal(row)) {
      // Custodial deals have no PaymentInfo — the buyer sends to the vault.
      return res.status(400).json({
        error: 'This is a custodial Solana escrow. Send the funds to the deposit address instead.',
        depositAddress: row.deposit_address,
      });
    }
    if (!escrowService.isConfigured) {
      return res.status(503).json({ error: 'Escrow operator is not configured' });
    }

    const me = callerAddress(req);
    if (!same(me, row.buyer_address)) {
      return res.status(403).json({ error: 'Only the buyer funds this escrow' });
    }

    // Pin the struct on first request so the salt and expiries never drift
    // between what the buyer approves and what the operator submits.
    let info;
    if (row.onchain_id) {
      info = escrowService.deserialize(JSON.parse(row.onchain_id));
    } else {
      info = escrowService.buildPaymentInfo({
        buyerAddress: row.buyer_address,
        sellerAddress: row.seller_address,
        amount: String(row.amount),
        salt: BigInt(ethers.hexlify(ethers.randomBytes(16))).toString(),
      });
      queries.updateEscrowOnchain.run(
        JSON.stringify(escrowService.serialize(info)),
        null,
        'pending_funding',
        row.id
      );
    }

    res.json({
      paymentInfo: escrowService.serialize(info),
      collector: COMMERCE_PAYMENTS.collectors.preApproval,
      escrowContract: COMMERCE_PAYMENTS.authCaptureEscrow,
      token: escrowService.token,
      amount: info.maxAmount.toString(),
    });
  } catch (error) {
    console.error('Error building payment info:', error);
    res.status(500).json({ error: 'Failed to build payment info' });
  }
});

/**
 * Check a custodial vault for the buyer's deposit.
 *
 * Solana has no authorize step — the buyer simply sends tokens to the vault —
 * so funding is confirmed by reading the balance rather than by us pulling it.
 */
router.post('/:id/check-funding', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });
    if (!isSolanaDeal(row)) {
      return res.status(400).json({ error: 'This deal is funded through the escrow contract' });
    }

    const me = callerAddress(req);
    if (!same(me, row.buyer_address) && !same(me, row.seller_address)) {
      return res.status(403).json({ error: 'Not a party to this escrow' });
    }

    const held = await solanaEscrowService.getVaultBalance(row.deposit_address);
    const decimals = solanaEscrowService.token.decimals;
    const expected = BigInt(Math.round(Number(row.amount) * 10 ** decimals));
    const funded = held >= expected;

    if (funded && ['draft', 'pending_funding'].includes(row.status)) {
      queries.updateEscrowStatus.run('funded', row.id);
      escrowService.logEvent(row.id, 'funded', row.buyer_address, 'Deposit confirmed in the vault');

      await webhookService.trigger(req.merchantId!, 'escrow.funded', {
        escrow_id: row.id,
        amount: row.amount,
        currency: row.currency,
        vault: row.deposit_address,
      });
    }

    res.json({
      ...shape(queries.getEscrowById.get(row.id)),
      held: solanaEscrowService.format(held),
      expected: row.amount,
      funded,
    });
  } catch (error: any) {
    console.error('Error checking escrow funding:', error);
    res.status(500).json({ error: error?.message || 'Could not check the vault' });
  }
});

/**
 * Pull pre-approved funds into escrow. Called after the buyer has approved the
 * collector and run preApprove from their wallet.
 */
router.post('/:id/authorize', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });
    if (isSolanaDeal(row)) {
      return res.status(400).json({
        error: 'Custodial escrows are funded by sending to the vault; use check-funding instead.',
      });
    }
    if (!row.onchain_id) return res.status(400).json({ error: 'Payment info has not been prepared' });

    const me = callerAddress(req);
    if (!same(me, row.buyer_address)) {
      return res.status(403).json({ error: 'Only the buyer can fund this escrow' });
    }
    if (!['draft', 'pending_funding'].includes(row.status)) {
      return res.status(409).json({ error: `Escrow is already ${row.status}` });
    }

    const info = escrowService.deserialize(JSON.parse(row.onchain_id));
    const hash = await escrowService.authorize(info, info.maxAmount);

    queries.updateEscrowOnchain.run(row.onchain_id, hash, 'funded', row.id);
    escrowService.logEvent(row.id, 'funded', me, 'Funds locked in escrow', hash);

    await webhookService.trigger(req.merchantId!, 'escrow.funded', {
      escrow_id: row.id,
      amount: row.amount,
      currency: row.currency,
      tx_hash: hash,
    });

    res.json({ ...shape(queries.getEscrowById.get(row.id)), txHash: hash });
  } catch (error: any) {
    console.error('Error authorizing escrow:', error);
    res.status(500).json({ error: error?.shortMessage || error?.message || 'Failed to fund escrow' });
  }
});

/** Release to the seller. Buyer-only — this is the whole point of escrow. */
router.post('/:id/release', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });

    const me = callerAddress(req);
    if (!same(me, row.buyer_address)) {
      return res.status(403).json({ error: 'Only the buyer can release funds' });
    }
    if (!['funded', 'active', 'disputed'].includes(row.status)) {
      return res.status(409).json({ error: `Cannot release an escrow that is ${row.status}` });
    }

    let hash: string;
    let feeDisplay: string;

    if (isSolanaDeal(row)) {
      const result = await solanaEscrowService.release(
        row.deposit_address,
        row.seller_address,
        String(row.amount)
      );
      hash = result.signature;
      feeDisplay = solanaEscrowService.format(result.fee);
    } else {
      const info = escrowService.deserialize(JSON.parse(row.onchain_id));
      const result = await escrowService.capture(info, info.maxAmount);
      hash = result.hash;
      feeDisplay = ethers.formatUnits(result.fee, escrowService.token.decimals);
    }

    queries.setEscrowReleaseTx.run(hash, 'released', row.id);
    escrowService.logEvent(row.id, 'released', me, 'Buyer released the funds', hash);

    await webhookService.trigger(req.merchantId!, 'escrow.released', {
      escrow_id: row.id,
      amount: row.amount,
      fee: feeDisplay,
      tx_hash: hash,
    });

    res.json({ ...shape(queries.getEscrowById.get(row.id)), txHash: hash });
  } catch (error: any) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ error: error?.shortMessage || error?.message || 'Failed to release escrow' });
  }
});

/** Cancel and return the funds. Seller-only, or buyer before funding. */
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });

    const me = callerAddress(req);
    const isBuyer = same(me, row.buyer_address);
    const isSeller = same(me, row.seller_address);
    if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Not a party to this escrow' });

    if (['draft', 'pending_funding'].includes(row.status)) {
      queries.updateEscrowStatus.run('cancelled', row.id);
      escrowService.logEvent(row.id, 'cancelled', me, 'Cancelled before funding');
      return res.json(shape(queries.getEscrowById.get(row.id)));
    }

    // Once funded, only the seller may hand the money back — otherwise a buyer
    // could take delivery and then unilaterally reverse the payment.
    if (!isSeller) {
      return res.status(403).json({ error: 'Only the seller can return funded escrow' });
    }
    if (row.status !== 'funded' && row.status !== 'disputed') {
      return res.status(409).json({ error: `Cannot cancel an escrow that is ${row.status}` });
    }

    const hash = isSolanaDeal(row)
      ? await solanaEscrowService.refund(row.deposit_address, row.buyer_address)
      : await escrowService.void(escrowService.deserialize(JSON.parse(row.onchain_id)));

    queries.setEscrowRefundTx.run(hash, 'refunded', row.id);
    escrowService.logEvent(row.id, 'refunded', me, 'Seller returned the funds', hash);

    await webhookService.trigger(req.merchantId!, 'escrow.refunded', {
      escrow_id: row.id,
      amount: row.amount,
      tx_hash: hash,
    });

    res.json({ ...shape(queries.getEscrowById.get(row.id)), txHash: hash });
  } catch (error: any) {
    console.error('Error cancelling escrow:', error);
    res.status(500).json({ error: error?.shortMessage || error?.message || 'Failed to cancel escrow' });
  }
});

/**
 * Raise a dispute. This only flags the deal for resolution — it moves no money,
 * and either party can still settle it themselves afterwards.
 */
router.post('/:id/dispute', async (req: AuthRequest, res: Response) => {
  try {
    const row = queries.getEscrowById.get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Escrow not found' });

    const me = callerAddress(req);
    if (!same(me, row.buyer_address) && !same(me, row.seller_address)) {
      return res.status(403).json({ error: 'Not a party to this escrow' });
    }
    if (!['funded', 'active'].includes(row.status)) {
      return res.status(409).json({ error: `Cannot dispute an escrow that is ${row.status}` });
    }

    queries.updateEscrowStatus.run('disputed', row.id);
    escrowService.logEvent(row.id, 'disputed', me, req.body?.reason ?? 'Dispute raised');

    await webhookService.trigger(req.merchantId!, 'escrow.disputed', {
      escrow_id: row.id,
      raised_by: me,
      reason: req.body?.reason ?? null,
    });

    res.json(shape(queries.getEscrowById.get(row.id)));
  } catch (error) {
    console.error('Error disputing escrow:', error);
    res.status(500).json({ error: 'Failed to raise dispute' });
  }
});

export default router;
