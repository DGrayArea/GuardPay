/**
 * Base Commerce Payments Protocol.
 *
 * Audited by Spearbit and Coinbase Protocol Security. GuardPay acts as the
 * *operator*: it drives authorize / capture / void / refund, but never takes
 * custody — funds move from the payer into the escrow contract and out to the
 * receiver without passing through any GuardPay-controlled address.
 *
 * Addresses are identical on Base mainnet and Base Sepolia (CREATE2).
 * Source: https://github.com/base/commerce-payments (v1.1.0)
 */

export const COMMERCE_PAYMENTS = {
  authCaptureEscrow: '0xf96815976523E00e65Be8f34cA5e64b4f41EB19c',
  collectors: {
    erc3009: '0x8612dfdc421f80336cd14E8EF9cb1E765dB5ab88',
    permit2: '0xD69831Aed5bfe262067ec4c751f4F830EcdD446e',
    preApproval: '0xF1F9C408C787B2bC6CAEB91e5BbEc434a5c8d2Ea',
    spendPermission: '0xB508c1C0a13849693DC175307667653C5977a408',
  },
  operatorRefundCollector: '0x7a03443724d14798c4AB4622F1DAAcA761Fea486',
} as const;

/** Settlement assets per chain. Escrow is stablecoin-denominated by design. */
export const ESCROW_TOKENS: Record<string, { address: string; symbol: string; decimals: number }> = {
  // Base Sepolia USDC (circle testnet).
  'base-sepolia': {
    address: process.env.ESCROW_TOKEN_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    decimals: 6,
  },
  base: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
  },
};

export const AUTH_CAPTURE_ESCROW_ABI = [
  // --- struct ---------------------------------------------------------------
  'function getHash((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo) view returns (bytes32)',
  'function paymentState(bytes32 paymentInfoHash) view returns (bool hasCollectedPayment, uint120 capturableAmount, uint120 refundableAmount)',

  // --- operator actions -----------------------------------------------------
  'function authorize((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo, uint256 amount, address tokenCollector, bytes collectorData)',
  'function capture((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo, uint256 amount, uint256 feeAmount, address feeReceiver)',
  'function charge((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo, uint256 amount, address tokenCollector, bytes collectorData, uint256 feeAmount, address feeReceiver)',
  'function void((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo)',
  'function refund((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo, uint256 amount, address tokenCollector, bytes collectorData)',

  // --- payer self-service ---------------------------------------------------
  // Lets the buyer recover funds without GuardPay's cooperation once the
  // authorization window lapses. This is what keeps the design trust-minimised.
  'function reclaim((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo)',

  // --- events ---------------------------------------------------------------
  'event PaymentAuthorized(bytes32 indexed paymentInfoHash, tuple(address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo, uint256 amount, address tokenCollector)',
  'event PaymentCaptured(bytes32 indexed paymentInfoHash, uint256 amount, uint256 feeAmount, address feeReceiver)',
  'event PaymentVoided(bytes32 indexed paymentInfoHash, uint256 amount)',
  'event PaymentReclaimed(bytes32 indexed paymentInfoHash, uint256 amount)',
  'event PaymentRefunded(bytes32 indexed paymentInfoHash, uint256 amount, address tokenCollector)',
] as const;

export const PRE_APPROVAL_COLLECTOR_ABI = [
  'function preApprove((address operator,address payer,address receiver,address token,uint120 maxAmount,uint48 preApprovalExpiry,uint48 authorizationExpiry,uint48 refundExpiry,uint16 minFeeBps,uint16 maxFeeBps,address feeReceiver,uint256 salt) paymentInfo)',
] as const;

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const;
