import Invoice from '@/views/Invoice';

export const metadata = {
  title: 'Checkout',
  // A checkout session is private and single-use.
  robots: { index: false, follow: false },
};

export default function InvoicePage() {
  return <Invoice />;
}
