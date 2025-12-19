/**
 * Real-Time Transaction Feed
 * 
 * Shows live transactions for a specific campus
 * Connects to Socket.IO for real-time updates
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

interface Transaction {
  id: string;
  type: 'booking' | 'payment' | 'completion' | 'withdrawal' | 'deposit';
  timestamp: string;
  amount?: number;
  from?: string;
  to?: string;
  fromName?: string;
  toName?: string;
  fromId?: string;
  toId?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  description: string;
  txHash?: string;
}

interface RealtimeTransactionFeedProps {
  campusId?: string;
  maxItems?: number;
}

// Mock transaction data for testing
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'booking',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    amount: 25.00,
    from: '0x1234567890abcdef1234567890abcdef',
    to: '0xabcdef1234567890abcdef1234567890',
    fromName: 'Sarah Johnson',
    toName: 'Mike Williams',
    fromId: 'student-1',
    toId: 'barber-1',
    status: 'confirmed',
    description: 'New booking: Fade Haircut',
    txHash: '0xabc123def456...',
  },
  {
    id: '2',
    type: 'payment',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    amount: 30.00,
    from: '0x9876543210fedcba9876543210fedcba',
    to: '0xfedcba9876543210fedcba9876543210',
    fromName: 'James Chen',
    toName: 'Alex Rodriguez',
    fromId: 'student-2',
    toId: 'barber-2',
    status: 'completed',
    description: 'Payment completed via Stripe',
    txHash: '0xdef789ghi012...',
  },
  {
    id: '3',
    type: 'completion',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    amount: 22.50,
    from: '0x1111222233334444555566667777888',
    to: '0x8888777766665555444433332222111',
    fromName: 'Emily Davis',
    toName: 'Jordan Taylor',
    fromId: 'student-3',
    toId: 'barber-3',
    status: 'completed',
    description: 'Service completed: Beard Trim',
    txHash: '0xghi345jkl678...',
  },
  {
    id: '4',
    type: 'deposit',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    amount: 50.00,
    status: 'completed',
    description: 'Stripe deposit: $50.00',
  },
  {
    id: '5',
    type: 'withdrawal',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    amount: 180.00,
    from: '0x5555666677778888999900001111222',
    fromName: 'Chris Martinez',
    fromId: 'barber-4',
    status: 'confirmed',
    description: 'Barber withdrawal',
    txHash: '0xjkl901mno234...',
  },
  {
    id: '6',
    type: 'booking',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    amount: 28.00,
    from: '0x2222333344445555666677778888999',
    to: '0x9999888877776666555544443333222',
    fromName: 'David Lee',
    toName: 'Taylor Anderson',
    fromId: 'student-4',
    toId: 'barber-5',
    status: 'confirmed',
    description: 'New booking: Full Service',
    txHash: '0xmno567pqr890...',
  },
  {
    id: '7',
    type: 'payment',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    amount: 35.00,
    from: '0x3333444455556666777788889999000',
    to: '0x0000999988887777666655554444333',
    fromName: 'Jessica Brown',
    toName: 'Morgan Smith',
    fromId: 'student-5',
    toId: 'barber-6',
    status: 'completed',
    description: 'Payment completed via blockchain',
    txHash: '0xpqr123stu456...',
  },
  {
    id: '8',
    type: 'booking',
    timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
    amount: 20.00,
    from: '0x4444555566667777888899990000111',
    to: '0x1111000099998888777766665555444',
    fromName: 'Ryan Wilson',
    toName: 'Casey Johnson',
    fromId: 'student-6',
    toId: 'barber-7',
    status: 'pending',
    description: 'New booking: Haircut',
    txHash: '0xstu789vwx012...',
  },
];

export const RealtimeTransactionFeed: React.FC<RealtimeTransactionFeedProps> = ({
  campusId,
  maxItems = 20,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // For testing: Skip Socket.IO connection when backend is not available
    // Uncomment this section when backend is running
    
    /*
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
    */
    
    // Mock mode: simulate disconnected state
    console.log('📝 Using mock transaction data (Socket.IO disabled for testing)');
    setIsConnected(false);
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
      } else {
        // Use mock data on API failure
        console.log('Using mock transaction data for testing');
        // Randomize the order to simulate "reloading"
        const shuffled = [...MOCK_TRANSACTIONS].sort(() => Math.random() - 0.5);
        setTransactions(shuffled.slice(0, maxItems));
      }
    } catch (error) {
      console.error('Failed to fetch recent transactions:', error);
      console.log('Using mock transaction data for testing');
      // Randomize the order to simulate "reloading"
      const shuffled = [...MOCK_TRANSACTIONS].sort(() => Math.random() - 0.5);
      setTransactions(shuffled.slice(0, maxItems));
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
            className="px-3 py-1.5 text-sm font-medium text-primary-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-1.5"
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
                  <div className="text-sm font-medium text-primary-400 mb-1">
                    ${tx.amount.toFixed(2)}
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {tx.fromName && tx.fromId ? (
                    <span>
                      From:{' '}
                      <Link
                        to={`/admin/user/${tx.fromId}`}
                        className="text-primary-400 hover:text-primary-600 hover:underline font-semibold"
                      >
                        {tx.fromName}
                      </Link>
                    </span>
                  ) : tx.from ? (
                    <span>From: {formatAddress(tx.from)}</span>
                  ) : null}
                  {tx.toName && tx.toId ? (
                    <span>
                      To:{' '}
                      <Link
                        to={`/admin/user/${tx.toId}`}
                        className="text-primary-400 hover:text-primary-600 hover:underline font-semibold"
                      >
                        {tx.toName}
                      </Link>
                    </span>
                  ) : tx.to ? (
                    <span>To: {formatAddress(tx.to)}</span>
                  ) : null}
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
            className="text-sm text-primary-400 hover:text-primary-500 font-medium"
          >
            Refresh Transactions
          </button>
        </div>
      )}
    </div>
  );
};

export default RealtimeTransactionFeed;

