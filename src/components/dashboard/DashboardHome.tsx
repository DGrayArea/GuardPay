
import React from 'react';
import { BarChart3, ArrowUp, ArrowDown, Users, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Chip from '@/components/ui/Chip';
import { Link } from 'react-router-dom';

interface Transaction {
  id: string;
  date: string;
  customer: string;
  amount: string;
  status: 'completed' | 'pending' | 'failed';
}

const DashboardHome: React.FC = () => {
  // Dummy data
  const transactions: Transaction[] = [
    { id: 'TX-9385', date: '2 hours ago', customer: 'John D.', amount: '0.85 ETH', status: 'completed' },
    { id: 'TX-9384', date: '4 hours ago', customer: 'Sarah M.', amount: '450 USDC', status: 'completed' },
    { id: 'TX-9383', date: '6 hours ago', customer: 'David K.', amount: '0.12 ETH', status: 'pending' },
    { id: 'TX-9382', date: 'yesterday', customer: 'Emma R.', amount: '220 USDC', status: 'completed' },
    { id: 'TX-9381', date: 'yesterday', customer: 'Michael T.', amount: '0.5 ETH', status: 'failed' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Chip variant="primary" size="sm">Premium Merchant</Chip>
          <Button variant="outline" size="sm">Create Invoice</Button>
          <Button size="sm">New Payment</Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.58 ETH</div>
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUp className="mr-1 h-3 w-3" />
              <span>12.5% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,486</div>
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUp className="mr-1 h-3 w-3" />
              <span>8.2% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">164</div>
            <div className="flex items-center mt-1 text-xs text-red-600">
              <ArrowDown className="mr-1 h-3 w-3" />
              <span>3.1% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Escrows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUp className="mr-1 h-3 w-3" />
              <span>18.9% from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Transaction volume over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-md">
              <BarChart3 size={48} className="text-gray-300" />
              <span className="ml-2 text-gray-400">Chart visualization placeholder</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest transaction activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 3).map((tx) => (
                <div key={tx.id} className="flex items-start justify-between pb-4 border-b border-gray-100">
                  <div>
                    <div className="font-medium">{tx.customer}</div>
                    <div className="text-sm text-gray-500">{tx.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{tx.amount}</div>
                    <div className={`text-xs ${
                      tx.status === 'completed' ? 'text-green-600' : 
                      tx.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
              <Link to="/dashboard/payments">
                <Button variant="link" className="p-0 h-auto w-full justify-start">
                  View all transactions
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Payment Links
            </CardTitle>
            <CardDescription>
              Create shareable payment links for your customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Create Payment Link
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Customer Management
            </CardTitle>
            <CardDescription>
              Manage your customers and their payment information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Customers
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="mr-2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              Escrow Service
            </CardTitle>
            <CardDescription>
              Create and manage secure escrow transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Link to="/escrow">Manage Escrows</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
