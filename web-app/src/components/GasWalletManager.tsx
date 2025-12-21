// @ts-nocheck
/**
 * Gas Wallet Manager Component
 * 
 * Admin interface for managing platform gas wallet:
 * - View gas balance and estimates
 * - Create top-up requests
 * - Manual APT transfer instructions (Petra/CLI)
 * - Submit transaction hash for verification
 */

import { useState, useEffect } from 'react';
import gasWalletService, { type GasEstimate, type TopUpRequest } from '../services/gas-wallet.service';
import Card from './Card';
import Button from './Button';
import Loading from './Loading';
import toast from 'react-hot-toast';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp, Copy, ExternalLink } from 'lucide-react';
import Decimal from 'decimal.js';

export default function GasWalletManager() {
  const [estimate, setEstimate] = useState<GasEstimate | null>(null);
  const [topUpRequests, setTopUpRequests] = useState<TopUpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TopUpRequest | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load gas estimate
      const estimateData = await gasWalletService.getEstimate();
      setEstimate(estimateData);

      // Load pending top-up requests
      const requestsData = await gasWalletService.listTopUpRequests('pending', 10);
      setTopUpRequests(requestsData.data || []);

      setIsLoading(false);
    } catch (error: any) {
      console.error('Failed to load gas wallet data:', error);
      toast.error('Failed to load gas wallet data');
      setIsLoading(false);
    }
  };

  const handleCreateTopUpRequest = async () => {
    try {
      setIsSubmitting(true);

      const amount = customAmount ? parseFloat(customAmount) : undefined;

      if (customAmount && (isNaN(amount!) || amount! <= 0)) {
        toast.error('Invalid amount');
        setIsSubmitting(false);
        return;
      }

      // Create top-up request
      const idempotencyKey = `topup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const request = await gasWalletService.createTopUpRequest(amount, idempotencyKey);

      toast.success(`Top-up request created: ${request.requested_amount_apt.toFixed(6)} APT`);

      setCustomAmount('');
      setIsTopUpModalOpen(false);

      // Reload data
      await loadData();

      // Open confirm modal for the new request
      setSelectedRequest(request);
      setIsConfirmModalOpen(true);
    } catch (error: any) {
      console.error('Failed to create top-up request:', error);
      toast.error(error.response?.data?.error || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitTxHash = async () => {
    if (!selectedRequest || !txHash || !fromAddress) {
      toast.error('Please provide transaction hash and sender address');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await gasWalletService.confirmTopUpRequest(
        selectedRequest.id,
        txHash,
        fromAddress
      );

      toast.success('Transaction submitted for verification!');
      toast.success('Verification may take up to 10 minutes');

      setTxHash('');
      setFromAddress('');
      setIsConfirmModalOpen(false);
      setSelectedRequest(null);

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Failed to submit tx hash:', error);
      toast.error(error.response?.data?.error || 'Failed to submit transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getHealthStatusColor = (days: number) => {
    if (days < 1) return 'text-red-600';
    if (days < 3) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getHealthStatusBadge = (days: number) => {
    if (days < 1) return (
      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Critical
      </span>
    );
    if (days < 3) return (
      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Low
      </span>
    );
    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Healthy
      </span>
    );
  };

  const convertAPTToOctas = (apt: number): number => {
    return new Decimal(apt).times(100_000_000).toDecimalPlaces(0, Decimal.ROUND_UP).toNumber();
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gas Wallet Management</h2>
            <p className="text-gray-600 mt-1">Monitor platform gas and approve top-up requests</p>
          </div>

          <Button onClick={loadData} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Gas Balance & Estimate */}
      {estimate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {estimate.currentBalanceAPT.toFixed(6)} APT
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ≈ ${(estimate.currentBalanceAPT * 10).toFixed(2)} USD
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-sm text-gray-600">Estimated Coverage</p>
              <p className={`text-3xl font-bold mt-2 ${getHealthStatusColor(estimate.estimatedCoverageDays)}`}>
                {estimate.estimatedCoverageDays.toFixed(1)} days
              </p>
              <div className="mt-3">
                {getHealthStatusBadge(estimate.estimatedCoverageDays)}
              </div>
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-sm text-gray-600">Amount Needed</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {estimate.amountNeededAPT.toFixed(6)} APT
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Next {estimate.metadata.estimationHorizon}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Estimation Metadata */}
      {estimate && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Estimation Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Pending Writes</p>
              <p className="font-semibold text-gray-900">{estimate.metadata.pendingWrites}</p>
            </div>
            <div>
              <p className="text-gray-600">Avg Gas/Write</p>
              <p className="font-semibold text-gray-900">{estimate.metadata.avgGasPerWrite} APT</p>
            </div>
            <div>
              <p className="text-gray-600">Safety Buffer</p>
              <p className="font-semibold text-gray-900">{estimate.metadata.safetyBufferPct}%</p>
            </div>
            <div>
              <p className="text-gray-600">Horizon</p>
              <p className="font-semibold text-gray-900">{estimate.metadata.estimationHorizon}</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Platform Gas Wallet:</strong>
              <span className="font-mono ml-2">{estimate.gasWalletAddress}</span>
              <button
                onClick={() => copyToClipboard(estimate.gasWalletAddress, 'Address')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <Copy className="w-3 h-3 inline" />
              </button>
            </p>
          </div>
        </Card>
      )}

      {/* Top-Up Request Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top-Up Requests</h3>
          <Button onClick={() => setIsTopUpModalOpen(true)} size="sm">
            Create Top-Up Request
          </Button>
        </div>

        {topUpRequests.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No pending top-up requests</p>
        ) : (
          <div className="space-y-3">
            {topUpRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-lg">
                      {request.requested_amount_apt.toFixed(6)} APT
                    </p>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      request.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created: {new Date(request.created_at).toLocaleString()}
                  </p>
                  {request.approved_tx_hash && (
                    <p className="text-xs font-mono text-gray-500 mt-1">
                      Tx: {request.approved_tx_hash.substring(0, 20)}...
                    </p>
                  )}
                </div>

                {request.status === 'pending' && (
                  <Button
                    onClick={() => {
                      setSelectedRequest(request);
                      setIsConfirmModalOpen(true);
                    }}
                    size="sm"
                  >
                    Transfer APT
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Top-Up Modal */}
      {isTopUpModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setIsTopUpModalOpen(false);
            setCustomAmount('');
          }}
        >
          <Card 
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Create Top-Up Request</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (APT)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="Auto-calculated if empty"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use estimated amount: {estimate?.amountNeededAPT.toFixed(6)} APT
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  After creating the request, you'll get instructions to transfer APT using Petra wallet or Aptos CLI.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCreateTopUpRequest}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Request'}
                </Button>
                <Button
                  onClick={() => {
                    setIsTopUpModalOpen(false);
                    setCustomAmount('');
                  }}
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Transfer Instructions & Confirmation Modal */}
      {isConfirmModalOpen && selectedRequest && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setIsConfirmModalOpen(false);
            setSelectedRequest(null);
            setTxHash('');
            setFromAddress('');
          }}
        >
          <Card 
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Transfer APT to Gas Wallet</h3>

            {/* Transfer Details */}
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-50 border-2 border-primary-300 rounded-lg">
                <p className="text-sm font-semibold text-primary-700 mb-2">Transfer Amount:</p>
                <p className="text-3xl font-bold text-primary-400">
                  {selectedRequest.requested_amount_apt.toFixed(6)} APT
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  = {convertAPTToOctas(selectedRequest.requested_amount_apt).toLocaleString()} octas
                </p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 mb-2">Destination Address:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1 break-all">
                    {selectedRequest.gas_wallet_address}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedRequest.gas_wallet_address, 'Address')}
                    className="text-primary-400 hover:text-primary-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions Tabs */}
            <div className="mb-6">
              <h4 className="font-semibold mb-3">Choose your transfer method:</h4>

              {/* Petra Wallet Instructions */}
              <div className="mb-4 p-4 border border-gray-300 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-primary-400">Option 1: Petra Wallet</h5>
                  <a
                    href="https://petra.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-400 hover:text-primary-600 flex items-center gap-1"
                  >
                    Install Petra <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>Open Petra wallet extension</li>
                  <li>Click "Send"</li>
                  <li>Paste destination address: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{selectedRequest.gas_wallet_address.substring(0, 15)}...</code></li>
                  <li>Enter amount: <strong>{selectedRequest.requested_amount_apt.toFixed(6)} APT</strong></li>
                  <li>Review & confirm transaction</li>
                  <li>Copy the transaction hash from Petra</li>
                  <li>Paste it below to complete verification</li>
                </ol>
              </div>

              {/* Aptos CLI Instructions */}
              <div className="p-4 border border-gray-300 rounded-lg">
                <h5 className="font-semibold text-primary-400 mb-2">Option 2: Aptos CLI</h5>
                <p className="text-sm text-gray-600 mb-2">Run this command:</p>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
                  <code>
                    aptos account transfer \<br />
                    &nbsp;&nbsp;--account YOUR_WALLET_PROFILE \<br />
                    &nbsp;&nbsp;--receiver-account {selectedRequest.gas_wallet_address} \<br />
                    &nbsp;&nbsp;--amount {convertAPTToOctas(selectedRequest.requested_amount_apt)}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(
                    `aptos account transfer --account YOUR_WALLET_PROFILE --receiver-account ${selectedRequest.gas_wallet_address} --amount ${convertAPTToOctas(selectedRequest.requested_amount_apt)}`,
                    'Command'
                  )}
                  className="mt-2 text-xs text-primary-400 hover:text-primary-600 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy Command
                </button>
              </div>
            </div>

            {/* Confirmation Form */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h4 className="font-semibold">After Transfer Completion:</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Hash <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="0xabc123def456..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Copy from Petra wallet or CLI output
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Wallet Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="0x789abc..."
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The address you sent APT from
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Verification:</strong> After submitting, the backend will verify your transaction on the Aptos blockchain. This may take up to 10 minutes.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSubmitTxHash}
                  disabled={isSubmitting || !txHash || !fromAddress}
                  className="flex-1"
                >
                  {isSubmitting ? 'Verifying...' : 'Submit for Verification'}
                </Button>
                <Button
                  onClick={() => {
                    setIsConfirmModalOpen(false);
                    setSelectedRequest(null);
                    setTxHash('');
                    setFromAddress('');
                  }}
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
