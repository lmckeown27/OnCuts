/**
 * CM Barber Chats Modal
 * 
 * Allows campus managers to view and chat with all barbers on their campus.
 */

import { useState, useEffect } from 'react';
import { X, MessageCircle, Search, RefreshCw } from 'lucide-react';
import Avatar from './Avatar';
import messageService from '../services/message.service';

interface Barber {
  userId: string;
  barberId: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
  conversationId: number | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface CMBarberChatsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectBarber: (barberUserId: string, conversationId: number | null) => void;
}

export default function CMBarberChatsModal({ isVisible, onClose, onSelectBarber }: CMBarberChatsModalProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isVisible) {
      fetchBarbers();
    }
  }, [isVisible]);

  const fetchBarbers = async () => {
    try {
      setLoading(true);
      const result = await messageService.getCMBarberConversations();
      setBarbers(result.barbers);
    } catch (error) {
      console.error('Failed to fetch barbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBarbers = barbers.filter(barber =>
    barber.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    barber.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div 
      className={`fixed inset-0 min-h-[100dvh] flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-150 ease-out ${isVisible ? 'bg-black/50' : 'bg-black/0'}`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[88vh] overflow-hidden flex flex-col transition-all duration-150 ease-out
          ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl z-10 flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary-600" />
              Barber Chats
            </h2>
            <p className="text-sm text-gray-500">Chat with barbers on your campus</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search barbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Barbers List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : filteredBarbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm">
                {searchQuery ? 'No barbers found' : 'No barbers on your campus yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBarbers.map((barber) => (
                <button
                  key={barber.barberId}
                  onClick={() => onSelectBarber(barber.userId, barber.conversationId)}
                  className="w-full p-4 hover:bg-gray-50 transition-colors flex items-start gap-3 text-left"
                >
                  <Avatar 
                    src={barber.avatarUrl} 
                    alt={barber.name} 
                    size="lg" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{barber.name}</h3>
                      {barber.lastMessageAt && (
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatTime(barber.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{barber.email}</p>
                    {barber.lastMessage ? (
                      <p className="text-sm text-gray-600 truncate mt-1">{barber.lastMessage}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic mt-1">No messages yet</p>
                    )}
                  </div>
                  {barber.unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-primary-500 text-white text-xs font-bold rounded-full">
                      {barber.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

