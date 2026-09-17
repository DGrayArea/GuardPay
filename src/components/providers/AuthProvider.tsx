'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface AuthUser {
  address: string;
  type: 'evm' | 'solana';
  merchantId: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  /** True until the stored session has been read on the client. */
  isLoading: boolean;
  user: AuthUser | null;
  merchantId: string | null;
  walletAddress: string | null;
  login: (address: string, type: 'evm' | 'solana', merchantId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  merchantId: null,
  walletAddress: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Runs only after hydration — localStorage does not exist during SSR.
  useEffect(() => {
    api.loadStoredSession();

    if (api.isAuthenticated()) {
      const address = localStorage.getItem('guardpay_wallet');
      const type = (localStorage.getItem('guardpay_wallet_type') as 'evm' | 'solana') || 'evm';
      const merchantId = localStorage.getItem('guardpay_merchant_id');

      if (address) {
        setUser({ address, type, merchantId });
        setIsAuthenticated(true);
      }
    }

    setIsLoading(false);
  }, []);

  const login = useCallback((address: string, type: 'evm' | 'solana', merchantId?: string) => {
    localStorage.setItem('guardpay_wallet', address);
    localStorage.setItem('guardpay_wallet_type', type);
    if (merchantId) localStorage.setItem('guardpay_merchant_id', merchantId);

    setUser({ address, type, merchantId: merchantId ?? null });
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    localStorage.removeItem('guardpay_wallet');
    localStorage.removeItem('guardpay_merchant_id');
    localStorage.removeItem('guardpay_wallet_type');

    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        merchantId: user?.merchantId ?? null,
        walletAddress: user?.address ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
