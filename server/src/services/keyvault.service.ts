import crypto from 'crypto';

/**
 * Encryption for key material stored in the database.
 *
 * Why this exists: EVM payment addresses persist only a derivation index, so a
 * stolen database is useless without MASTER_SEED — two things must break.
 * Solana keypairs are random, so their secret keys have to be stored, and in
 * plaintext a database dump alone would drain every invoice address and every
 * custodial escrow vault. Encrypting at rest restores the two-things-must-break
 * property: an attacker needs the database AND the encryption key.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails loudly instead of
 * decrypting to garbage that would be treated as a key.
 *
 * Stored format:  v1.<iv base64>.<authTag base64>.<ciphertext base64>
 * The version prefix lets a future scheme be introduced without guessing.
 */

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32;

let cachedKeys: Buffer[] | null = null;

/** Turn a passphrase or 32-byte hex string into a key. */
function toKey(material: string, info: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(material)) return Buffer.from(material, 'hex');
  return Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(material), Buffer.alloc(0), info, KEY_BYTES)
  );
}

/**
 * Every key this deployment might have encrypted with, newest first.
 *
 * Decryption tries them in order; encryption always uses the first. This is
 * what makes introducing or rotating KEY_ENCRYPTION_KEY safe: without it,
 * adding a key silently orphans everything encrypted under the previous one,
 * and the loss only surfaces later when someone tries to move funds.
 *
 * Rotate with `pnpm rewrap`, which re-encrypts everything under the current
 * primary so the old key can then be retired.
 */
function getKeys(): Buffer[] {
  if (cachedKeys) return cachedKeys;

  const keys: Buffer[] = [];
  const explicit = process.env.KEY_ENCRYPTION_KEY;
  const previous = process.env.KEY_ENCRYPTION_KEY_PREVIOUS;
  const seed = process.env.MASTER_SEED;

  if (explicit) keys.push(toKey(explicit, 'guardpay:keyvault'));
  if (previous) keys.push(toKey(previous, 'guardpay:keyvault'));

  // The seed-derived key is always a decryption candidate, because it is what
  // earlier deployments used before KEY_ENCRYPTION_KEY existed.
  if (seed) {
    keys.push(
      Buffer.from(
        crypto.hkdfSync('sha256', Buffer.from(seed), Buffer.alloc(0), 'guardpay:keyvault:v1', KEY_BYTES)
      )
    );
  }

  if (keys.length === 0) {
    throw new Error(
      'Cannot encrypt key material: set KEY_ENCRYPTION_KEY (preferred) or MASTER_SEED'
    );
  }

  cachedKeys = keys;
  return keys;
}

/** The key new secrets are sealed with. */
function primaryKey(): Buffer {
  return getKeys()[0];
}

/** True when a stored value is already in the encrypted envelope format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`);
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, primaryKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    '.'
  );
}

/**
 * Decrypt a stored secret.
 *
 * Values written before encryption was introduced are returned as-is so an
 * existing database keeps working; `migrateWalletKeys` upgrades them in place.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, tagB64, dataB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret');
  }

  // GCM authentication tells us definitively whether a key is the right one,
  // so trying each candidate is safe — a wrong key throws rather than
  // returning plausible garbage.
  let lastError: Error | null = null;
  for (const key of getKeys()) {
    try {
      const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error: any) {
      lastError = error;
    }
  }

  throw new Error(
    'Could not decrypt stored key material with any configured key. ' +
      'If KEY_ENCRYPTION_KEY was changed, set KEY_ENCRYPTION_KEY_PREVIOUS to the old value ' +
      `and run \`pnpm rewrap\`. (${lastError?.message ?? 'unknown'})`
  );
}

/** True when the value decrypts under the CURRENT primary key. */
export function isUnderPrimaryKey(stored: string): boolean {
  if (!isEncrypted(stored)) return false;
  const [, ivB64, tagB64, dataB64] = stored.split('.');
  try {
    const decipher = crypto.createDecipheriv(ALGO, primaryKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return true;
  } catch {
    return false;
  }
}

/** Only for tests — forces keys to be re-derived. */
export function resetKeyCache() {
  cachedKeys = null;
}
