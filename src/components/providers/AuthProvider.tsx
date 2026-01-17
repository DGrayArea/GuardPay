import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  merchantId: string | null;
  walletAddress: string | null;
  login: (address: string, type: 'evm' | 'solana') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  merchantId: null,
  walletAddress: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = () => {
      const authenticated = api.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const storedAddress = localStorage.getItem('guardpay_wallet');
        const storedMerchantId = localStorage.getItem('guardpay_merchant_id');
        setWalletAddress(storedAddress);
        setMerchantId(storedMerchantId);
      }
    };

    checkAuth();
  }, []);

  const login = (address: string, type: 'evm' | 'solana') => {
    setIsAuthenticated(true);
    setWalletAddress(address);
    localStorage.setItem('guardpay_wallet', address);
    localStorage.setItem('guardpay_wallet_type', type);
  };

  const logout = () => {
    api.logout();
    setIsAuthenticated(false);
    setMerchantId(null);
    setWalletAddress(null);
    localStorage.removeItem('guardpay_wallet');
    localStorage.removeItem('guardpay_merchant_id');
    localStorage.removeItem('guardpay_wallet_type');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, merchantId, walletAddress, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
