import React from 'react';
import { Twitter, Github, Linkedin } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-muted/40 py-14 sm:py-16">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
          <div className="space-y-4">
            <Logo wordClassName="text-xl" />
            <p className="text-sm text-gray-500 pr-4">
              A secure web3 payment gateway and escrow service for modern businesses and customers.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="#" aria-label="GuardPay on X" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" aria-label="GuardPay on GitHub" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Github size={18} />
              </a>
              <a href="#" aria-label="GuardPay on LinkedIn" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Linkedin size={18} />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm uppercase tracking-wider text-gray-400 mb-4">
              Products
            </h3>
            <ul className="space-y-3">
              {["Payments", "Escrow", "Merchant Tools", "SDK", "API"].map((item, index) => (
                <li key={index}>
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-sm uppercase tracking-wider text-gray-400 mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {["Documentation", "Guides", "API Reference", "Examples", "Status"].map((item, index) => (
                <li key={index}>
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-sm uppercase tracking-wider text-gray-400 mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {["About", "Blog", "Careers", "Contact", "Privacy", "Terms"].map((item, index) => (
                <li key={index}>
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} GuardPay. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
