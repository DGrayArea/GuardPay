
import React, { useState } from 'react';
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
import { Search, Download, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chip from '@/components/ui/Chip';

interface Payment {
  id: string;
  date: string;
  customer: string;
  amount: string;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'direct' | 'escrow';
}

const DashboardPayments: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');

  // Dummy data
  const payments: Payment[] = [
    { id: 'TX-9385', date: 'Jun 12, 2023', customer: 'John D.', amount: '0.85', currency: 'ETH', status: 'completed', type: 'direct' },
    { id: 'TX-9384', date: 'Jun 11, 2023', customer: 'Sarah M.', amount: '450', currency: 'USDC', status: 'completed', type: 'escrow' },
    { id: 'TX-9383', date: 'Jun 11, 2023', customer: 'David K.', amount: '0.12', currency: 'ETH', status: 'pending', type: 'escrow' },
    { id: 'TX-9382', date: 'Jun 10, 2023', customer: 'Emma R.', amount: '220', currency: 'USDC', status: 'completed', type: 'direct' },
    { id: 'TX-9381', date: 'Jun 10, 2023', customer: 'Michael T.', amount: '0.5', currency: 'ETH', status: 'failed', type: 'direct' },
    { id: 'TX-9380', date: 'Jun 09, 2023', customer: 'Lisa P.', amount: '800', currency: 'USDC', status: 'completed', type: 'escrow' },
    { id: 'TX-9379', date: 'Jun 09, 2023', customer: 'Thomas B.', amount: '0.35', currency: 'ETH', status: 'completed', type: 'direct' },
    { id: 'TX-9378', date: 'Jun 08, 2023', customer: 'Jessica S.', amount: '175', currency: 'USDC', status: 'pending', type: 'escrow' },
    { id: 'TX-9377', date: 'Jun 08, 2023', customer: 'Robert W.', amount: '0.22', currency: 'ETH', status: 'completed', type: 'direct' },
    { id: 'TX-9376', date: 'Jun 07, 2023', customer: 'Amanda L.', amount: '325', currency: 'USDC', status: 'failed', type: 'escrow' },
  ];

  const filteredPayments = activeTab === 'all' 
    ? payments 
    : activeTab === 'escrow' 
      ? payments.filter(p => p.type === 'escrow')
      : payments.filter(p => p.type === 'direct');

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
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell>{payment.customer}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing <strong>1-10</strong> of <strong>42</strong> items
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPayments;
