
import React, { useEffect, useState } from 'react';
import { BarChart3, ArrowUp, ArrowDown, Users, CreditCard, Loader2 } from 'lucide-react';
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
import { api, Transaction } from '@/lib/api';

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState({ totalVolume: 0, totalTx: 0, activeEscrows: 0 });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const s = await api.getStats();
        const tx = await api.getTransactions();
        setStats(s);
        setRecentTx(tx.slice(0, 5));
        setLoading(false);
    };
    loadData();
  }, []);

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
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-2xl font-bold">${stats.totalVolume.toFixed(2)}</div>
            )}
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUp className="mr-1 h-3 w-3" />
              <span>Live Data</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-2xl font-bold">{stats.totalTx}</div>
            )}
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUp className="mr-1 h-3 w-3" />
              <span>Lifetime</span>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-2xl font-bold">{stats.activeEscrows}</div>
            )}
            <div className="flex items-center mt-1 text-xs text-blue-600">
              <span>Pending Action</span>
            </div>
          </CardContent>
        </Card>
        <Card>
            {/* Keeping one dummy for layout balance as we don't have cust count yet */}
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <div className="flex items-center mt-1 text-xs text-gray-400">
               Coming Soon
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
              <span className="ml-2 text-gray-400">Charts coming in v2</span>
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
              {loading ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></div> : recentTx.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium">{tx.customer ? `${tx.customer.slice(0,4)}...` : 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{new Date(tx.timestamp).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{tx.amount} {tx.currency}</div>
                    <div className={`text-xs ${
                      tx.status === 'completed' ? 'text-green-600' : 
                      tx.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))}
              <Link to="/dashboard/payments">
                <Button variant="link" className="p-0 h-auto w-full justify-start mt-4">
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
              Create shareable payment links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/links">
                <Button variant="outline" className="w-full">
                Manage Links
                </Button>
            </Link>
          </CardContent>
        </Card>
        {/* ... keeping other cards static for now as they are less prio ... */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Configure wallet & preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/settings">
                <Button variant="outline" className="w-full">
                Go to Settings
                </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
