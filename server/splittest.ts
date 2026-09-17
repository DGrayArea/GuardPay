process.env.DATABASE_PATH = '/tmp/feesplit.db';
process.env.PLATFORM_FEE_ADDRESS = '0x000000000000000000000000000000000000FEE5';
process.env.MASTER_SEED = process.env.MASTER_SEED || '';

import 'dotenv/config';
process.env.DATABASE_PATH = '/tmp/feesplit.db';
process.env.PLATFORM_FEE_ADDRESS = '0x000000000000000000000000000000000000FEE5';

import { initializeDatabase, queries, db } from './src/config/database';
import { sweepService } from './src/services/sweep.service';
import { computeFee } from './src/services/fee.service';

initializeDatabase();

queries.createMerchant.run('m1', '0xMerchantWallet', 'k1', 'Shop', '0xMerchantReceiving', '');
queries.createLink.run('pl_1', 'm1', 'Thing', 100, 'USD', 'ETH', null, null);

const fee = computeFee(100, 'merchant');
queries.createInvoice.run(
  'inv_1', 'pl_1', 'm1', fee.total, 'USD', 'ETH', 'ETH',
  '0xInvoiceAddr', null, '0.04', new Date(Date.now() + 9e5).toISOString(),
  null, 0, fee.subtotal, fee.fee, fee.bps, fee.paidBy, fee.netToReceiver
);

const invoice = queries.getInvoiceById.get('inv_1') as any;
console.log(`Invoice: list $${invoice.subtotal}, payer owes $${invoice.amount}, fee $${invoice.fee_amount}, merchant nets $${invoice.net_to_merchant}`);

// 0.04 ETH arrives.
sweepService.enqueue(invoice, '0.04');

const sweeps = db.prepare('SELECT kind, to_address, amount FROM sweeps ORDER BY kind').all() as any[];
console.log('\nSweeps queued:');
for (const s of sweeps) console.log(`  ${String(s.kind).padEnd(11)} ${s.amount.padEnd(22)} → ${s.to_address}`);

const total = sweeps.reduce((n, s) => n + Number(s.amount), 0);
console.log(`\nSum of legs: ${total} ETH (received 0.04) → ${Math.abs(total - 0.04) < 1e-12 ? 'BALANCES' : 'MISMATCH'}`);
const feeLeg = sweeps.find(s => s.kind === 'fee');
console.log(`Fee leg is ${(Number(feeLeg.amount) / 0.04 * 100).toFixed(2)}% of the receipt (expected 1.00%)`);
