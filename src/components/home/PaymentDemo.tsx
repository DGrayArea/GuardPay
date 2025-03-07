
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Chip from '@/components/ui/Chip';
import { CreditCard, ChevronRight, Check } from 'lucide-react';

const PaymentDemo: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  
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

  const handleNext = () => {
    if (step < 3) {
      setLoading(true);
      setTimeout(() => {
        setStep(step + 1);
        setLoading(false);
      }, 800);
    } else {
      setLoading(true);
      setTimeout(() => {
        setCompleted(true);
        setLoading(false);
      }, 1000);
    }
  };

  const handleReset = () => {
    setStep(1);
    setCompleted(false);
  };

  const currencies = [
    { id: 'eth', name: 'Ethereum', symbol: 'ETH', balance: '1.45 ETH', logo: '🔷' },
    { id: 'usdc', name: 'USD Coin', symbol: 'USDC', balance: '2,500 USDC', logo: '💲' },
    { id: 'usdt', name: 'Tether', symbol: 'USDT', balance: '1,800 USDT', logo: '💵' },
  ];

  return (
    <div id="payments" className="py-16 md:py-24">
      <div 
        ref={containerRef}
        className="container mx-auto px-6 transition-all duration-1000 ease-out opacity-0 translate-y-10"
      >
        <div className="flex flex-col md:flex-row items-center md:justify-between gap-12 md:gap-8">
          <div className="flex flex-col items-start md:max-w-md">
            <Chip variant="primary" className="mb-6">Payment Demo</Chip>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Complete transactions in just seconds</h2>
            <p className="text-lg text-gray-600 mb-8">
              Experience how easy it is to make crypto payments with our lightning-fast checkout process designed for the modern web.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Connect your preferred wallet",
                "Select currency and payment amount",
                "Approve transaction securely",
                "Receive instant confirmation"
              ].map((item, index) => (
                <li key={index} className="flex items-center">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <Check size={12} className="text-green-600" />
                  </span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="w-full max-w-md p-1 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-elevation-2">
            <div className="bg-white rounded-xl p-6 w-full">
              {!completed ? (
                <>
                  <div className="flex justify-between items-center mb-8">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div 
                          className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${
                            i < step ? 'bg-green-500 text-white' : 
                            i === step ? 'bg-web3-indigo text-white' : 
                            'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {i < step ? <Check size={18} /> : i}
                        </div>
                        <span className={`text-xs ${i === step ? 'text-web3-indigo font-medium' : 'text-gray-500'}`}>
                          {i === 1 ? 'Connect' : i === 2 ? 'Select' : 'Confirm'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="py-4">
                    {step === 1 && (
                      <div className="space-y-6 animate-fade-in">
                        <h3 className="text-lg font-medium">Connect Your Wallet</h3>
                        <p className="text-sm text-gray-500">Select your preferred wallet to continue with the payment.</p>
                        
                        <div className="space-y-3">
                          {['MetaMask', 'WalletConnect', 'Coinbase Wallet'].map((wallet, i) => (
                            <button 
                              key={i} 
                              className="w-full p-4 border border-gray-200 rounded-lg flex items-center justify-between hover:border-web3-indigo hover:bg-gray-50 transition-colors"
                            >
                              <span>{wallet}</span>
                              <ChevronRight size={18} className="text-gray-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {step === 2 && (
                      <div className="space-y-6 animate-fade-in">
                        <h3 className="text-lg font-medium">Select Currency</h3>
                        <p className="text-sm text-gray-500">Choose which cryptocurrency to use for this payment.</p>
                        
                        <div className="space-y-3">
                          {currencies.map((currency, i) => (
                            <button 
                              key={i} 
                              className="w-full p-4 border border-gray-200 rounded-lg flex items-center justify-between hover:border-web3-indigo hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center">
                                <span className="text-xl mr-3">{currency.logo}</span>
                                <div>
                                  <div className="font-medium">{currency.name}</div>
                                  <div className="text-xs text-gray-500">Balance: {currency.balance}</div>
                                </div>
                              </div>
                              <ChevronRight size={18} className="text-gray-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {step === 3 && (
                      <div className="space-y-6 animate-fade-in">
                        <h3 className="text-lg font-medium">Confirm Payment</h3>
                        <p className="text-sm text-gray-500">Review transaction details before confirming.</p>
                        
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Amount</span>
                            <span className="font-medium">0.158 ETH</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Network Fee</span>
                            <span className="font-medium">0.002 ETH</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Service Fee</span>
                            <span className="font-medium">0.001 ETH</span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 flex justify-between">
                            <span className="text-sm font-medium">Total</span>
                            <span className="font-medium">0.161 ETH</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-500">
                          <CreditCard size={14} className="mr-2" /> 
                          Payment to: Premium Merchant Store
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    className="w-full bg-web3-indigo hover:bg-opacity-90"
                    onClick={handleNext}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        {step < 3 ? 'Continue' : 'Confirm Payment'}
                        <ChevronRight size={16} className="ml-1" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center animate-fade-in">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Payment Successful!</h3>
                  <p className="text-gray-500 text-center mb-6">
                    Your transaction has been processed successfully.
                  </p>
                  <div className="bg-gray-50 w-full rounded-lg p-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">Transaction ID</span>
                      <span className="font-mono text-sm">0x71c...8e92</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className="text-green-600 text-sm font-medium">Confirmed</span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    Start New Payment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentDemo;
