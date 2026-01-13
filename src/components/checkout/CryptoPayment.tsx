
import React, { useState, useEffect } from 'react';
import { PaymentLink, api } from '@/lib/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from "react-qr-code";

// EVM Hooks
import { useAccount, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectKitButton } from "connectkit";
import { parseEther } from 'viem';

// Solana Hooks
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction as SolTransaction, SystemProgram } from '@solana/web3.js';

interface CryptoPaymentProps {
  link: PaymentLink;
}

const EVM_NETWORKS = {
  ETH: { id: 11155111, name: 'Sepolia', currency: 'ETH' }, // Wagmi uses numbers
  BSC: { id: 97, name: 'BSC Testnet', currency: 'tBNB' },
  POLYGON: { id: 80002, name: 'Polygon Amoy', currency: 'MATIC' },
  BASE: { id: 84532, name: 'Base Sepolia', currency: 'ETH' }
};

type Chain = keyof typeof EVM_NETWORKS | 'SOLANA';

const CryptoPayment: React.FC<CryptoPaymentProps> = ({ link }) => {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [chain, setChain] = useState<Chain>('ETH');
  
  const [merchantAddress, setMerchantAddress] = useState('');
  const [solMerchantAddress, setSolMerchantAddress] = useState('');

  // EVM Hooks
  const { address: evmAddress, isConnected: isEvmConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  // Solana Hooks
  const { connection } = useConnection();
  const { publicKey: solPublicKey, sendTransaction: sendSolTransaction } = useWallet();

  // Fetch Settings
  useEffect(() => {
    const loadSettings = async () => {
        const s = await api.getSettings();
        setMerchantAddress(link.walletAddress || s.receivingAddress);
        setSolMerchantAddress(link.solanaAddress || s.solanaAddress);
    };
    loadSettings();
  }, [link]);

  const recordTransaction = async (hash: string, amount: string, crypto: string) => {
    await api.createTransaction({
        linkId: link.id,
        linkTitle: link.title,
        amount: link.price,
        currency: link.currency,
        cryptoAmount: parseFloat(amount),
        status: 'completed',
        txHash: hash,
        customer: crypto === 'SOLANA' ? solPublicKey?.toString() : evmAddress,
        type: 'direct',
        chain: chain
    });
    setStatus('completed');
    toast.success("Payment Confirmed!");
  }

  const handlePayEVM = async () => {
    if (!merchantAddress) return toast.error("Merchant EVM address missing");
    
    const targetChainId = EVM_NETWORKS[chain as keyof typeof EVM_NETWORKS].id;
    if (chainId !== targetChainId) {
        switchChain({ chainId: targetChainId });
        return; 
    }

    setStatus('processing');
    try {
        const hash = await sendTransactionAsync({
            to: merchantAddress as `0x${string}`,
            value: parseEther("0.00001"), 
        });
        
        toast.info("Transaction sent! Waiting for confirmation...");
        setTimeout(() => recordTransaction(hash, "0.00001", chain), 5000);

    } catch (e: any) {
        console.error(e);
        setStatus('pending');
        toast.error("Payment Failed");
    }
  };

  const handlePaySolana = async () => {
    if (!solMerchantAddress || !solPublicKey) return toast.error("Setup incomplete");

    setStatus('processing');
    try {
        const transaction = new SolTransaction().add(
            SystemProgram.transfer({
                fromPubkey: solPublicKey,
                toPubkey: new PublicKey(solMerchantAddress),
                lamports: 10000, 
            })
        );

        const signature = await sendSolTransaction(transaction, connection);
        toast.info("Transaction sent! Confirming...");
        
        const latestBlockHash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            signature: signature,
        });

        await recordTransaction(signature, "0.00001", "SOLANA");

    } catch (e) {
        console.error(e);
        setStatus('pending');
        toast.error("Solana Payment Failed");
    }
  }

  if (status === 'completed') {
    return (
      <Card className="w-full max-w-md mx-auto text-center border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Payment Successful!</h2>
          <Button onClick={() => window.location.reload()} variant="outline">
            Pay Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isEVM = chain !== 'SOLANA';
  const targetAddress = isEVM ? merchantAddress : solMerchantAddress;

  return (
    <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-web3-blue">
      <CardHeader className="text-center border-b pb-6">
        <div className="mb-2 text-sm uppercase tracking-wider text-gray-500 font-semibold">Pay with Crypto</div>
        <CardTitle className="text-2xl">{link.title}</CardTitle>
        <div className="mt-2 text-3xl font-bold text-web3-blue">
            {link.price} <span className="text-lg text-gray-500 font-normal">{link.currency}</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Network</label>
            <div className="flex flex-wrap gap-2">
                {(['ETH', 'BSC', 'POLYGON', 'BASE', 'SOLANA'] as Chain[]).map((c) => (
                    <button
                        key={c}
                        onClick={() => setChain(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            chain === c 
                            ? 'bg-gray-900 text-white border-gray-900' 
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                        }`}
                    >
                        {c}
                    </button>
                ))}
            </div>
          </div>

        <Tabs defaultValue="wallet" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="wallet">Connect Wallet</TabsTrigger>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
          </TabsList>
          
          <TabsContent value="wallet" className="space-y-4">
            {isEVM ? (
                <div className="space-y-4 text-center">
                    <div className="flex justify-center">
                        <ConnectKitButton />
                    </div>
                    {isEvmConnected && (
                         <Button 
                            onClick={handlePayEVM} 
                            className="w-full"
                            size="lg"
                            disabled={status === 'processing'}
                        >
                            {status === 'processing' ? <RefreshCw className="animate-spin mr-2" /> : ''}
                            {chainId !== EVM_NETWORKS[chain as keyof typeof EVM_NETWORKS].id ? 'Switch Network' : 'Pay Now'}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4 text-center">
                    <div className="flex justify-center solana-custom-btn-container">
                        <WalletMultiButton />
                    </div>
                    {solPublicKey && (
                        <Button 
                            onClick={handlePaySolana} 
                            className="w-full"
                            size="lg"
                            disabled={status === 'processing'}
                            style={{ backgroundColor: '#AB9FF2' }}
                        >
                           {status === 'processing' ? <RefreshCw className="animate-spin mr-2" /> : 'Pay via Solana'}
                        </Button>
                    )}
                </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="space-y-4 text-center flex flex-col items-center">
             <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 bg-white">
                {targetAddress ? (
                    <QRCode value={targetAddress} size={150} />
                ) : (
                    <div className="h-[150px] w-[150px] bg-gray-100 flex items-center justify-center text-xs text-center text-gray-500">
                        Address missing
                    </div>
                )}
             </div>
             <p className="text-xs text-gray-500 break-all font-mono bg-gray-100 p-2 rounded mt-4 w-full text-center">
                 {targetAddress || "Configure address in Settings"}
             </p>
             <Button variant="outline" className="w-full mt-2" onClick={() => {
                 navigator.clipboard.writeText(targetAddress);
                 toast.success("Address copied");
             }}>
                 <Copy className="mr-2 h-4 w-4" /> Copy Address
             </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CryptoPayment;
