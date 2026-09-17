'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Creates an invoice for a payment link and redirects to its checkout page.
 */
const PayRedirect: React.FC<{ linkId: string }> = ({ linkId }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in dev; without this guard the
  // visitor would silently burn two invoices (and two payment addresses).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const invoice = await api.createInvoice(linkId);
        router.replace(`/invoice/${invoice.id}`);
      } catch (err: any) {
        setError(
          err?.response?.status === 404
            ? 'This payment link does not exist or has been removed.'
            : 'Something went wrong creating your invoice. Please try again.'
        );
      }
    })();
  }, [linkId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Link not available</h1>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-web3-blue" />
      <span className="ml-3 text-sm text-gray-500">Creating secure invoice…</span>
    </div>
  );
};

export default PayRedirect;
