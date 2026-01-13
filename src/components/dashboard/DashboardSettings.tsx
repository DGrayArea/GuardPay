
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { api } from '@/lib/api';

const DashboardSettings: React.FC = () => {
  const [merchantName, setMerchantName] = useState('');
  const [receivingAddress, setReceivingAddress] = useState('');
  const [solanaAddress, setSolanaAddress] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        const s = await api.getSettings();
        setMerchantName(s.merchantName);
        setReceivingAddress(s.receivingAddress);
        setSolanaAddress(s.solanaAddress || '');
        setLoading(false);
    }
    load();
  }, [])

  const handleSave = async () => {
    await api.updateSettings({
        merchantName,
        receivingAddress,
        solanaAddress
    });
    toast.success("Settings saved successfully");
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Merchant Profile</CardTitle>
          <CardDescription>Configure how you appear to customers and where you receive funds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Merchant Name</Label>
            <Input 
                id="name" 
                value={merchantName} 
                onChange={(e) => setMerchantName(e.target.value)} 
            />
          </div>
          
          <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium">Receive Payments</h3>
              
              <div className="grid gap-2">
                <Label htmlFor="wallet">EVM Wallet Address (ETH, BSC, Base, Polygon)</Label>
                <Input 
                    id="wallet" 
                    value={receivingAddress} 
                    onChange={(e) => setReceivingAddress(e.target.value)} 
                    placeholder="0x..."
                    className="font-mono bg-gray-50"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="solana">Solana Wallet Address</Label>
                <Input 
                    id="solana" 
                    value={solanaAddress} 
                    onChange={(e) => setSolanaAddress(e.target.value)} 
                    placeholder="Address..."
                    className="font-mono bg-gray-50"
                />
              </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DashboardSettings;
