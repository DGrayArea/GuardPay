/**
 * Print the account-level extended PUBLIC key for a watch-only deployment.
 *
 *   pnpm xpub
 *
 * The output derives every payment address but cannot sign anything, so it is
 * safe to place in the web tier's environment. The seed stays on the signer.
 */
import 'dotenv/config';
import { walletService } from '../src/services/wallet.service';

try {
  const xpub = walletService.exportXpub();
  console.log('');
  console.log('Account xpub (safe to share with the watch-only process):');
  console.log('');
  console.log(`  WALLET_ROLE=watch`);
  console.log(`  WALLET_XPUB=${xpub}`);
  console.log('');
  console.log('This key derives addresses only. It cannot move funds.');
  console.log('Do NOT copy MASTER_SEED into the watch-only process.');
  console.log('');
} catch (error: any) {
  console.error('Could not export:', error.message);
  process.exit(1);
}
