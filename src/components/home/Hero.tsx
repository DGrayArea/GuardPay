
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Chip from '@/components/ui/Chip';
import { ArrowRight, Shield } from 'lucide-react';

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
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
  
  return (
    <div className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div 
        ref={containerRef} 
        className="container mx-auto px-6 transition-all duration-1000 ease-out opacity-0 translate-y-10"
      >
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <Chip variant="primary" size="md" className="mb-6">
            Web3 Payments Reimagined
          </Chip>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight md:leading-tight mb-6">
            The simplest way to accept <span className="text-web3-blue">crypto payments</span> with escrow protection
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl">
            GuardPay provides merchants and customers a secure, transparent payment gateway with built-in escrow services for peace of mind.
          </p>
          
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <Button className="px-6 py-6 text-base font-medium rounded-xl transition-all hover:translate-y-[-2px] bg-web3-blue text-white hover:bg-opacity-90">
              Start Accepting Payments
              <ArrowRight size={18} className="ml-2" />
            </Button>
            <Button variant="outline" className="px-6 py-6 text-base font-medium rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50">
              Explore Escrow Service
              <Shield size={18} className="ml-2" />
            </Button>
          </div>
          
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
            {[
              { label: "Merchants", value: "2,500+" },
              { label: "Daily Transactions", value: "10,000+" },
              { label: "Payment Volume", value: "$25M+" },
              { label: "Supported Chains", value: "15+" }
            ].map((stat, index) => (
              <div key={index} className="flex flex-col items-center">
                <p className="text-2xl md:text-3xl font-bold text-web3-blue mb-1">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
