
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, PaymentLink } from '@/lib/api';
import CryptoPayment from '@/components/checkout/CryptoPayment';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Payment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | false>(false);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        if (id) {
            // CoinGate Flow: Create Generic Invoice (Order) from Link
            const newInvoice = await api.createInvoice(id);
            // Redirect to unique Invoice Page
            navigate(`/invoice/${newInvoice.id}`);
        }
      } catch (err) {
        setError("Invalid Payment Link");
        setLoading(false);
      }
    };

    fetchLink();
  }, [id, navigate]);

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-web3-blue"></div>
             <span className="ml-3 text-sm text-gray-500">Creating secure invoice...</span>
        </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Link not found</h1>
          <p className="text-gray-500 mt-2">The payment link you are looking for does not exist or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <CryptoPayment link={link} />
    </div>
  );
};

export default Payment;
