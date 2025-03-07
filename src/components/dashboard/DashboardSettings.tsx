
import React, { useState } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, User, Shield, Wallet, Globe, Lock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DashboardSettings: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('account');
  
  // Dummy form state
  const [settings, setSettings] = useState({
    companyName: 'Premium Store',
    email: 'merchant@example.com',
    notifyPayments: true,
    notifyEscrow: true,
    notifyUpdates: false,
    autoWithdrawal: false,
    apiKey: 'sk_test_51MERCHANTAPIKEYrk1jDnW',
    webhookUrl: 'https://yourwebsite.com/api/guardpay-webhook',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggle = (name: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your changes have been saved successfully",
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <Tabs
              defaultValue="account"
              value={activeTab}
              onValueChange={setActiveTab}
              orientation="vertical"
              className="flex flex-col space-y-1"
            >
              <TabsList className="flex flex-col h-auto bg-transparent space-y-1">
                <TabsTrigger
                  value="account"
                  className="w-full justify-start px-3 py-2 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                >
                  <User size={16} className="mr-2" />
                  Account
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="w-full justify-start px-3 py-2 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                >
                  <Bell size={16} className="mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger
                  value="payment"
                  className="w-full justify-start px-3 py-2 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                >
                  <Wallet size={16} className="mr-2" />
                  Payment
                </TabsTrigger>
                <TabsTrigger
                  value="api"
                  className="w-full justify-start px-3 py-2 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                >
                  <Globe size={16} className="mr-2" />
                  API
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="w-full justify-start px-3 py-2 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                >
                  <Shield size={16} className="mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <TabsContent value="account" className="mt-0" hidden={activeTab !== 'account'}>
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    value={settings.companyName}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={settings.email}
                    onChange={handleChange}
                  />
                  <p className="text-sm text-gray-500">
                    We'll use this email for important account notifications
                  </p>
                </div>
                <div className="space-y-4 pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">Delete Account</h4>
                      <p className="text-sm text-gray-500">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <Button variant="destructive">Delete Account</Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSave}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0" hidden={activeTab !== 'notifications'}>
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how and when you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Payment Notifications</h4>
                      <p className="text-sm text-gray-500">
                        Get notified when you receive a payment
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyPayments}
                      onCheckedChange={(checked) => handleToggle('notifyPayments', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Escrow Status Updates</h4>
                      <p className="text-sm text-gray-500">
                        Get notified when escrow status changes
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyEscrow}
                      onCheckedChange={(checked) => handleToggle('notifyEscrow', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Product Updates</h4>
                      <p className="text-sm text-gray-500">
                        Get notified about new features and updates
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyUpdates}
                      onCheckedChange={(checked) => handleToggle('notifyUpdates', checked)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSave}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="mt-0" hidden={activeTab !== 'payment'}>
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>
                  Configure your payment processing options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Automatic Withdrawals</h4>
                      <p className="text-sm text-gray-500">
                        Automatically withdraw funds when they reach a certain threshold
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoWithdrawal}
                      onCheckedChange={(checked) => handleToggle('autoWithdrawal', checked)}
                    />
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Supported Cryptocurrencies</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { name: 'Ethereum (ETH)', enabled: true },
                        { name: 'USD Coin (USDC)', enabled: true },
                        { name: 'Dai (DAI)', enabled: true },
                        { name: 'Polygon (MATIC)', enabled: false },
                        { name: 'Solana (SOL)', enabled: false },
                      ].map((crypto, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span>{crypto.name}</span>
                          <Switch checked={crypto.enabled} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Default Settlement Currency</h4>
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="settlement-crypto"
                          name="settlement"
                          className="h-4 w-4 text-web3-blue focus:ring-web3-blue"
                          defaultChecked
                        />
                        <Label htmlFor="settlement-crypto">Keep as crypto</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="settlement-fiat"
                          name="settlement"
                          className="h-4 w-4 text-web3-blue focus:ring-web3-blue"
                        />
                        <Label htmlFor="settlement-fiat">Convert to USD</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSave}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="mt-0" hidden={activeTab !== 'api'}>
            <Card>
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>
                  Manage your API keys and webhook endpoints
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="flex">
                    <Input
                      id="apiKey"
                      name="apiKey"
                      value={settings.apiKey}
                      readOnly
                      className="rounded-r-none font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      className="rounded-l-none border-l-0"
                      onClick={() => {
                        navigator.clipboard.writeText(settings.apiKey);
                        toast({
                          title: "API key copied",
                          description: "The API key has been copied to your clipboard",
                        });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Use this key to authenticate requests to the GuardPay API
                  </p>
                </div>
                
                <div className="space-y-2 pt-4">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    name="webhookUrl"
                    value={settings.webhookUrl}
                    onChange={handleChange}
                  />
                  <p className="text-sm text-gray-500">
                    We'll send payment notifications to this URL
                  </p>
                </div>
                
                <div className="pt-4">
                  <h4 className="font-medium mb-4">Webhook Events</h4>
                  <div className="space-y-3">
                    {[
                      'payment.created',
                      'payment.completed',
                      'payment.failed',
                      'escrow.created',
                      'escrow.released',
                      'escrow.disputed',
                    ].map((event, index) => (
                      <div key={index} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`event-${index}`}
                          defaultChecked
                          className="h-4 w-4 text-web3-blue focus:ring-web3-blue rounded"
                        />
                        <label htmlFor={`event-${index}`} className="ml-2 text-sm font-mono">
                          {event}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <div className="flex space-x-4">
                  <Button onClick={handleSave}>
                    <Save size={16} className="mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline">
                    Test Webhook
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-0" hidden={activeTab !== 'security'}>
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage account security and authentication options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-500">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-4">Password</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" />
                      </div>
                    </div>
                    <Button className="mt-4">
                      <Lock size={16} className="mr-2" />
                      Update Password
                    </Button>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Session Management</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Manage your active sessions across devices
                    </p>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border flex items-center justify-between">
                        <div>
                          <div className="font-medium">Current Session</div>
                          <div className="text-sm text-gray-500">Chrome on Mac OS - New York, USA</div>
                        </div>
                        <div className="text-sm text-gray-500">Active now</div>
                      </div>
                      <div className="p-4 rounded-lg border flex items-center justify-between">
                        <div>
                          <div className="font-medium">Mobile Device</div>
                          <div className="text-sm text-gray-500">Safari on iPhone - San Francisco, USA</div>
                        </div>
                        <Button variant="ghost" size="sm">Sign Out</Button>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4">Sign Out All Devices</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettings;
