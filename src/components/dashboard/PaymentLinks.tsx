'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api, apiError, PaymentLink, SupportedChain } from '@/lib/api';
import { toast } from 'sonner';

const LinkActions: React.FC<{
  link: PaymentLink;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ link, onCopy, onDelete }) => (
  <div className="flex gap-2 sm:justify-end">
    <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => onCopy(link.id)}>
      <Copy className="h-4 w-4" />
    </Button>
    <Button variant="outline" size="icon" aria-label="Open checkout" onClick={() => window.open(`/pay/${link.id}`, '_blank')}>
      <ExternalLink className="h-4 w-4" />
    </Button>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Delete link">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{link.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            The checkout page stops working. Payments already made stay in your history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(link.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);

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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      setLinks(await api.getLinks());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    api.getSupportedAssets().then(setChains).catch(() => {});
  }, []);

  const handleCreate = async () => {
    const amount = Number(price);
    if (!title.trim()) {
      toast.error('Give the link a title');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a price above zero');
      return;
    }

    const [chain, symbol] = asset.split(':');

    setCreating(true);
    try {
      await api.createLink({
        title: title.trim(),
        price: amount,
        currency,
        crypto: symbol,
        chain,
      });
      setTitle('');
      setPrice('');
      setOpen(false);
      toast.success('Payment link created');
      fetchLinks();
    } catch (err) {
      toast.error(apiError(err, "Couldn't create the link"));
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (id: string) => {
    try {
      await api.deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success('Payment link deleted');
    } catch (err) {
      toast.error(apiError(err, "Couldn't delete the link"));
    }
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
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Payment links</h1>
          <p className="text-ink-soft">Manage your product payment pages</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create payment link</DialogTitle>
              <DialogDescription>Generate a new checkout page for your product.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="title" className="sm:text-right">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="sm:col-span-3" placeholder="e.g. Premium Plan" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="price" className="sm:text-right">Price</Label>
                <Input id="price" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="sm:col-span-3" placeholder="0.00" />
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
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your links</CardTitle>
          <CardDescription>Each link is a reusable checkout page. Share it anywhere.</CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-soft">
              {loading ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              ) : error ? (
                "Couldn't load your links. Check that the API is running."
              ) : (
                'No links yet. Create one to get a shareable checkout page.'
              )}
            </div>
          ) : (
            <>
              {/* Phones: one card per link. */}
              <ul className="divide-y sm:hidden">
                {links.map((link) => (
                  <li key={link.id} className="py-4 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{link.title}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {link.crypto}
                          {link.chain ? ` on ${link.chain}` : ''} · {new Date(link.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-ink">
                        {link.price} {link.currency}
                      </p>
                    </div>
                    <div className="mt-3">
                      <LinkActions link={link} onCopy={copyLink} onDelete={deleteLink} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Accepts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.title}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {link.price} {link.currency}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-ink-soft">
                          {link.crypto}
                          {link.chain ? <span className="ml-1 text-xs">on {link.chain}</span> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(link.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <LinkActions link={link} onCopy={copyLink} onDelete={deleteLink} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentLinks;
