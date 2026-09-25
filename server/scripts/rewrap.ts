/**
 * Re-encrypt stored key material under the current KEY_ENCRYPTION_KEY.
 *
 *   pnpm rewrap
 *
 * Run after changing KEY_ENCRYPTION_KEY, with the old value still available in
 * KEY_ENCRYPTION_KEY_PREVIOUS. Once this reports zero failures the old key can
 * be retired.
 */
import 'dotenv/config';
import { initializeDatabase } from '../src/config/database';
import { walletService } from '../src/services/wallet.service';

initializeDatabase();

const result = walletService.rewrapStoredSecrets();

console.log('');
console.log('re-encrypted under the current key :', result.rewrapped);
console.log('already current                    :', result.alreadyCurrent);

if (result.failed.length > 0) {
  console.error('');
  console.error(`🔴 ${result.failed.length} key(s) could not be opened by ANY configured key:`);
  result.failed.forEach((a) => console.error('   ' + a));
  console.error('');
  console.error('Set KEY_ENCRYPTION_KEY_PREVIOUS to the previous value and run again.');
  console.error('Until then, funds held at those addresses cannot be moved.');
  process.exit(1);
}

console.log('');
console.log('All stored keys are under the current key. The previous one can be retired.');
console.log('');
