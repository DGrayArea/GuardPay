'use client';

import React, { useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, EscrowConfig } from '@/lib/api';

interface Props {
  trigger: React.ReactNode;
  onCreated: () => void;
}

const CreateEscrowDialog: React.FC<Props> = ({ trigger, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EscrowConfig | null>(null);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [network, setNetwork] = useState<'evm' | 'solana'>('evm');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState('');

  useEffect(() => {
    if (open && !config) api.getEscrowConfig().then(setConfig).catch(() => {});
  }, [open, config]);

  const isSolanaAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
  const validAddress = network === 'solana' ? isSolanaAddress : isAddress;
  const counterpartyInvalid = counterparty.length > 0 && !validAddress(counterparty);
  const chainConfig = config?.chains?.[network];
  const tokenSymbol = chainConfig?.token.symbol ?? config?.token.symbol;
  const amountNum = Number(amount);
  const feePreview =
    config && amountNum > 0 ? (amountNum * config.fee.bps) / 10_000 : 0;

  const reset = () => {
    setTitle('');
    setAmount('');
    setCounterparty('');
    setDescription('');
    setConditions('');
    setRole('buyer');
    setNetwork('evm');
  };

  const submit = async () => {
    if (!title.trim() || !amount || !counterparty) {
      toast.error('Title, amount and counterparty are required');
      return;
    }
    if (!validAddress(counterparty)) {
      toast.error(
        `That is not a valid ${network === 'solana' ? 'Solana' : 'EVM'} address`
      );
      return;
    }
    if (!(amountNum > 0)) {
      toast.error('Amount must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      await api.createEscrow({
        title: title.trim(),
        amount: String(amountNum),
        counterparty,
        role,
        network,
        description: description.trim() || undefined,
        conditions: conditions.trim() || undefined,
      });
      toast.success('Escrow created');
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Could not create the escrow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New escrow</DialogTitle>
          <DialogDescription>
            {network === 'evm'
              ? 'Funds stay locked in an audited on-chain contract until the buyer releases them.'
              : 'Funds stay in a vault held for this deal until the buyer releases them.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="esc-title">What is this for?</Label>
            <Input
              id="esc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website redesign, milestone 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="esc-network">Network</Label>
            <Select value={network} onValueChange={(v) => setNetwork(v as 'evm' | 'solana')}>
              <SelectTrigger id="esc-network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evm">Base — held by contract</SelectItem>
                <SelectItem value="solana">Solana — held by GuardPay</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-soft">
              {network === 'evm'
                ? 'Funds sit in an audited on-chain escrow. GuardPay cannot move them, and you can reclaim directly if the deal stalls.'
                : 'Funds sit in a GuardPay-controlled vault for this deal. Simpler to fund, but you are trusting GuardPay to honour the release.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="esc-role">Your role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'buyer' | 'seller')}>
                <SelectTrigger id="esc-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">I&apos;m paying (buyer)</SelectItem>
                  <SelectItem value="seller">I&apos;m getting paid (seller)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="esc-amount">Amount {tokenSymbol ? `(${tokenSymbol})` : ''}</Label>
              <Input
                id="esc-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="esc-counterparty">
              {role === 'buyer' ? "Seller's" : "Buyer's"} {network === 'solana' ? 'Solana' : 'EVM'}{' '}
              address
            </Label>
            <Input
              id="esc-counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={network === 'solana' ? 'Base58 address…' : '0x…'}
              className={counterpartyInvalid ? 'border-destructive' : undefined}
              aria-invalid={counterpartyInvalid}
            />
            {counterpartyInvalid && (
              <p className="text-xs text-destructive">
                That is not a valid {network === 'solana' ? 'Solana' : 'EVM'} address.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="esc-conditions">Release conditions</Label>
            <Textarea
              id="esc-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
              placeholder="What has to happen before the funds are released?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="esc-description">Description (optional)</Label>
            <Textarea
              id="esc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {config && amountNum > 0 && (
            <dl className="space-y-1 rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Held in escrow</dt>
                <dd className="tabular-nums text-ink">
                  {amountNum.toFixed(2)} {tokenSymbol}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">
                  Escrow fee ({(config.fee.bps / 100).toFixed(2)}%)
                </dt>
                <dd className="tabular-nums text-ink">
                  {feePreview.toFixed(2)} {tokenSymbol}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-1 font-medium">
                <dt className="text-ink">Seller receives</dt>
                <dd className="tabular-nums text-ink">
                  {(amountNum - feePreview).toFixed(2)} {tokenSymbol}
                </dd>
              </div>
            </dl>
          )}

          {config && chainConfig && !chainConfig.configured && (
            <p className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-xs text-ink">
              {network === 'solana' ? 'Solana' : 'Base'} escrow is not configured on this server,
              so deals on it cannot be funded yet.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="bg-escrow text-white hover:bg-escrow/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create escrow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEscrowDialog;
