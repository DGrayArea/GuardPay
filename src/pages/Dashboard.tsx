
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardHome from '@/components/dashboard/DashboardHome';
import PaymentLinks from '@/components/dashboard/PaymentLinks';
import DashboardPayments from '@/components/dashboard/DashboardPayments';
import DashboardWallet from '@/components/dashboard/DashboardWallet';
import DashboardAnalytics from '@/components/dashboard/DashboardAnalytics';
import DashboardSettings from '@/components/dashboard/DashboardSettings';

const Dashboard: React.FC = () => {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/links" element={<PaymentLinks />} />
        <Route path="/payments" element={<DashboardPayments />} />
        <Route path="/wallet" element={<DashboardWallet />} />
        <Route path="/analytics" element={<DashboardAnalytics />} />
        <Route path="/settings" element={<DashboardSettings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;
