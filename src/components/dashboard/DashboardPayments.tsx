
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, Filter, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chip from '@/components/ui/Chip';
import { api, Transaction } from '@/lib/api';

const DashboardPayments: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const data = await api.getTransactions();
        setTransactions(data);
        setLoading(false);
    };
    loadData();
  }, []);

  const filteredPayments = activeTab === 'all' 
    ? transactions 
    : activeTab === 'escrow' 
      ? transactions.filter(p => p.type === 'escrow')
      : transactions.filter(p => p.type === 'direct');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
          <Button size="sm">New Payment</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            View and manage all your payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-6">
            <div className="flex items-center space-x-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input 
                type="text" 
                placeholder="Search transactions..." 
                className="pl-10 p-2 text-sm border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-web3-blue focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>

              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="direct">Direct</TabsTrigger>
                  <TabsTrigger value="escrow">Escrow</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                        </TableCell>
                    </TableRow>
                ) : filteredPayments.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            No transactions found.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                            {new Date(payment.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{payment.linkTitle || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">
                            {payment.customer ? `${payment.customer.slice(0,6)}...` : 'Unknown'}
                        </TableCell>
                        <TableCell>
                        <div className="font-medium">{payment.amount} {payment.currency}</div>
                        </TableCell>
                        <TableCell>
                        <Chip
                            variant={payment.type === 'escrow' ? 'primary' : 'secondary'}
                            size="sm"
                        >
                            {payment.type === 'escrow' ? 'Escrow' : 'Direct'}
                        </Chip>
                        </TableCell>
                        <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            payment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                        }`}>
                            {payment.status}
                        </span>
                        </TableCell>
                        <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPayments;
