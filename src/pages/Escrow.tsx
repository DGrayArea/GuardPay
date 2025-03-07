
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Clock, Check, AlertTriangle, Wallet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Chip from '@/components/ui/Chip';
import { useToast } from '@/hooks/use-toast';

interface EscrowTransaction {
  id: string;
  title: string;
  counterparty: string;
  amount: string;
  currency: string;
  status: 'pending' | 'active' | 'completed' | 'disputed' | 'refunded';
  role: 'buyer' | 'seller';
  date: string;
  description?: string;
  conditions?: string;
}

const Escrow: React.FC = () => {
  const { toast } = useToast();
  const [selectedEscrow, setSelectedEscrow] = useState<EscrowTransaction | null>(null);

  // Dummy data
  const escrowTransactions: EscrowTransaction[] = [
    {
      id: 'ESC-1234',
      title: 'Website Development Project',
      counterparty: 'John Doe',
      amount: '1.2',
      currency: 'ETH',
      status: 'active',
      role: 'buyer',
      date: '2023-06-15',
      description: 'Complete website redesign with responsive design and e-commerce functionality',
      conditions: 'Funds will be released after website is delivered and tested for 3 days'
    },
    {
      id: 'ESC-1235',
      title: 'Digital Art Commission',
      counterparty: 'Sarah Mills',
      amount: '0.5',
      currency: 'ETH',
      status: 'pending',
      role: 'seller',
      date: '2023-06-14',
      description: 'Creation of 3 digital art pieces in the requested style',
      conditions: 'Buyer must approve the sketches before full artwork is created'
    },
    {
      id: 'ESC-1236',
      title: 'Marketing Consultation',
      counterparty: 'Tech Savvy Inc.',
      amount: '1500',
      currency: 'USDC',
      status: 'completed',
      role: 'seller',
      date: '2023-06-10',
      description: 'Marketing strategy development and implementation plan',
      conditions: 'Payment released upon delivery of final strategy document'
    },
    {
      id: 'ESC-1237',
      title: 'Software License Purchase',
      counterparty: 'Crypto Tools LLC',
      amount: '0.75',
      currency: 'ETH',
      status: 'disputed',
      role: 'buyer',
      date: '2023-06-05',
      description: 'Purchase of enterprise license for trading software',
      conditions: 'Software must include all advertised features and pass security audit'
    },
    {
      id: 'ESC-1238',
      title: 'Content Writing Services',
      counterparty: 'WordCraft Agency',
      amount: '400',
      currency: 'USDC',
      status: 'refunded',
      role: 'buyer',
      date: '2023-06-02',
      description: '10 blog articles on cryptocurrency topics',
      conditions: 'Articles must be original and pass plagiarism check'
    },
  ];

  const handleReleaseEscrow = () => {
    toast({
      title: "Escrow funds released",
      description: "The funds have been released to the seller",
    });
    setSelectedEscrow(null);
  };

  const handleDisputeEscrow = () => {
    toast({
      title: "Dispute submitted",
      description: "Your dispute has been submitted for review",
    });
    setSelectedEscrow(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'active':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'disputed':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'refunded':
        return <ArrowLeft className="w-5 h-5 text-gray-500" />;
      default:
        return <Shield className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'disputed':
        return 'bg-orange-100 text-orange-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link to="/dashboard" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold flex items-center">
              <Shield size={24} className="mr-2 text-web3-blue" />
              Escrow Service
            </h1>
          </div>
          <Button>
            <Shield size={16} className="mr-2" />
            Create New Escrow
          </Button>
        </div>

        {selectedEscrow ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedEscrow.title}</CardTitle>
                    <CardDescription>Escrow ID: {selectedEscrow.id}</CardDescription>
                  </div>
                  <Chip
                    variant={selectedEscrow.status === 'completed' ? 'primary' : 'default'}
                    size="sm"
                    className={getStatusColor(selectedEscrow.status)}
                  >
                    {getStatusIcon(selectedEscrow.status)}
                    <span className="ml-1 capitalize">{selectedEscrow.status}</span>
                  </Chip>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Amount</h3>
                    <p className="text-2xl font-bold">{selectedEscrow.amount} {selectedEscrow.currency}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      {selectedEscrow.role === 'buyer' ? 'Seller' : 'Buyer'}
                    </h3>
                    <p className="text-lg font-medium">{selectedEscrow.counterparty}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedEscrow.description}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Escrow Conditions</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedEscrow.conditions}
                  </p>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex">
                      <div className="mr-4 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Check size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Escrow Created</p>
                        <p className="text-sm text-gray-500">
                          {new Date(selectedEscrow.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    {selectedEscrow.status === 'active' && (
                      <div className="flex">
                        <div className="mr-4 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Shield size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Funds Locked in Escrow</p>
                          <p className="text-sm text-gray-500">
                            {new Date(selectedEscrow.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedEscrow.status === 'completed' && (
                      <div className="flex">
                        <div className="mr-4 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Wallet size={16} className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Funds Released</p>
                          <p className="text-sm text-gray-500">
                            {new Date().toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedEscrow.status === 'disputed' && (
                      <div className="flex">
                        <div className="mr-4 h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={16} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium">Dispute Filed</p>
                          <p className="text-sm text-gray-500">
                            {new Date().toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedEscrow(null)}
                >
                  Back to List
                </Button>
                <div className="space-x-3">
                  {selectedEscrow.status === 'active' && selectedEscrow.role === 'buyer' && (
                    <>
                      <Button variant="outline" onClick={handleDisputeEscrow}>
                        <AlertTriangle size={16} className="mr-2" />
                        File Dispute
                      </Button>
                      <Button onClick={handleReleaseEscrow}>
                        <Wallet size={16} className="mr-2" />
                        Release Funds
                      </Button>
                    </>
                  )}
                  {selectedEscrow.status === 'active' && selectedEscrow.role === 'seller' && (
                    <Button variant="outline" onClick={handleDisputeEscrow}>
                      <AlertTriangle size={16} className="mr-2" />
                      File Dispute
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Escrow Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Your Role</h3>
                  <div className="flex items-center">
                    {selectedEscrow.role === 'buyer' ? (
                      <>
                        <ArrowRight size={16} className="text-red-500 mr-2" />
                        <span>Buyer (Sent Funds)</span>
                      </>
                    ) : (
                      <>
                        <ArrowLeft size={16} className="text-green-500 mr-2" />
                        <span>Seller (Receiving Funds)</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Smart Contract</h3>
                  <div className="font-mono text-xs break-all bg-gray-50 p-3 rounded">
                    0x71C7656EC7ab88b098defB751B7401B5f6d8976F
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 h-auto p-0 text-web3-blue">
                    View on Explorer
                  </Button>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Security Information</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <Check size={16} className="text-green-500 mr-2 mt-0.5" />
                      <span>Multi-signature protection</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={16} className="text-green-500 mr-2 mt-0.5" />
                      <span>Funds held in secure smart contract</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={16} className="text-green-500 mr-2 mt-0.5" />
                      <span>Automated fund release with conditions</span>
                    </li>
                    <li className="flex items-start">
                      <Check size={16} className="text-green-500 mr-2 mt-0.5" />
                      <span>Dispute resolution available</span>
                    </li>
                  </ul>
                </div>

                {selectedEscrow.status === 'active' && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Note</h3>
                    <p className="text-sm text-yellow-700">
                      {selectedEscrow.role === 'buyer'
                        ? "Only release funds when you're fully satisfied with the delivery of goods or services."
                        : "Funds will be released once the buyer approves the delivery of goods or services."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Your Escrow Transactions</CardTitle>
                    <CardDescription>
                      Manage your secure payment escrows
                    </CardDescription>
                  </div>
                  <Tabs defaultValue="all">
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="active">Active</TabsTrigger>
                      <TabsTrigger value="completed">Completed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {escrowTransactions.map((escrow) => (
                    <div
                      key={escrow.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEscrow(escrow)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <h3 className="font-medium">{escrow.title}</h3>
                            <div className="ml-3 flex items-center">
                              <Chip
                                variant={escrow.status === 'completed' ? 'primary' : 'default'}
                                size="sm"
                                className={getStatusColor(escrow.status)}
                              >
                                {getStatusIcon(escrow.status)}
                                <span className="ml-1 capitalize">{escrow.status}</span>
                              </Chip>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            ID: {escrow.id} • Created: {new Date(escrow.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{escrow.amount} {escrow.currency}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {escrow.role === 'buyer' ? 'To' : 'From'}: {escrow.counterparty}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <div className="flex items-center text-sm">
                          <div className={`mr-1 text-sm ${
                            escrow.role === 'buyer' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            You are the {escrow.role}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEscrow(escrow);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield size={20} className="mr-2 text-web3-blue" />
                    How Escrow Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="font-medium">1</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Create an Escrow</h3>
                        <p className="text-sm text-gray-500">
                          Specify the terms, amount, and the recipient of the funds
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="font-medium">2</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Secure the Funds</h3>
                        <p className="text-sm text-gray-500">
                          Funds are locked in a secure smart contract, visible on the blockchain
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="font-medium">3</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Deliver Goods/Services</h3>
                        <p className="text-sm text-gray-500">
                          Seller completes their obligation with confidence
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="font-medium">4</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Release Funds</h3>
                        <p className="text-sm text-gray-500">
                          Buyer approves and releases the funds to the seller
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create New Escrow</CardTitle>
                  <CardDescription>
                    Start a secure transaction with built-in protection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col space-y-1.5">
                    <Button>
                      <Shield size={16} className="mr-2" />
                      Start New Escrow
                    </Button>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-sm font-medium mb-2">Popular Use Cases</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                          <Check size={12} className="text-blue-600" />
                        </div>
                        <span>Online Services & Freelancing</span>
                      </li>
                      <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                          <Check size={12} className="text-blue-600" />
                        </div>
                        <span>Digital Asset Purchases</span>
                      </li>
                      <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                          <Check size={12} className="text-blue-600" />
                        </div>
                        <span>Cross-border Business Transactions</span>
                      </li>
                      <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                          <Check size={12} className="text-blue-600" />
                        </div>
                        <span>High-value Purchases</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Escrow;
