/**
 * Admin Wallet Connect Component
 * 
 * Allows admin to connect their Aptos wallet (Petra, Martian, Fewcha)
 * Shows gas wallet balance and enables APT transfers
 */

import React, { useState, useEffect } from 'react';
import { Types } from 'aptos';

// Wallet adapter types (install: npm install @aptos-labs/wallet-adapter-react)
interface AptosWallet {
  name: string;
  url: string;
  icon: string;
  readyState: 'Installed' | 'NotDetected' | 'Loadable';
}

interface WalletAdapter {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  account: () => Promise<{ address: string; publicKey: string }> | null;
  signAndSubmitTransaction: (transaction: Types.TransactionPayload) => Promise<{hash: string}>;
  network: () => Promise<{name: string; chainId: string}>;
  connected: boolean;
  wallets: AptosWallet[];
}

interface GasWalletStatus {
  address: string;
  balance_apt: number;
  min_threshold: number;
  needs_topup: boolean;
  estimated_coverage_days: number;
}

export const AdminWalletConnect: React.FC = () => {
  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null);
  const [connected, setConnected] = useState(false);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [adminBalance, setAdminBalance] = useState<number>(0);
  const [gasWallet, setGasWallet] = useState<GasWalletStatus | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet adapter
  useEffect(() => {
    // This would normally use @aptos-labs/wallet-adapter-react
    // For now, we'll simulate the interface
    
    const initWallet = async () => {
      // Check for Petra
      if ((window as any).aptos) {
        console.log('✅ Petra wallet detected');
      }
      // Check for Martian
      if ((window as any).martian) {
        console.log('✅ Martian wallet detected');
      }
    };

    initWallet();
  }, []);

  // Fetch gas wallet status
  const fetchGasWalletStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/gas/wallet/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setGasWallet(data.wallet);
      }
    } catch (err) {
      console.error('Failed to fetch gas wallet status:', err);
    }
  };

  // Connect wallet
  const handleConnect = async (walletName: 'petra' | 'martian' | 'fewcha') => {
    setLoading(true);
    setError(null);
    
    try {
      let wallet: any;
      
      if (walletName === 'petra' && (window as any).aptos) {
        wallet = (window as any).aptos;
      } else if (walletName === 'martian' && (window as any).martian) {
        wallet = (window as any).martian;
      } else {
        throw new Error(`${walletName} wallet not detected. Please install it first.`);
      }

      // Connect to wallet
      const response = await wallet.connect();
      const account = await wallet.account();
      
      setConnected(true);
      setAdminAddress(account.address);
      
      // Fetch balance
      await fetchAdminBalance(account.address);
      
      // Fetch gas wallet status
      await fetchGasWalletStatus();
      
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Wallet connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet
  const handleDisconnect = async () => {
    if ((window as any).aptos) {
      await (window as any).aptos.disconnect();
    } else if ((window as any).martian) {
      await (window as any).martian.disconnect();
    }
    
    setConnected(false);
    setAdminAddress(null);
    setAdminBalance(0);
    setGasWallet(null);
  };

  // Fetch admin wallet balance
  const fetchAdminBalance = async (address: string) => {
    try {
      // Query Aptos node for balance
      const response = await fetch(
        `https://fullnode.devnet.aptoslabs.com/v1/accounts/${address}/resource/0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>`
      );
      const data = await response.json();
      const balance = parseInt(data.data.coin.value) / 100_000_000; // Convert octas to APT
      setAdminBalance(balance);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  // Transfer APT to gas wallet
  const handleTransfer = async () => {
    if (!adminAddress || !gasWallet) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const amountOctas = Math.floor(parseFloat(transferAmount) * 100_000_000);
      
      // Build transaction
      const transaction: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: '0x1::coin::transfer',
        type_arguments: ['0x1::aptos_coin::AptosCoin'],
        arguments: [gasWallet.address, amountOctas.toString()],
      };

      // Sign and submit via wallet
      let hash: string;
      if ((window as any).aptos) {
        const result = await (window as any).aptos.signAndSubmitTransaction(transaction);
        hash = result.hash;
      } else if ((window as any).martian) {
        const result = await (window as any).martian.signAndSubmitTransaction(transaction);
        hash = result.hash;
      } else {
        throw new Error('No wallet connected');
      }

      // Wait for confirmation
      await waitForTransaction(hash);
      
      // Refresh balances
      await fetchAdminBalance(adminAddress);
      await fetchGasWalletStatus();
      
      setTransferAmount('');
      alert(`✅ Successfully transferred ${transferAmount} APT to gas wallet!`);
      
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
      console.error('Transfer error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Wait for transaction confirmation
  const waitForTransaction = async (txHash: string): Promise<void> => {
    const url = `https://fullnode.devnet.aptoslabs.com/v1/transactions/by_hash/${txHash}`;
    
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (err) {
        // Keep waiting
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Transaction confirmation timeout');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Admin Wallet Connection</h2>
        
        {/* Connection Status */}
        {!connected ? (
          <div className="space-y-4">
            <p className="text-gray-600 mb-4">
              Connect your Aptos wallet to manage the platform's gas wallet
            </p>
            
            {/* Wallet Options */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleConnect('petra')}
                disabled={loading}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🔷</div>
                  <div className="font-semibold">Petra</div>
                  <div className="text-xs text-gray-500">Most Popular</div>
                </div>
              </button>
              
              <button
                onClick={() => handleConnect('martian')}
                disabled={loading}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">👽</div>
                  <div className="font-semibold">Martian</div>
                  <div className="text-xs text-gray-500">Alternative</div>
                </div>
              </button>
              
              <button
                onClick={() => handleConnect('fewcha')}
                disabled={loading}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🦄</div>
                  <div className="font-semibold">Fewcha</div>
                  <div className="text-xs text-gray-500">Legacy</div>
                </div>
              </button>
            </div>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Wallet Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-green-600 font-semibold mb-1">
                    ✅ Wallet Connected
                  </div>
                  <div className="font-mono text-sm text-gray-700">
                    {adminAddress?.substring(0, 10)}...{adminAddress?.substring(adminAddress.length - 8)}
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-2">
                    {adminBalance.toFixed(4)} APT
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
            
            {/* Gas Wallet Status */}
            {gasWallet && (
              <div className="border-2 border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Platform Gas Wallet</h3>
                  {gasWallet.needs_topup && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                      ⚠️ Needs Top-Up
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-mono text-sm">
                      {gasWallet.address.substring(0, 10)}...{gasWallet.address.substring(gasWallet.address.length - 8)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Balance:</span>
                    <span className="text-2xl font-bold">
                      {gasWallet.balance_apt.toFixed(4)} APT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Minimum Threshold:</span>
                    <span className="font-semibold">
                      {gasWallet.min_threshold.toFixed(4)} APT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Coverage:</span>
                    <span className="font-semibold">
                      {gasWallet.estimated_coverage_days} days
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          gasWallet.balance_apt >= gasWallet.min_threshold * 2
                            ? 'bg-green-500'
                            : gasWallet.balance_apt >= gasWallet.min_threshold
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (gasWallet.balance_apt / (gasWallet.min_threshold * 2)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Transfer Form */}
            {gasWallet && (
              <div className="border-2 border-indigo-200 rounded-lg p-6 bg-indigo-50">
                <h3 className="text-lg font-semibold mb-4">Transfer APT to Gas Wallet</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (APT)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={adminBalance}
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setTransferAmount('1')}
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        1 APT
                      </button>
                      <button
                        onClick={() => setTransferAmount('5')}
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        5 APT
                      </button>
                      <button
                        onClick={() => setTransferAmount('10')}
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        10 APT
                      </button>
                      <button
                        onClick={() => setTransferAmount(adminBalance.toString())}
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleTransfer}
                    disabled={loading || !transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > adminBalance}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Processing...' : `Transfer ${transferAmount || '0'} APT`}
                  </button>
                </div>
                
                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWalletConnect;

