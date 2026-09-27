'use client';

import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { api, apiError, Webhook, WEBHOOK_EVENTS } from '@/lib/api';
import { PublicKey } from '@solana/web3.js';

const isEvm = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

const isSolana = (a: string) => {
  try {
    return PublicKey.isOnCurve(new PublicKey(a).toBytes());
  } catch {
    return false;
  }
};

const copy = (text: string, what: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${what} copied`);
};

/** A value the server shows exactly once, with a copy button and a warning. */
const OneTimeSecret: React.FC<{ label: string; value: string; onDone: () => void }> = ({ label, value, onDone }) => (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
    <p className="text-sm font-medium text-amber-900">{label}</p>
    <p className="mt-1 text-xs text-amber-800">Copy it now. It won't be shown again.</p>
    <div className="mt-3 flex items-start gap-2">
      <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-ink">{value}</code>
      <Button variant="outline" size="sm" onClick={() => copy(value, label)} aria-label={`Copy ${label}`}>
        <Copy size={14} />
      </Button>
    </div>
    <Button variant="ghost" size="sm" className="mt-2 text-amber-900" onClick={onDone}>
      I've saved it
    </Button>
  </div>
);

const Profile: React.FC = () => {
  const [merchantName, setMerchantName] = useState('');
  const [receivingAddress, setReceivingAddress] = useState('');
  const [solanaAddress, setSolanaAddress] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<'USD' | 'EUR'>('USD');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setMerchantName(s.merchantName ?? '');
        setReceivingAddress(s.receivingAddress ?? '');
        setSolanaAddress(s.solanaAddress ?? '');
        setDefaultCurrency(s.defaultCurrency ?? 'USD');
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const evmInvalid = receivingAddress.trim() !== '' && !isEvm(receivingAddress.trim());
  const solInvalid = solanaAddress.trim() !== '' && !isSolana(solanaAddress.trim());

  const handleSave = async () => {
    if (evmInvalid || solInvalid) return;
    setSaving(true);
    try {
      await api.updateSettings({
        merchantName: merchantName.trim(),
        receivingAddress: receivingAddress.trim(),
        solanaAddress: solanaAddress.trim(),
        defaultCurrency,
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error(apiError(error, "Couldn't save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merchant profile</CardTitle>
        <CardDescription>How you appear to customers, and where payments are forwarded.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        ) : loadError ? (
          <p className="text-sm text-red-700">Couldn't load your settings. Check that the API is running.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="grid gap-2">
                <Label htmlFor="name">Business name</Label>
                <Input id="name" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Default currency</Label>
                <Select value={defaultCurrency} onValueChange={(v) => setDefaultCurrency(v as 'USD' | 'EUR')}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wallet">EVM payout address (Base, Ethereum, BNB Chain)</Label>
              <Input
                id="wallet"
                value={receivingAddress}
                onChange={(e) => setReceivingAddress(e.target.value)}
                placeholder="0x…"
                aria-invalid={evmInvalid}
                className="font-mono"
              />
              {evmInvalid && <p className="text-xs text-red-700">That isn't a valid EVM address.</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="solana">Solana payout address</Label>
              <Input
                id="solana"
                value={solanaAddress}
                onChange={(e) => setSolanaAddress(e.target.value)}
                placeholder="Wallet address"
                aria-invalid={solInvalid}
                className="font-mono"
              />
              {solInvalid && <p className="text-xs text-red-700">That isn't a valid Solana wallet address.</p>}
            </div>
          </>
        )}
      </CardContent>
      {!loading && !loadError && (
        <CardFooter>
          <Button onClick={handleSave} disabled={saving || evmInvalid || solInvalid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

const ApiKey: React.FC = () => {
  const [masked, setMasked] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((p) => setMasked(p.apiKey ?? null))
      .catch(() => undefined);
  }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const { apiKey } = await api.generateApiKey();
      setFresh(apiKey);
      setMasked(`${apiKey.slice(0, 10)}...`);
    } catch (error) {
      toast.error(apiError(error, "Couldn't generate a key"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={18} className="text-brand" /> API key
        </CardTitle>
        <CardDescription>
          Manage payment links from your own backend. Send it as the <code>x-api-key</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fresh ? (
          <OneTimeSecret label="API key" value={fresh} onDone={() => setFresh(null)} />
        ) : (
          <p className="font-mono text-sm text-ink">{masked ?? <span className="font-sans text-ink-soft">No key yet</span>}</p>
        )}

        {masked ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={busy}>
                Roll key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Roll your API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current key stops working immediately. Anything using it will need the new one.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={generate}>Roll key</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={generate} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate key
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const Webhooks: React.FC = () => {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['payment.completed']);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const load = () =>
    api
      .getWebhooks()
      .then(setHooks)
      .catch(() => undefined)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const toggle = (event: string) =>
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const created = await api.createWebhook(url.trim(), events);
      setSecret(created.secret);
      setUrl('');
      await load();
    } catch (error) {
      toast.error(apiError(error, "Couldn't add the webhook"));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteWebhook(id);
      setHooks((prev) => prev.filter((h) => h.id !== id));
      toast.success('Webhook removed');
    } catch (error) {
      toast.error(apiError(error, "Couldn't remove the webhook"));
    }
  };

  const test = async (id: string) => {
    try {
      await api.testWebhook(id);
      toast.success('Test event sent');
    } catch (error) {
      toast.error(apiError(error, "Couldn't send a test event"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WebhookIcon size={18} className="text-brand" /> Webhooks
        </CardTitle>
        <CardDescription>
          GuardPay POSTs signed events to these URLs. Verify the <code>X-GuardPay-Signature</code> header with your
          webhook secret. Failed deliveries are retried for several hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {secret && <OneTimeSecret label="Webhook secret" value={secret} onDone={() => setSecret(null)} />}

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        ) : hooks.length === 0 ? (
          <p className="text-sm text-ink-soft">No webhooks yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {hooks.map((h) => (
              <li key={h.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm text-ink">{h.url}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{h.events.join(', ')}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => test(h.id)}>
                    <Send size={14} className="mr-1.5" /> Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(h.id)} aria-label="Remove webhook">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="space-y-3 rounded-lg bg-muted/50 p-4">
          <div className="grid gap-2">
            <Label htmlFor="hook-url">Endpoint URL</Label>
            <Input
              id="hook-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/guardpay"
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Events</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 font-mono text-xs text-ink">
                  <Checkbox checked={events.includes(event)} onCheckedChange={() => toggle(event)} />
                  {event}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="sm" disabled={adding || events.length === 0}>
            {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add webhook
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const DashboardSettings: React.FC = () => (
  <div className="space-y-6 p-4 sm:p-6">
    <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Settings</h1>
    <div className="grid max-w-3xl gap-6">
      <Profile />
      <ApiKey />
      <Webhooks />
    </div>
  </div>
);

export default DashboardSettings;
