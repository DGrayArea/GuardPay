
import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';

// Wallet Kits
import { ConnectKitButton } from "connectkit";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    
    // EVM State
    const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
    
    // Solana State
    const { publicKey, connected: isSolConnected } = useWallet();

    // Redirect if already logged in
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    // Handle EVM Login
    useEffect(() => {
        const handleLogin = async () => {
            if (isEvmConnected && evmAddress && !isAuthenticated) {
                await api.updateSettings({ receivingAddress: evmAddress });
                login(evmAddress, 'evm');
                toast.success("Signed in with EVM Wallet");
            }
        };
        handleLogin();
    }, [isEvmConnected, evmAddress, isAuthenticated, login]);

    // Handle Solana Login
    useEffect(() => {
        const handleLogin = async () => {
            if (isSolConnected && publicKey && !isAuthenticated) {
                const address = publicKey.toString();
                await api.updateSettings({ solanaAddress: address });
                login(address, 'solana');
                toast.success("Signed in with Solana Wallet");
            }
        };
        handleLogin();
    }, [isSolConnected, publicKey, isAuthenticated, login]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                <div className="h-12 w-12 mx-auto bg-web3-blue rounded-xl flex items-center justify-center mb-4">
                    <Wallet className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-web3-blue to-purple-600">
                    GuardPay Merchant
                </h1>
                <p className="text-gray-500 mt-2">Connect your wallet to manage payments</p>
            </div>

            <Card className="w-full max-w-md shadow-lg border-none">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">Welcome Back</CardTitle>
                    <CardDescription>Select a wallet to sign in</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 flex flex-col items-center">
                    
                    {/* EVM Section */}
                    <div className="w-full space-y-2">
                        <p className="text-sm font-medium text-center text-gray-500 mb-2">EVM (Metamask, Rainbow, etc)</p>
                        <div className="flex justify-center">
                            <ConnectKitButton />
                        </div>
                    </div>

                    <div className="w-full border-t border-gray-100"></div>

                    {/* Solana Section */}
                    <div className="w-full space-y-2">
                        <p className="text-sm font-medium text-center text-gray-500 mb-2">Solana (Phantom, Solflare)</p>
                        <div className="flex justify-center solana-custom-btn-container">
                            <WalletMultiButton />
                        </div>
                    </div>

                </CardContent>
            </Card>
            
            <p className="mt-8 text-sm text-gray-500">
                Don't have a wallet? <a href="#" className="text-web3-blue hover:underline">Learn how to create one</a>
            </p>
        </div>
    );
};

export default Login;
