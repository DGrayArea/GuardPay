
import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import PaymentDemo from '@/components/home/PaymentDemo';
import EscrowExplainer from '@/components/home/EscrowExplainer';
import MerchantPreview from '@/components/home/MerchantPreview';

const Index = () => {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <PaymentDemo />
        <EscrowExplainer />
        <MerchantPreview />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
