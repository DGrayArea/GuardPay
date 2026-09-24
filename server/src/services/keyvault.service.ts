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

let cachedKey: Buffer | null = null;

/**
 * Derive the data-encryption key.
 *
 * Prefers an explicit KEY_ENCRYPTION_KEY so the encryption key can live in a
 * KMS and be rotated independently of the wallet seed. Falls back to deriving
 * from MASTER_SEED, which keeps local development working — but note that the
 * fallback means one secret protects both, so production should set the
 * explicit key.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const explicit = process.env.KEY_ENCRYPTION_KEY;
  if (explicit) {
    // Accept either 32 raw bytes as hex/base64, or any passphrase.
    const asHex = /^[0-9a-fA-F]{64}$/.test(explicit) ? Buffer.from(explicit, 'hex') : null;
    cachedKey =
      asHex ??
      crypto.hkdfSync('sha256', Buffer.from(explicit), Buffer.alloc(0), 'guardpay:keyvault', KEY_BYTES) as unknown as Buffer;
    cachedKey = Buffer.from(cachedKey);
    return cachedKey;
  }

  const seed = process.env.MASTER_SEED;
  if (!seed) {
    throw new Error(
      'Cannot encrypt key material: set KEY_ENCRYPTION_KEY (preferred) or MASTER_SEED'
    );
  }

  // A distinct info string, so this key is unrelated to anything else derived
  // from the same seed.
  cachedKey = Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(seed), Buffer.alloc(0), 'guardpay:keyvault:v1', KEY_BYTES)
  );
  return cachedKey;
}

/** True when a stored value is already in the encrypted envelope format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`);
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
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

  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Only for tests — forces the key to be re-derived. */
export function resetKeyCache() {
  cachedKey = null;
}
