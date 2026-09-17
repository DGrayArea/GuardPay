'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Chip from '@/components/ui/Chip';
import { Shield, ArrowRight, User, Store, Lock, Unlock, Check } from 'lucide-react';

const EscrowExplainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 4);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const steps = [
    {
      title: "Buyer initiates escrow",
      description: "The buyer creates an escrow payment, setting terms and timeframes for the transaction.",
      icon: <User size={24} />,
    },
    {
      title: "Funds are secured",
      description: "Payment is held securely in a smart contract, visible on the blockchain but inaccessible to either party.",
      icon: <Lock size={24} />,
    },
    {
      title: "Seller delivers goods/services",
      description: "The seller completes their obligation, knowing the payment is guaranteed and secured.",
      icon: <Store size={24} />,
    },
    {
      title: "Buyer approves release",
      description: "Once satisfied, the buyer releases the funds, which are immediately transferred to the seller.",
      icon: <Unlock size={24} />,
    },
  ];

  return (
    <div id="escrow" className="py-16 sm:py-20 md:py-24 bg-gradient-to-b from-white to-gray-50">
      <div 
        ref={containerRef}
        className="container mx-auto px-5 sm:px-6 transition-all duration-1000 ease-out opacity-0 translate-y-10"
      >
        <div className="flex flex-col md:flex-row-reverse items-center md:items-start justify-between gap-12 md:gap-8">
          <div className="flex flex-col items-start md:max-w-lg">
            <Chip variant="primary" className="mb-6">
              <Shield size={12} className="mr-1.5" />
              Escrow Protection
            </Chip>
            <h2 className="text-balance text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-tight text-ink mb-5 sm:mb-6">Secure transactions with smart contract escrow</h2>
            <p className="text-lg text-ink-soft mb-8">
              Our escrow service protects both buyers and sellers by holding funds in a secure smart contract until both parties fulfill their obligations.
            </p>
            
            <div className="space-y-6 mb-8 w-full">
              {["No more payment disputes", "Transparent transaction tracking", "Automatic fund release", "Multi-signature security"].map((feature, index) => (
                <div key={index} className="flex items-start">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex-shrink-0 flex items-center justify-center mt-0.5 mr-4">
                    <Check size={14} className="text-green-600" />
                  </div>
                  <p className="text-gray-700">{feature}</p>
                </div>
              ))}
            </div>
            
            <Button className="bg-escrow text-white hover:bg-escrow/90">
              Learn More About Escrow
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
          
          <div className="w-full max-w-md">
            <div className="relative p-6 glass-card rounded-2xl shadow-elevation-2 overflow-hidden">
              <div className="mb-8">
                <h3 className="text-xl font-medium mb-2">How Escrow Works</h3>
                <p className="text-sm text-ink-soft">
                  Our escrow service uses secure smart contracts to protect all parties in a transaction.
                </p>
              </div>
              
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                <div className="space-y-8">
                  {steps.map((step, index) => (
                    <div 
                      key={index}
                      className={`flex items-start pl-12 relative transition-all duration-500 ${
                        currentStep === index ? 'opacity-100 scale-100' : 'opacity-50 scale-95'
                      }`}
                    >
                      <div 
                        className={`absolute left-0 h-8 w-8 rounded-full flex items-center justify-center z-10 ${
                          currentStep === index ? 'bg-escrow text-white' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {step.icon}
                      </div>
                      
                      <div className="ml-4">
                        <h4 className={`font-medium mb-1 ${currentStep === index ? 'text-black' : 'text-ink-soft'}`}>
                          {step.title}
                        </h4>
                        <p className="text-sm text-ink-soft">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscrowExplainer;
