/**
 * Real-Time Transaction Feed
 * 
 * Shows live transactions for a specific campus
 * Connects to Socket.IO for real-time updates
 */

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Transaction {
  id: string;
  type: 'booking' | 'payment' | 'completion' | 'withdrawal' | 'deposit';
  timestamp: string;
  amount?: number;
  from?: string;
  to?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  description: string;
  txHash?: string;
}

interface RealtimeTransactionFeedProps {
  campusId?: string;
  maxItems?: number;
}

export const RealtimeTransactionFeed: React.FC<RealtimeTransactionFeedProps> = ({
  campusId,
  maxItems = 20,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO
    const newSocket = io('http://localhost:3001', {
      transports: ['polling', 'websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to transaction feed');
      setIsConnected(true);
      
      // Join campus-specific room if provided
      if (campusId) {
        newSocket.emit('join-campus', campusId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from transaction feed');
      setIsConnected(false);
    });

    // Listen for blockchain transactions
    newSocket.on('blockchain-transaction', (tx: any) => {
      const transaction: Transaction = {
        id: tx.hash || tx.id,
        type: mapTransactionType(tx.type),
        timestamp: tx.timestamp || new Date().toISOString(),
        amount: tx.amount,
        from: tx.from || tx.student_addr,
        to: tx.to || tx.barber_addr,
        status: tx.success ? 'confirmed' : 'pending',
        description: tx.description || getTransactionDescription(tx),
        txHash: tx.hash,
      };

      setTransactions((prev) => [transaction, ...prev].slice(0, maxItems));
    });

    // Listen for booking events
    newSocket.on('booking-created', (booking: any) => {
      const transaction: Transaction = {
        id: booking.id,
        type: 'booking',
        timestamp: booking.created_at || new Date().toISOString(),
        amount: booking.amount_total,
        from: booking.student_addr,
        to: booking.barber_addr,
        status: 'confirmed',
        description: `New booking: ${booking.service_name}`,
      };

      setTransactions((prev) => [transaction, ...prev].slice(0, maxItems));
    });

    // Listen for payment events
    newSocket.on('payment-completed', (payment: any) => {
      const transaction: Transaction = {
        id: payment.id,
        type: 'payment',
        timestamp: payment.timestamp || new Date().toISOString(),
        amount: payment.amount,
        status: 'completed',
        description: `Payment completed via ${payment.method}`,
      };

      setTransactions((prev) => [transaction, ...prev].slice(0, maxItems));
    });

    // Listen for Stripe events
    newSocket.on('stripe-event', (event: any) => {
      if (event.type === 'payment_intent.succeeded') {
        const transaction: Transaction = {
          id: event.data.id,
          type: 'deposit',
          timestamp: new Date().toISOString(),
          amount: event.data.amount / 100,
          status: 'completed',
          description: `Stripe deposit: $${(event.data.amount / 100).toFixed(2)}`,
        };

        setTransactions((prev) => [transaction, ...prev].slice(0, maxItems));
      }
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [campusId, maxItems]);

  // Fetch initial transactions
  useEffect(() => {
    fetchRecentTransactions();
  }, [campusId]);

  const fetchRecentTransactions = async () => {
    try {
      const endpoint = campusId
        ? `/api/admin/transactions?campus=${campusId}&limit=${maxItems}`
        : `/api/admin/transactions?limit=${maxItems}`;
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
    }
  };

  const mapTransactionType = (type: string): Transaction['type'] => {
    if (type.includes('booking')) return 'booking';
    if (type.includes('payment')) return 'payment';
    if (type.includes('complete')) return 'completion';
    if (type.includes('withdraw')) return 'withdrawal';
    if (type.includes('deposit')) return 'deposit';
    return 'payment';
  };

  const getTransactionDescription = (tx: any): string => {
    if (tx.service_name) return `Booking: ${tx.service_name}`;
    if (tx.type === 'deposit') return 'Funds deposited';
    if (tx.type === 'withdrawal') return 'Barber withdrawal';
    if (tx.type === 'completion') return 'Service completed';
    return 'Transaction';
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'booking':
        return 'BOOK';
      case 'payment':
        return 'PAY';
      case 'completion':
        return 'DONE';
      case 'withdrawal':
        return 'OUT';
      case 'deposit':
        return 'IN';
      default:
        return 'TXN';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Live Transactions</h3>
          <p className="text-sm text-gray-600">Real-time blockchain activity</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRecentTransactions}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
            title="Reload transactions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload
          </button>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2 font-bold text-gray-400">TXN</div>
          <p>No transactions yet</p>
          <p className="text-sm mt-1">Transactions will appear here in real-time</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">
                    {tx.description}
                  </span>
                </div>
                
                {tx.amount && (
                  <div className="text-sm font-medium text-indigo-600 mb-1">
                    ${tx.amount.toFixed(2)}
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {tx.from && (
                    <span>From: {formatAddress(tx.from)}</span>
                  )}
                  {tx.to && (
                    <span>To: {formatAddress(tx.to)}</span>
                  )}
                  <span>{formatTimestamp(tx.timestamp)}</span>
                </div>
                
                {tx.txHash && (
                  <a
                    href={`https://explorer.aptoslabs.com/txn/${tx.txHash}?network=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={fetchRecentTransactions}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Refresh Transactions
          </button>
        </div>
      )}
    </div>
  );
};

export default RealtimeTransactionFeed;

