
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, ArrowRight, ArrowDown, ArrowUp, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Asset {
  name: string;
  symbol: string;
  balance: string;
  value: string;
  change: number;
}

const DashboardWallet: React.FC = () => {
  const { toast } = useToast();
  const [walletAddress] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
  
  // Dummy data
  const assets: Asset[] = [
    { name: 'Ethereum', symbol: 'ETH', balance: '3.45', value: '$10,285.60', change: 2.4 },
    { name: 'USD Coin', symbol: 'USDC', balance: '2,450.00', value: '$2,450.00', change: 0 },
    { name: 'Dai', symbol: 'DAI', balance: '1,200.00', value: '$1,201.20', change: 0.1 },
    { name: 'Polygon', symbol: 'MATIC', balance: '245.00', value: '$220.50', change: -1.2 },
    { name: 'Optimism', symbol: 'OP', balance: '120.00', value: '$168.00', change: 5.3 },
  ];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm">
            <ArrowDown size={16} className="mr-2" />
            Deposit
          </Button>
          <Button size="sm">
            <ArrowUp size={16} className="mr-2" />
            Withdraw
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Overview</CardTitle>
              <CardDescription>
                Your on-chain payment wallet for receiving funds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Your Wallet Address</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm break-all">{walletAddress}</div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                        <Copy size={14} />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ExternalLink size={14} />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Total Balance (USD)</p>
                    <p className="text-2xl font-bold">$14,325.30</p>
                    <div className="flex items-center mt-1 text-xs text-green-600">
                      <ArrowUp className="mr-1 h-3 w-3" />
                      <span>1.2% from yesterday</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Daily Volume</p>
                    <p className="text-2xl font-bold">$1,245.80</p>
                    <div className="flex items-center mt-1 text-xs text-green-600">
                      <ArrowUp className="mr-1 h-3 w-3" />
                      <span>8.3% from yesterday</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Revenue (30d)</p>
                    <p className="text-2xl font-bold">$32,456.10</p>
                    <div className="flex items-center mt-1 text-xs text-green-600">
                      <ArrowUp className="mr-1 h-3 w-3" />
                      <span>12.7% from last month</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-4 py-3 text-left font-medium">Asset</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                      <th className="px-4 py-3 text-right font-medium">Value (USD)</th>
                      <th className="px-4 py-3 text-right font-medium">Change (24h)</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset, index) => (
                      <tr key={index} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-200 mr-3 flex items-center justify-center">
                              {asset.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              <div className="text-gray-500">{asset.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{asset.balance} {asset.symbol}</td>
                        <td className="px-4 py-3 text-right">{asset.value}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center ${
                            asset.change > 0 ? 'text-green-600' : 
                            asset.change < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {asset.change > 0 ? <ArrowUp className="mr-1 h-3 w-3" /> : 
                             asset.change < 0 ? <ArrowDown className="mr-1 h-3 w-3" /> : null}
                            {asset.change > 0 ? '+' : ''}{asset.change}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">
                            <ArrowUp size={14} className="mr-1" />
                            Send
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-between" size="lg">
                <span className="flex items-center">
                  <ArrowDown size={16} className="mr-2" />
                  Deposit Funds
                </span>
                <ArrowRight size={16} />
              </Button>
              <Button className="w-full justify-between" size="lg">
                <span className="flex items-center">
                  <ArrowUp size={16} className="mr-2" />
                  Withdraw Funds
                </span>
                <ArrowRight size={16} />
              </Button>
              <Button className="w-full justify-between" variant="outline" size="lg">
                <span className="flex items-center">
                  <CreditCard size={16} className="mr-2" />
                  Buy Crypto
                </span>
                <ArrowRight size={16} />
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                  <TabsTrigger value="deposits" className="flex-1">Deposits</TabsTrigger>
                  <TabsTrigger value="withdrawals" className="flex-1">Withdrawals</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="space-y-4 mt-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-full mr-3 ${i % 2 === 0 ? 'bg-green-100' : 'bg-blue-100'}`}>
                          {i % 2 === 0 ? <ArrowDown size={14} className="text-green-600" /> : <ArrowUp size={14} className="text-blue-600" />}
                        </div>
                        <div>
                          <div className="font-medium">{i % 2 === 0 ? 'Received ETH' : 'Sent USDC'}</div>
                          <div className="text-xs text-gray-500">Today, 2:45 PM</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{i % 2 === 0 ? '+0.25 ETH' : '-120 USDC'}</div>
                        <div className="text-xs text-gray-500">{i % 2 === 0 ? '≈ $750' : '≈ $120'}</div>
                      </div>
                    </div>
                  ))}
                  <Button variant="link" className="w-full mt-2">View all transactions</Button>
                </TabsContent>
                
                <TabsContent value="deposits" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full mr-3 bg-green-100">
                        <ArrowDown size={14} className="text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">Received ETH</div>
                        <div className="text-xs text-gray-500">Today, 2:45 PM</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">+0.25 ETH</div>
                      <div className="text-xs text-gray-500">≈ $750</div>
                    </div>
                  </div>
                  <Button variant="link" className="w-full mt-2">View all deposits</Button>
                </TabsContent>
                
                <TabsContent value="withdrawals" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full mr-3 bg-blue-100">
                        <ArrowUp size={14} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">Sent USDC</div>
                        <div className="text-xs text-gray-500">Today, 2:45 PM</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">-120 USDC</div>
                      <div className="text-xs text-gray-500">≈ $120</div>
                    </div>
                  </div>
                  <Button variant="link" className="w-full mt-2">View all withdrawals</Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardWallet;
