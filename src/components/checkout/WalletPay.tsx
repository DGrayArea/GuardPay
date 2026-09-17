'use client';

import React, { useState } from 'react';
import { useAccount, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { parseEther, parseUnits, erc20Abi } from 'viem';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction as SolTransaction,
} from '@solana/web3.js';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Invoice } from '@/lib/api';

/** Chain id per GuardPay chain code. */
const CHAIN_IDS: Record<string, number> = {
  ETH: 11155111, // Sepolia
  BSC: 97, // BSC testnet
  BASE: 84532, // Base Sepolia
};

interface WalletPayProps {
  invoice: Invoice;
}

/**
 * Pays an invoice from a connected wallet.
 *
 * The amount and destination come from the invoice the server issued — never
 * from the page — and the payment is NOT marked complete here. The backend
 * detects the transfer on-chain and confirms it, so a payer cannot mark an
 * order paid by tampering with the client.
 */
const WalletPay: React.FC<WalletPayProps> = ({ invoice }) => {
  const [submitting, setSubmitting] = useState(false);
  const [sentHash, setSentHash] = useState<string | null>(null);

  const isSolana = invoice.chain === 'SOLANA';
  const targetChainId = CHAIN_IDS[invoice.chain];

  // EVM
  const { address: evmAddress, isConnected: isEvmConnected, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  // Solana
  const { connection } = useConnection();
  const { publicKey: solPublicKey, sendTransaction: sendSolTransaction } = useWallet();

  const payEVM = async () => {
    if (!evmAddress) return;

    setSubmitting(true);
    try {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      let hash: `0x${string}`;

      if (invoice.tokenAddress) {
        // An ERC-20 payment is a transfer() call on the token, not a value
        // transfer — sending ETH to the token address would lose the funds.
        hash = await writeContractAsync({
          address: invoice.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [
            invoice.paymentAddress as `0x${string}`,
            parseUnits(invoice.expectedAmount, invoice.tokenDecimals ?? 6),
          ],
          account: evmAddress,
          chain: undefined,
        });
      } else {
        hash = await sendTransactionAsync({
          account: evmAddress,
          to: invoice.paymentAddress as `0x${string}`,
          // The exact amount the server quoted for this invoice.
          value: parseEther(invoice.expectedAmount),
        });
      }

      setSentHash(hash);
      toast.success('Transaction sent — waiting for confirmation');
    } catch (err: any) {
      const rejected = /reject|denied/i.test(err?.message ?? '');
      toast.error(rejected ? 'Transaction rejected' : 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const paySolana = async () => {
    const destination = invoice.solanaAddress ?? invoice.paymentAddress;
    if (!solPublicKey || !destination) return;

    setSubmitting(true);
    try {
      const transaction = new SolTransaction();

      if (invoice.tokenAddress) {
        // SPL transfer, creating the invoice address's token account if needed.
        const { getAssociatedTokenAddressSync, createTransferInstruction,
          createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } =
          await import('@solana/spl-token');

        const mint = new PublicKey(invoice.tokenAddress);
        const owner = new PublicKey(destination);
        const fromAta = getAssociatedTokenAddressSync(mint, solPublicKey, true);
        const toAta = getAssociatedTokenAddressSync(mint, owner, true);

        if (!(await connection.getAccountInfo(toAta))) {
          transaction.add(
            createAssociatedTokenAccountInstruction(solPublicKey, toAta, owner, mint)
          );
        }

        transaction.add(
          createTransferInstruction(
            fromAta,
            toAta,
            solPublicKey,
            BigInt(
              Math.round(Number(invoice.expectedAmount) * 10 ** (invoice.tokenDecimals ?? 6))
            ),
            [],
            TOKEN_PROGRAM_ID
          )
        );
      } else {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: solPublicKey,
            toPubkey: new PublicKey(destination),
            lamports: Math.round(Number(invoice.expectedAmount) * LAMPORTS_PER_SOL),
          })
        );
      }

      const signature = await sendSolTransaction(transaction, connection);
      setSentHash(signature);
      toast.success('Transaction sent — waiting for confirmation');
    } catch (err: any) {
      const rejected = /reject|denied/i.test(err?.message ?? '');
      toast.error(rejected ? 'Transaction rejected' : 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sentHash) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <p className="text-sm font-medium text-blue-900">Transaction submitted</p>
        <p className="mt-1 text-xs text-blue-700">
          This page updates automatically once the network confirms it.
        </p>
        <code className="mt-2 block break-all font-mono text-xs text-blue-800">
          {sentHash}
        </code>
      </div>
    );
  }

  if (!isSolana && !targetChainId) {
    return (
      <p className="text-center text-sm text-gray-500">
        In-wallet payment is not available for {invoice.chain}. Send to the address above instead.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {isSolana ? (
        <>
          <div className="flex justify-center">
            <WalletMultiButton />
          </div>
          {solPublicKey && (
            <Button onClick={paySolana} disabled={submitting} size="lg" className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay {invoice.expectedAmount} {invoice.crypto}
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <ConnectKitButton />
          </div>
          {isEvmConnected && (
            <Button onClick={payEVM} disabled={submitting} size="lg" className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {chainId !== targetChainId
                ? 'Switch network & pay'
                : `Pay ${invoice.expectedAmount} ${invoice.crypto}`}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default WalletPay;
