import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  const navItems = [
    { label: "Payments", href: "#payments" },
    { label: "Escrow", href: "#escrow" },
    { label: "Merchants", href: "#merchants" },
    { label: "About", href: "#about" },
  ];

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      scrolled ? 'py-3 bg-white/90 backdrop-blur-sm shadow-sm' : 'py-5 bg-transparent'
    }`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-web3-skyBlue flex items-center justify-center">
            <Wallet className="h-5 w-5 text-web3-blue" />
          </div>
          <span className="text-xl font-semibold">GuardPay</span>
        </div>

        {isMobile ? (
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-gray-700 focus:outline-none"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        ) : (
          <div className="flex items-center space-x-8">
            <ul className="flex space-x-8">
              {navItems.map((item, index) => (
                <li key={index}>
                  <a 
                    href={item.href}
                    className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <Button 
              variant="outline" 
              className="font-medium text-sm glass-button"
            >
              Connect Wallet
            </Button>
          </div>
        )}
      </div>

      {isMobile && menuOpen && (
        <div className="absolute top-full left-0 w-full bg-white/95 backdrop-blur-sm shadow-md py-4 animate-fade-in-up-fast">
          <div className="container mx-auto px-6">
            <ul className="flex flex-col space-y-4">
              {navItems.map((item, index) => (
                <li key={index}>
                  <a 
                    href={item.href}
                    className="block text-base font-medium text-gray-700 hover:text-black transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Button 
                  variant="outline" 
                  className="w-full justify-center font-medium text-sm glass-button mt-2"
                  onClick={() => setMenuOpen(false)}
                >
                  Connect Wallet
                </Button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
