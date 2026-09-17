import Escrow from '@/views/Escrow';

export const metadata = {
  title: 'Escrow',
  description:
    'Smart-contract escrow for crypto transactions. Funds are locked on-chain until both sides are satisfied, with dispute resolution built in.',
  alternates: { canonical: '/escrow' },
};

export default function EscrowPage() {
  return <Escrow />;
}
