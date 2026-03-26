/**
 * Withdrawal Options — Sui USDC settlement + optional MoonPay in-app bank off-ramp (platform fee buffer).
 */

import React, { useState } from 'react';
import { DollarSign, Clock, AlertCircle, Landmark } from 'lucide-react';
import Button from './Button';
import walletV2Service from '../services/wallet-v2.service';
import toast from 'react-hot-toast';

interface WithdrawalOptionsProps {
  availableBalance: number;
  onSuccess?: () => void;
}

const WithdrawalOptions: React.FC<WithdrawalOptionsProps> = ({ availableBalance, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [moonPayLoading, setMoonPayLoading] = useState(false);

  const handleWithdraw = async () => {
    if (!amount) {
      toast.error('Enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);

    if (amountNum < 10) {
      toast.error('Minimum withdrawal is $10');
      return;
    }

    if (amountNum > availableBalance) {
      toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    if (!destinationAddress.trim()) {
      toast.error('Enter your Sui wallet address');
      return;
    }

    setIsProcessing(true);

    try {
      await walletV2Service.withdrawOnChain(amountNum, destinationAddress.trim(), 'sui');
      toast.success('Withdrawal queued. USDC will be sent on Sui per batching policy.');
      setAmount('');
      setDestinationAddress('');
      onSuccess?.();
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoonPayBankOut = async () => {
    const amountNum = parseFloat(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum < 10) {
      toast.error('Enter at least $10 for bank cash-out');
      return;
    }
    if (amountNum > availableBalance) {
      toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    setMoonPayLoading(true);
    try {
      const prep = await walletV2Service.prepareMoonPayOfframp(amountNum);
      const { loadMoonPay } = await import('@moonpay/moonpay-js');
      const initMoonPay = await loadMoonPay();
      if (!initMoonPay) {
        toast.error('MoonPay could not load. Check your connection or try again.');
        return;
      }
      const widget = initMoonPay({
        flow: 'sell',
        environment: prep.moonpay.environment,
        platform: 'web',
        variant: 'overlay',
        params: {
          apiKey: prep.moonpay.publishableKey,
          walletAddress: prep.walletAddress,
          baseCurrencyCode: prep.moonpay.baseCurrencyCode,
          baseCurrencyAmount: prep.moonpay.baseCurrencyAmount,
          lockAmount: prep.moonpay.lockAmount,
          externalCustomerId: prep.externalCustomerId,
          quoteCurrencyCode: 'usd',
        },
      });
      widget.show();
      toast.success(
        `About $${prep.netUsd.toFixed(2)} to your bank after MoonPay. Extra USDC was added so their fee is covered.`
      );
      setAmount('');
      onSuccess?.();
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Could not start MoonPay cash-out');
    } finally {
      setMoonPayLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Withdraw funds</h3>
      <p className="text-sm text-gray-600 mb-4">
        Send USDC to any Sui address, or cash out to your bank in-app with MoonPay (sandbox/mainnet per backend
        config). Platform covers MoonPay fees so you keep the amount you enter.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="10"
            step="0.01"
            max={availableBalance}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Available: ${availableBalance.toFixed(2)} • Minimum: $10
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sui wallet address</label>
        <input
          type="text"
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder="0x… (64 hex)"
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
        />
      </div>

      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start">
          <Clock className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            On-chain withdrawals may be batched for gas efficiency. Settlement is USDC on Sui.
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900">
          For booking revenue, ensure your payout Sui address is saved under{' '}
          <strong>Barber dashboard → Payment Management</strong> so Checkout can attach it automatically.
        </p>
      </div>

      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Bank (MoonPay)
        </p>
        <p className="text-xs text-gray-600 mb-3">
          Uses the same dollar amount above. We send extra USDC to your saved Sui wallet so MoonPay&apos;s fee
          doesn&apos;t reduce what hits your bank. Requires MoonPay on the server and works on mainnet USDC (use
          MoonPay sandbox for testing).
        </p>
        <Button
          type="button"
          onClick={() => void handleMoonPayBankOut()}
          disabled={!amount || moonPayLoading || parseFloat(amount) < 10 || Number.isNaN(parseFloat(amount))}
          variant="secondary"
          className="w-full"
        >
          {moonPayLoading ? 'Preparing…' : 'Cash out to bank (MoonPay)'}
        </Button>
      </div>

      <Button
        onClick={() => void handleWithdraw()}
        disabled={!amount || isProcessing || parseFloat(amount) < 10}
        variant="primary"
        className="w-full"
      >
        {isProcessing ? 'Processing…' : 'Withdraw to Sui'}
      </Button>
    </div>
  );
};

export default WithdrawalOptions;
