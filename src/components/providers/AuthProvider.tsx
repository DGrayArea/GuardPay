
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';

interface User {
  address: string;
  type: 'evm' | 'solana';
}

interface AuthContextType {
  user: User | null;
  login: (address: string, type: 'evm' | 'solana') => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  // Wallet Hooks
  const { disconnect: disconnectEvm, isConnected: isEvmConnected, status: evmStatus } = useAccount();
  const { disconnect: disconnectSol, connected: isSolConnected, connecting: isSolConnecting, publicKey } = useWallet();

  // Load from local storage
  useEffect(() => {
    const stored = localStorage.getItem('guardpay_user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // STRICT GATING: Auto-logout if wallet disconnects
  useEffect(() => {
    if (!user) return;

    if (user.type === 'evm') {
       // If EVM user, but wallet is not connected and not trying to reconnect
       if (!isEvmConnected && evmStatus !== 'reconnecting') {
          console.log("EVM Wallet Disconnected - Logging out");
          logout();
       }
    } else if (user.type === 'solana') {
       // If Solana user, but wallet is not connected
       // Note: checking publicKey is often more reliable for "active session"
       if (!isSolConnected && !isSolConnecting && !publicKey) {
           console.log("Solana Wallet Disconnected - Logging out");
           logout();
       }
    }
  }, [user, isEvmConnected, evmStatus, isSolConnected, isSolConnecting, publicKey]);

  const login = (address: string, type: 'evm' | 'solana') => {
    const newUser = { address, type };
    setUser(newUser);
    localStorage.setItem('guardpay_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('guardpay_user');
    
    // Attempt to disconnect wallets to ensure clean state
    try { disconnectEvm(); } catch (e) {}
    try { disconnectSol(); } catch (e) {}
    
    // Redirect
    if (window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
