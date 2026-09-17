'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api, PaymentLink, SupportedChain } from '@/lib/api';
import { toast } from 'sonner';

const PaymentLinks: React.FC = () => {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [chains, setChains] = useState<SupportedChain[]>([]);
  // "CHAIN:SYMBOL" — an asset is only meaningful together with its chain.
  const [asset, setAsset] = useState('BASE:USDC');

  const fetchLinks = async () => {
    setLoading(true);
    const data = await api.getLinks();
    setLinks(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
    api.getSupportedAssets().then(setChains).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title || !price) {
      toast.error("Please fill in all fields");
      return;
    }
    
    const [chain, symbol] = asset.split(':');

    await api.createLink({
      title,
      price: parseFloat(price),
      currency,
      crypto: symbol,
      chain,
    });
    
    setTitle('');
    setPrice('');
    setOpen(false);
    toast.success("Payment Link Created");
    fetchLinks();
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Payment Links</h1>
          <p className="text-ink-soft">Manage your product payment pages</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
              <DialogDescription>Generate a new checkout page for your product.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="title" className="sm:text-right">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="sm:col-span-3" placeholder="e.g. Premium Plan" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="price" className="sm:text-right">Price</Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="sm:col-span-3" placeholder="0.00" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="asset" className="sm:text-right">Accept in</Label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger id="asset" className="sm:col-span-3">
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {chains.flatMap((c) =>
                      c.assets.map((a) => (
                        <SelectItem key={`${c.chain}:${a.symbol}`} value={`${c.chain}:${a.symbol}`}>
                          {a.symbol} on {c.name}
                          {a.stable ? ' · stable' : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="currency" className="sm:text-right">Currency</Label>
                <Select value={currency} onValueChange={(v: any) => setCurrency(v)}>
                  <SelectTrigger className="sm:col-span-3">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate}>Create Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Links</CardTitle>
          <CardDescription>All active payment links</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Accepts</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.title}</TableCell>
                  <TableCell>{link.price} {link.currency}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-ink-soft">
                    {link.crypto}
                    {link.chain ? <span className="ml-1 text-xs">on {link.chain}</span> : null}
                  </TableCell>
                  <TableCell>{new Date(link.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => copyLink(link.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => window.open(`/pay/${link.id}`, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {links.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-ink-soft">
                    No links created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentLinks;
