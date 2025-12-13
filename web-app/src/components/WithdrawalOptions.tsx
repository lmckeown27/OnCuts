/**
 * Withdrawal Options Component
 * 
 * Allows users to choose between bank and on-chain withdrawals
 */

import React, { useState } from 'react';
import { DollarSign, Clock, Zap, AlertCircle } from 'lucide-react';
import Button from './Button';
import walletV2Service from '../services/wallet-v2.service';
import toast from 'react-hot-toast';

interface WithdrawalOptionsProps {
  availableBalance: number;
  onSuccess?: () => void;
}

const WithdrawalOptions: React.FC<WithdrawalOptionsProps> = ({
  availableBalance,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'bank' | 'onchain' | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWithdraw = async () => {
    if (!selectedMethod || !amount) {
      toast.error('Please select a withdrawal method and amount');
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

    if (selectedMethod === 'onchain' && !destinationAddress) {
      toast.error('Please enter a destination address');
      return;
    }

    setIsProcessing(true);

    try {
      if (selectedMethod === 'bank') {
        await walletV2Service.withdrawToBank(amountNum);
        toast.success('Withdrawal processed! Funds will arrive instantly.');
      } else {
        await walletV2Service.withdrawOnChain(amountNum, destinationAddress, 'aptos');
        toast.success('Withdrawal queued for batching. Will be processed within 15 minutes.');
      }

      setAmount('');
      setDestinationAddress('');
      setSelectedMethod(null);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdraw Funds</h3>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount
        </label>
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

      {/* Withdrawal Methods */}
      <div className="space-y-3 mb-6">
        {/* Bank Withdrawal */}
        <button
          onClick={() => setSelectedMethod('bank')}
          className={`
            w-full p-4 rounded-lg border-2 text-left transition-all
            ${selectedMethod === 'bank'
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <Zap className={`h-5 w-5 mr-3 mt-0.5 ${selectedMethod === 'bank' ? 'text-primary-400' : 'text-gray-400'}`} />
              <div>
                <div className="font-medium text-gray-900">Bank Transfer (Instant)</div>
                <div className="text-sm text-gray-600 mt-1">
                  Via Stripe Connect • Arrives instantly
                </div>
              </div>
            </div>
            {selectedMethod === 'bank' && (
              <div className="w-5 h-5 rounded-full bg-primary-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
          </div>
        </button>

        {/* On-Chain Withdrawal */}
        <button
          onClick={() => setSelectedMethod('onchain')}
          className={`
            w-full p-4 rounded-lg border-2 text-left transition-all
            ${selectedMethod === 'onchain'
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <Clock className={`h-5 w-5 mr-3 mt-0.5 ${selectedMethod === 'onchain' ? 'text-primary-400' : 'text-gray-400'}`} />
              <div>
                <div className="font-medium text-gray-900">On-Chain (Batched)</div>
                <div className="text-sm text-gray-600 mt-1">
                  To Aptos wallet • Processed within 15 minutes
                </div>
                <div className="text-xs text-green-600 mt-1 font-medium">
                  Lower fees • Batched for efficiency
                </div>
              </div>
            </div>
            {selectedMethod === 'onchain' && (
              <div className="w-5 h-5 rounded-full bg-primary-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Destination Address (On-Chain Only) */}
      {selectedMethod === 'onchain' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aptos Wallet Address
          </label>
          <input
            type="text"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
            placeholder="0x..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
          />
        </div>
      )}

      {/* Info Box */}
      {selectedMethod && (
        <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              {selectedMethod === 'bank' ? (
                <span>
                  Instant payouts are processed immediately via Stripe Connect.
                  Make sure your bank account is connected.
                </span>
              ) : (
                <span>
                  On-chain withdrawals are batched every 15 minutes for gas efficiency.
                  You'll save up to 99.8% on transaction fees!
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Button */}
      <Button
        onClick={handleWithdraw}
        disabled={!selectedMethod || !amount || isProcessing || parseFloat(amount) < 10}
        variant="primary"
        className="w-full"
      >
        {isProcessing ? 'Processing...' : 'Withdraw Funds'}
      </Button>
    </div>
  );
};

export default WithdrawalOptions;

