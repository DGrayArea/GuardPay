import Account from '@/views/Account';

export const metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <Account />;
}
