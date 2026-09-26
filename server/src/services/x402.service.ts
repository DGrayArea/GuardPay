import {
  createWalletClient,
  getAddress,
  http,
  parseAbi,
  publicActions,
  type Chain,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { x402Facilitator } from '@x402/core/facilitator';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/facilitator';
import { toFacilitatorEvmSigner } from '@x402/evm';
import * as bip39 from 'bip39';
import { ethers } from 'ethers';

/**
 * GuardPay as an x402 facilitator.
 *
 * x402 is an open protocol, not a service: a resource server answers `402
 * Payment Required` with its terms, the client retries carrying a signed
 * authorization, and a *facilitator* verifies that signature and settles it
 * on-chain. Being the facilitator — rather than pointing at someone else's —
 * is what makes this GuardPay infrastructure instead of GuardPay integration,
 * and it reuses machinery that already exists here: signature verification,
 * transaction submission, merchant accounts and webhooks.
 *
 * Crucially, settlement uses EIP-3009 `transferWithAuthorization`: the payer
 * signs, GuardPay submits and pays the gas, and the tokens move payer → payee
 * directly. GuardPay never takes custody, and never needs the payer's key.
 */

/** CAIP-2 network ids the facilitator answers for. */
const NETWORKS: Record<
  string,
  { chain: Chain; rpcEnv: string; fallbackRpc: string; label: string }
> = {
  'eip155:84532': {
    chain: baseSepolia,
    rpcEnv: 'BASE_RPC_URL',
    fallbackRpc: 'https://sepolia.base.org',
    label: 'Base Sepolia',
  },
  'eip155:8453': {
    chain: base,
    rpcEnv: 'BASE_MAINNET_RPC_URL',
    fallbackRpc: 'https://mainnet.base.org',
    label: 'Base',
  },
};

/** Only testnet is enabled unless explicitly opted in. */
const ENABLED_NETWORKS = (process.env.X402_NETWORKS || 'eip155:84532')
  .split(',')
  .map((n) => n.trim())
  .filter((n) => NETWORKS[n]);

class X402Service {
  private facilitator: x402Facilitator | null = null;
  private signerAddress: string | null = null;
  private initError: string | null = null;
  private readers = new Map<string, PublicClient>();
  private domains = new Map<string, { name: string; version: string }>();

  constructor() {
    try {
      this.initialize();
    } catch (error: any) {
      // A misconfigured facilitator must not stop the rest of the API booting.
      this.initError = error?.message ?? 'x402 facilitator failed to initialize';
      console.warn(`⚠️  x402 facilitator unavailable: ${this.initError}`);
    }
  }

  private operatorKey(): `0x${string}` {
    const explicit = process.env.OPERATOR_PRIVATE_KEY;
    if (explicit) return explicit as `0x${string}`;

    const seed = process.env.MASTER_SEED;
    if (!seed || !bip39.validateMnemonic(seed)) {
      throw new Error('No OPERATOR_PRIVATE_KEY and no usable MASTER_SEED');
    }

    // Same path as the escrow operator: this is a gas-paying relayer identity,
    // deliberately separate from the payment-address derivation path.
    const root = ethers.HDNodeWallet.fromSeed(bip39.mnemonicToSeedSync(seed));
    return root.derivePath("44'/60'/7'/0/0").privateKey as `0x${string}`;
  }

  private initialize() {
    if (ENABLED_NETWORKS.length === 0) {
      throw new Error('No supported x402 networks enabled');
    }

    const account = privateKeyToAccount(this.operatorKey());
    this.signerAddress = account.address;

    const facilitator = new x402Facilitator();

    for (const network of ENABLED_NETWORKS) {
      const cfg = NETWORKS[network];
      const client = createWalletClient({
        account,
        chain: cfg.chain,
        transport: http(process.env[cfg.rpcEnv] || cfg.fallbackRpc),
      }).extend(publicActions);
      this.readers.set(network, client as unknown as PublicClient);

      // The helper reads a flat `address`, while a viem wallet client carries
      // it on `account` — without this the scheme reports a null signer.
      const signer = toFacilitatorEvmSigner(
        Object.assign(client, { address: account.address }) as never,
        {
          // Bound the receipt wait below a typical gateway timeout, so a slow
          // block reports settlement_pending with the hash rather than the
          // request being killed mid-wait and the payer left not knowing.
          confirmationTimeoutMs: Number(process.env.X402_CONFIRM_TIMEOUT_MS || 60_000),
        }
      );
      facilitator.register(network as never, new ExactEvmScheme(signer));
    }

    this.facilitator = facilitator;
    console.log(
      `✅ x402 facilitator ready (${this.signerAddress} on ${ENABLED_NETWORKS.join(', ')})`
    );
  }

  get isConfigured() {
    return this.facilitator !== null;
  }

  get unavailableReason() {
    return this.initError;
  }

  get address() {
    return this.signerAddress;
  }

  get networks() {
    return ENABLED_NETWORKS;
  }

  private client(): x402Facilitator {
    if (!this.facilitator) {
      throw new Error(this.initError ?? 'x402 facilitator is not configured');
    }
    return this.facilitator;
  }

  /** Payment kinds and signer addresses this facilitator supports. */
  getSupported() {
    return this.client().getSupported();
  }

  /**
   * Check a signed authorization without moving anything.
   * A resource server calls this before serving the response.
   */
  async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.client().verify(payload, requirements);
  }

  /**
   * Broadcast the authorization. GuardPay pays the gas; the tokens move
   * directly from payer to payee.
   */
  async settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    return this.client().settle(payload, requirements);
  }

  /**
   * EIP-712 domain of an EIP-3009 token, read from the contract. The scheme
   * checks name and version on-chain, so a guessed value would fail verify.
   */
  async tokenDomain(network: string, asset: string) {
    const key = `${network}:${asset.toLowerCase()}`;
    const cached = this.domains.get(key);
    if (cached) return cached;

    const reader = this.readers.get(network);
    if (!reader) throw new Error(`x402 network ${network} is not enabled`);

    const abi = parseAbi([
      'function name() view returns (string)',
      'function version() view returns (string)',
    ]);
    const address = getAddress(asset);
    const [name, version] = await Promise.all([
      reader.readContract({ address, abi, functionName: 'name' }),
      reader.readContract({ address, abi, functionName: 'version' }),
    ]);
    const domain = { name, version };
    this.domains.set(key, domain);
    return domain;
  }

  /**
   * Stable identity for a payment authorization, used for replay protection.
   *
   * EIP-3009 authorizations carry a unique nonce and the token contract itself
   * rejects a reused one — but that rejection costs a broadcast transaction and
   * gas. Recording the nonce lets a duplicate settle be refused before it is
   * ever submitted.
   */
  paymentId(payload: PaymentPayload): string | null {
    const p = payload as any;
    const authorization =
      p?.payload?.authorization ?? p?.payload?.permit ?? p?.payload ?? null;
    const nonce = authorization?.nonce ?? p?.nonce ?? null;
    return nonce ? String(nonce) : null;
  }
}

export const x402Service = new X402Service();
