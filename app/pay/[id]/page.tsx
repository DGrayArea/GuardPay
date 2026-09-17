import PayRedirect from '@/components/checkout/PayRedirect';

export const metadata = {
  title: 'Payment',
  robots: { index: false, follow: false },
};

/**
 * A shareable payment link. Opening it mints a fresh invoice (its own address
 * and rate lock) and forwards to that invoice's checkout page — so the same
 * link can be pasted anywhere and reused by many payers.
 */
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayRedirect linkId={id} />;
}
