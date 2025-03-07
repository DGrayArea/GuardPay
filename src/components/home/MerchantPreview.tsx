import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import Chip from '@/components/ui/Chip';
import { ArrowRight, Wallet, BarChart2, LayoutDashboard, CreditCard, Settings } from 'lucide-react';

const MerchantPreview: React.FC = () => {
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

  const sidebarItems = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", active: true },
    { icon: <CreditCard size={20} />, label: "Payments", active: false },
    { icon: <Wallet size={20} />, label: "Wallet", active: false },
    { icon: <BarChart2 size={20} />, label: "Analytics", active: false },
    { icon: <Settings size={20} />, label: "Settings", active: false },
  ];

  const transactions = [
    { id: "TX-8721", customer: "John D.", amount: "0.85 ETH", status: "completed", date: "2 hours ago" },
    { id: "TX-8720", customer: "Sarah M.", amount: "350 USDC", status: "completed", date: "5 hours ago" },
    { id: "TX-8719", customer: "David K.", amount: "0.12 ETH", status: "processing", date: "6 hours ago" },
    { id: "TX-8718", customer: "Emma R.", amount: "220 USDC", status: "completed", date: "yesterday" },
  ];

  return (
    <div id="merchants" className="py-16 md:py-24 bg-gray-50">
      <div 
        ref={containerRef}
        className="container mx-auto px-6 transition-all duration-1000 ease-out opacity-0 translate-y-10"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8">
          <div className="flex flex-col items-start md:max-w-md">
            <Chip variant="secondary" className="mb-6">For Merchants</Chip>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Powerful tools to manage your crypto payments</h2>
            <p className="text-lg text-gray-600 mb-8">
              From simple payment buttons to full checkout experiences, our merchant dashboard gives you everything you need to succeed with web3 payments.
            </p>
            
            <ul className="space-y-4 mb-8">
              {[
                "Real-time transaction monitoring",
                "Detailed analytics and reporting",
                "Custom checkout experiences",
                "Multi-wallet management",
                "Automated invoicing system",
              ].map((feature, index) => (
                <li key={index} className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-web3-blue mr-3"></div>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button className="bg-web3-blue hover:bg-opacity-90">
              Merchant Sign Up
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
          
          <div className="w-full max-w-2xl">
            <div className="bg-white rounded-xl shadow-elevation-3 overflow-hidden border border-gray-200">
              <div className="flex">
                <div className="w-14 md:w-48 bg-gray-900 text-white p-4 flex flex-col">
                  <div className="flex items-center space-x-2 mb-8">
                    <div className="h-6 w-6 rounded-md bg-web3-skyBlue flex items-center justify-center">
                      <Wallet size={14} className="text-web3-blue" />
                    </div>
                    <span className="text-sm font-medium hidden md:inline">GuardPay</span>
                  </div>
                  
                  <div className="space-y-1">
                    {sidebarItems.map((item, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center px-2 py-2 rounded-md ${
                          item.active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex justify-center w-full md:w-auto md:mr-3">
                          {item.icon}
                        </div>
                        <span className="hidden md:inline text-sm">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 p-6">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-medium">Merchant Dashboard</h3>
                      <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                        <span className="text-sm font-medium hidden md:inline">Premium Store</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {[
                        { label: "Total Balance", value: "4.58 ETH", change: "+12.5%" },
                        { label: "Monthly Volume", value: "$12,486", change: "+8.2%" },
                        { label: "Transactions", value: "156", change: "+24.3%" },
                      ].map((stat, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                          <div className="flex justify-between items-end">
                            <p className="text-xl font-medium">{stat.value}</p>
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              {stat.change}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Recent Transactions</h4>
                        <Button variant="link" className="text-web3-blue p-0 h-auto">
                          View all
                        </Button>
                      </div>
                      
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {transactions.map((tx, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{tx.id}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{tx.customer}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-medium">{tx.amount}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                    tx.status === 'completed' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {tx.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{tx.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantPreview;
