'use client';

import React, { useEffect, useRef } from 'react';
import Chip from '@/components/ui/Chip';
import { Shield, Zap, CreditCard, LockKeyhole, Server, ArrowUpDown } from 'lucide-react';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const Feature: React.FC<FeatureProps> = ({ icon, title, description }) => {
  return (
    <div className="flex flex-col items-start p-6 rounded-2xl glass-card hover:shadow-elevation-2 transition-all duration-300 ease-in-out">
      <div className="mb-4 inline-flex rounded-xl bg-brand-soft p-3 text-brand">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-ink-soft text-sm">{description}</p>
    </div>
  );
};

const Features: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      containerRef.current?.classList.remove('opacity-0', 'translate-y-10');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      },
      {
        root: null,
        threshold: 0.1,
      }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const features = [
    {
      icon: <Zap size={24} />,
      title: "Lightning Fast Payments",
      description: "Process transactions in seconds with our optimized payment network across multiple blockchains."
    },
    {
      icon: <Shield size={24} />,
      title: "Escrow Protection",
      description: "Secure transactions with our built-in escrow service that ensures both parties fulfill their obligations."
    },
    {
      icon: <CreditCard size={24} />,
      title: "Multiple Currencies",
      description: "Accept payments in popular cryptocurrencies and stablecoins with automatic conversion options."
    },
    {
      icon: <LockKeyhole size={24} />,
      title: "Enterprise Security",
      description: "Bank-grade security with multi-signature wallets, cold storage, and advanced encryption."
    },
    {
      icon: <Server size={24} />,
      title: "Developer Friendly",
      description: "Comprehensive APIs and SDKs make integration simple for developers of all skill levels."
    },
    {
      icon: <ArrowUpDown size={24} />,
      title: "Low Transaction Fees",
      description: "Save on payment processing with our competitive fee structure optimized for web3 transactions."
    }
  ];

  return (
    <div className="py-16 sm:py-20 md:py-24 bg-muted/40">
      <div 
        ref={containerRef}
        className="container mx-auto px-5 sm:px-6 transition-all duration-1000 ease-out opacity-0 translate-y-10"
      >
        <div className="flex flex-col items-center text-center mb-16">
          <Chip variant="secondary" className="mb-6">Core Features</Chip>
          <h2 className="text-balance text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-tight text-ink mb-5 sm:mb-6">Everything you need for web3 payments</h2>
          <p className="text-lg text-ink-soft max-w-2xl">
            Our complete payment infrastructure gives you the tools to accept, manage and protect cryptocurrency transactions.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
          {features.map((feature, index) => (
            <Feature
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;
