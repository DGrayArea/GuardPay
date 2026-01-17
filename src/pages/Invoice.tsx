import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, Invoice as InvoiceType } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';

const Invoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Load invoice
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await api.getInvoice(id);
        if (data) {
          setInvoice(data);
          const expires = new Date(data.expiresAt).getTime();
          const now = new Date().getTime();
          setTimeLeft(Math.max(0, Math.floor((expires - now) / 1000)));
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        toast.error('Failed to load invoice');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Poll for payment status
  useEffect(() => {
    if (!id || !invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getInvoiceStatus(id);
        if (status.status !== invoice.status) {
          setInvoice(prev => prev ? { ...prev, status: status.status as any, paidAt: status.paidAt } : null);
          
          if (status.status === 'paid') {
            toast.success('Payment received!');
          }
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [id, invoice]);

  // Countdown timer
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setInvoice(curr => curr ? { ...curr, status: 'expired' } : null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copyAddress = () => {
    const address = invoice?.chain === 'SOLANA' ? invoice.solanaAddress : invoice?.paymentAddress;
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  };

  const getExplorerUrl = (txHash: string, chain: string) => {
    const explorers: { [key: string]: string } = {
      ETH: `https://sepolia.etherscan.io/tx/${txHash}`,
      BSC: `https://testnet.bscscan.com/tx/${txHash}`,
      SOLANA: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    };
    return explorers[chain] || '#';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-web3-blue mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invoice Not Found</h2>
            <p className="text-gray-600">This invoice does not exist or has been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Expired</h2>
            <p className="text-gray-500 mb-6">This payment session has timed out. Please create a new invoice.</p>
            <button 
              onClick={() => window.history.back()}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition"
            >
              Go Back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Received!</h2>
            <p className="text-gray-500 mb-6">Your payment has been confirmed.</p>
            
            {invoice.transactions && invoice.transactions.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Transaction Hash:</p>
                <a
                  href={getExplorerUrl(invoice.transactions[0].txHash, invoice.chain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-web3-blue hover:underline text-sm font-mono flex items-center justify-center gap-2"
                >
                  {invoice.transactions[0].txHash.substring(0, 10)}...{invoice.transactions[0].txHash.substring(invoice.transactions[0].txHash.length - 8)}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentAddress = invoice.chain === 'SOLANA' ? invoice.solanaAddress : invoice.paymentAddress;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      
      {/* Timer Bar */}
      <div className="bg-white rounded-full px-6 py-2 shadow-sm border border-gray-100 flex items-center space-x-3 mb-8">
        <Clock size={16} className="text-web3-blue" />
        <span className="text-sm font-medium text-gray-600">Rate locked for</span>
        <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-gray-900'}`}>
          {formatTime(timeLeft)}
        </span>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center">
            {invoice.linkTitle || 'Payment Invoice'}
          </CardTitle>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {invoice.expectedAmount} {invoice.crypto}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ${invoice.amount.toFixed(2)} {invoice.currency}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="bg-white p-6 rounded-xl border-2 border-gray-100 flex justify-center">
            <QRCode
              value={paymentAddress || ''}
              size={200}
              level="H"
            />
          </div>

          {/* Payment Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Send {invoice.crypto} to this address ({invoice.chain}):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={paymentAddress || ''}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm"
              />
              <button
                onClick={copyAddress}
                className="px-4 py-2 bg-web3-blue text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm font-medium text-blue-900">
                {invoice.status === 'confirming' ? 'Confirming payment...' : 'Waiting for payment...'}
              </p>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Payment will be confirmed automatically once received
            </p>
          </div>

          {/* Transactions */}
          {invoice.transactions && invoice.transactions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Transactions:</label>
              {invoice.transactions.map((tx: any) => (
                <div key={tx.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-gray-900">
                      {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.confirmations} confirmations • {tx.status}
                    </p>
                  </div>
                  <a
                    href={getExplorerUrl(tx.txHash, invoice.chain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-web3-blue hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center text-sm text-gray-400">
        Invoice ID: {invoice.id}
      </div>
    </div>
  );
};

export default Invoice;
