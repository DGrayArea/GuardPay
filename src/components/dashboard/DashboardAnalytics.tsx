
import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, PieChart, LineChart, BarChart, ArrowUp, ArrowDown } from 'lucide-react';

const DashboardAnalytics: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Tabs defaultValue="30d">
          <TabsList>
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="30d">30 days</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Total Volume", value: "$42,456.78", change: 12.5, icon: <BarChart size={20} /> },
          { title: "Total Transactions", value: "1,245", change: 8.2, icon: <BarChart3 size={20} /> },
          { title: "Average Transaction", value: "$34.10", change: -2.4, icon: <LineChart size={20} /> },
          { title: "Active Customers", value: "164", change: 5.6, icon: <PieChart size={20} /> },
        ].map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className={`flex items-center mt-1 text-xs ${
                stat.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change > 0 ? (
                  <ArrowUp className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="mr-1 h-3 w-3" />
                )}
                <span>{Math.abs(stat.change)}% from last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Volume</CardTitle>
          <CardDescription>
            Total transaction volume over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex flex-col items-center justify-center bg-gray-50 rounded-md">
            <BarChart3 size={48} className="text-gray-300 mb-2" />
            <span className="text-gray-400">Chart visualization placeholder</span>
            <span className="text-xs text-gray-400 mt-2">Data would be rendered here using Recharts library</span>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Types</CardTitle>
            <CardDescription>
              Breakdown by payment type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
              <PieChart size={40} className="text-gray-300 mb-2" />
              <span className="text-gray-400">Pie chart placeholder</span>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-web3-blue mr-2"></div>
                  <span className="text-sm">Direct (65%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-web3-skyBlue mr-2"></div>
                  <span className="text-sm">Escrow (35%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Currencies</CardTitle>
            <CardDescription>
              Distribution by cryptocurrency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
              <PieChart size={40} className="text-gray-300 mb-2" />
              <span className="text-gray-400">Pie chart placeholder</span>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-sm">ETH (42%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm">USDC (38%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm">DAI (12%)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                  <span className="text-sm">Others (8%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
          <CardDescription>
            Customer activity and engagement metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Top Customers</h3>
              <div className="space-y-3">
                {[
                  { name: "John D.", transactions: 24, volume: "$3,451" },
                  { name: "Sarah M.", transactions: 18, volume: "$2,845" },
                  { name: "David K.", transactions: 15, volume: "$2,322" },
                ].map((customer, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{customer.name}</span>
                    <span className="text-gray-500">{customer.volume}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">New vs Returning</h3>
              <div className="flex flex-col items-center justify-center h-32">
                <PieChart size={32} className="text-gray-300 mb-2" />
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <span className="text-sm">New (35%)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                    <span className="text-sm">Returning (65%)</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">Customer Growth</h3>
              <div className="flex flex-col items-center justify-center h-32">
                <LineChart size={32} className="text-gray-300 mb-2" />
                <span className="text-xs text-gray-500">+24% growth this month</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardAnalytics;
