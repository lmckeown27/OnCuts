/**
 * Gas Wallet Manager Component
 * 
 * Admin interface for managing platform gas wallet:
 * - Connect Aptos wallet (Petra/Pontem)
 * - View gas balance and estimates
 * - Create and approve top-up requests
 * - Sign transactions to transfer APT
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import gasWalletService, { type GasEstimate, type TopUpRequest } from '../services/gas-wallet.service';
import Card from './Card';
import Button from './Button';
import Loading from './Loading';
import toast from 'react-hot-toast';
import { Wallet, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import Decimal from 'decimal.js';

const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

export default function GasWalletManager() {
  const {
    connect,
    disconnect,
    account,
    connected,
    wallet,
    signAndSubmitTransaction,
  } = useWallet();

  const [estimate, setEstimate] = useState<GasEstimate | null>(null);
  const [topUpRequests, setTopUpRequests] = useState<TopUpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
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

  const handleConnectWallet = async (walletName: string) => {
    try {
      await connect(walletName);
      toast.success(`Connected to ${walletName}`);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      toast.error(`Failed to connect: ${error.message}`);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnect();
      toast.success('Wallet disconnected');
    } catch (error: any) {
      console.error('Failed to disconnect wallet:', error);
      toast.error('Failed to disconnect');
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

      setActiveRequestId(request.id);
      setCustomAmount('');

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Failed to create top-up request:', error);
      toast.error(error.response?.data?.error || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTopUp = async (request: TopUpRequest) => {
    if (!connected || !account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert APT to octas (1 APT = 100,000,000 octas)
      const amountOctas = new Decimal(request.requested_amount_apt)
        .times(100_000_000)
        .toDecimalPlaces(0, Decimal.ROUND_UP)
        .toNumber();

      // Prepare transaction payload
      const transaction = {
        data: {
          function: '0x1::aptos_account::transfer',
          typeArguments: [],
          functionArguments: [
            request.gas_wallet_address,
            amountOctas,
          ],
        },
      };

      toast.loading('Waiting for wallet signature...');

      // Sign and submit transaction
      const response = await signAndSubmitTransaction(transaction);

      toast.dismiss();
      toast.success('Transaction submitted!');

      // Confirm with backend
      const confirmResult = await gasWalletService.confirmTopUpRequest(
        request.id,
        response.hash,
        account.address
      );

      toast.success('Verification started. Tx hash: ' + response.hash.substring(0, 10) + '...');

      // Reload data
      await loadData();

      setIsTopUpModalOpen(false);
      setActiveRequestId(null);
    } catch (error: any) {
      console.error('Failed to approve top-up:', error);
      toast.dismiss();
      toast.error(error.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
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

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Wallet Connection */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gas Wallet Management</h2>
            <p className="text-gray-600 mt-1">Monitor platform gas and approve top-up requests</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={loadData} variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            {!connected ? (
              <Button onClick={() => handleConnectWallet('Petra')} size="sm">
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-600">Connected: {wallet?.name}</p>
                  <p className="text-xs font-mono">{account?.address.substring(0, 10)}...</p>
                </div>
                <Button onClick={handleDisconnectWallet} variant="secondary" size="sm">
                  Disconnect
                </Button>
              </div>
            )}
          </div>
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
                    onClick={() => handleApproveTopUp(request)}
                    disabled={!connected || isSubmitting}
                    size="sm"
                  >
                    {isSubmitting ? 'Processing...' : 'Approve & Sign'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top-Up Modal */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use estimated amount: {estimate?.amountNeededAPT.toFixed(6)} APT
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> After creating the request, you'll need to connect your wallet and sign a transaction to transfer APT to the platform gas wallet.
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
    </div>
  );
}

