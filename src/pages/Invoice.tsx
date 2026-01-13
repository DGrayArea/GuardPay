
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, Invoice as InvoiceType } from '@/lib/api';
import CryptoPayment from '@/components/checkout/CryptoPayment';
import { Clock, AlertTriangle } from 'lucide-react';

const Invoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const data = await api.getInvoice(id);
      if (data) {
        setInvoice(data);
        const expires = new Date(data.expiresAt).getTime();
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((expires - now) / 1000)));
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Timer
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
            clearInterval(interval);
            api.updateInvoiceStatus(invoice.id, 'expired');
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Invoice...</div>;
  if (!invoice) return <div className="min-h-screen flex items-center justify-center">Invoice Not Found</div>;

  if (invoice.status === 'expired') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Expired</h2>
                <p className="text-gray-500 mb-6">This payment session has timed out. Please initiate a new payment.</p>
                <button 
                  onClick={() => window.history.back()}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium"
                >
                    Go Back
                </button>
            </div>
        </div>
      );
  }

  // Construct a pseudo-link object for CryptoPayment to use (adaptor)
  // In a real refactor, CryptoPayment would accept Invoice directly
  const paymentLinkAdaptor = {
      id: invoice.linkId,
      title: invoice.linkTitle || "Payment",
      price: invoice.amount,
      currency: invoice.currency as 'USD' | 'EUR',
      crypto: 'ETH', // Default
      createdAt: invoice.createdAt,
      walletAddress: invoice.walletAddress,
      solanaAddress: invoice.solanaAddress
  };

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

      <div className="w-full max-w-lg">
          {/* Pass the Invoice Context down? For now reusing CryptoPayment */}
          <CryptoPayment link={paymentLinkAdaptor as any} />
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">
        Ref: {invoice.id}
      </div>
    </div>
  );
};

export default Invoice;
