/**
 * Messages Page - Booking-Centric Chat System
 * Similar to Airbnb's messaging interface
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  MessageCircle, 
  Calendar, 
  MapPin, 
  Clock,
  User,
  ChevronLeft,
  ChevronDown,
  MoreVertical,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Scissors,
  LogOut,
  LayoutDashboard,
  Info,
  X,
  DollarSign,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import messageService from '../services/message.service';
import socketService from '../services/socket.service';
import { usePlatform } from '../utils/platform';
import Avatar from '../components/Avatar';
import Card from '../components/Card';
import Button from '../components/Button';
import BarberBookingRequestsDropdown from '../components/booking/BarberBookingRequestsDropdown';
import { CampusCutLogo } from '@assets';
import type { Conversation, Message } from '../types';
import toast from 'react-hot-toast';

interface ConversationWithDetails extends Conversation {
  booking?: {
    id?: string;
    serviceName: string;
    servicePrice?: number;
    scheduledTime: string;
    location: string;
    locationDetails?: string;
    status: 'pending' | 'accepted' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';
    notes?: string;
    barberName?: string;
    consumerName?: string;
  };
  otherUser: {
    id: string;
    username?: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    userType: 'student' | 'barber';
    barberInfo?: {
      displayName?: string;
      specialties?: string[];
      rating?: number;
    };
  };
  lastMessage?: {
    content: string;
    senderId: string;
    time: string;
  };
  unreadCount: number;
  // Whether the barber has accepted this conversation/booking
  isAccepted?: boolean;
}

interface MessageWithSender {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  sender_id?: string;
  senderId?: string;
  content: string;
  message_type?: 'text' | 'image' | 'system';
  messageType?: 'text' | 'image' | 'system';
  media_url?: string;
  mediaUrl?: string;
  is_read?: boolean;
  isRead?: boolean;
  created_at?: string;
  createdAt?: string;
  sender?: {
    id: string;
    username?: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  isOwn?: boolean;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const location = useLocation();
  const { user } = useAuthStore();
  const platform = usePlatform();
  const platformPrefix = `/${platform}`;
  
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine the view based on the URL path
  // /barber/messages = barber view, /consumer/messages = consumer view
  const isBarberView = location.pathname.includes('/barber/messages');
  
  const barberId = user?.id || '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle navigation state for starting a BOOKING-CENTRIC conversation
  const startConversationData = location.state as { 
    startConversation?: boolean; 
    otherUserId?: string; 
    bookingId?: string;
    // Booking context for CampusCuts
    serviceName?: string;
    servicePrice?: number;
    scheduledAt?: string;
    location?: string;
    locationDetails?: string;
    notes?: string;
    barberName?: string;
    consumerName?: string;
    barberProfilePicture?: string;
    consumerProfilePicture?: string;
  } | null;

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await messageService.getConversations();
      // Handle both response formats: { conversations: [...] } and { data: [...] }
      const conversationsData = (response as any).conversations || (response as any).data || [];
      if (Array.isArray(conversationsData)) {
        setConversations(conversationsData as ConversationWithDetails[]);
      } else {
        console.warn('Unexpected conversations response format:', response);
        setConversations([]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, []);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const response = await messageService.getMessages(convId);
      // Handle various response formats: { messages: [...] }, { data: [...] }, or direct array
      const messagesData = (response as any).messages || 
                          (response as any).data || 
                          (Array.isArray(response) ? response : []);
      if (Array.isArray(messagesData)) {
        setMessages(messagesData as MessageWithSender[]);
        // Mark as read
        await messageService.markConversationAsRead(convId);
        // Update unread count in conversations list
        setConversations(prev => prev.map(c => 
          c.id === convId ? { ...c, unreadCount: 0 } : c
        ));
      } else {
        console.warn('Unexpected messages response format:', response);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchConversations();
      setIsLoading(false);
    };
    loadData();
  }, [fetchConversations]);

  // Track if we've already attempted to start a conversation to prevent retry loops
  const hasAttemptedConversation = useRef(false);

  // Handle starting a new BOOKING-CENTRIC conversation from navigation state
  useEffect(() => {
    const startNewConversation = async () => {
      // Only attempt once per page load to prevent retry loops
      if (
        startConversationData?.startConversation && 
        startConversationData.otherUserId && 
        !isCreatingConversation &&
        !hasAttemptedConversation.current
      ) {
        hasAttemptedConversation.current = true;
        setIsCreatingConversation(true);
        try {
          // Create BOOKING-CENTRIC conversation with full service context
          const response = await messageService.createConversation({
            other_user_id: startConversationData.otherUserId,
            booking_id: startConversationData.bookingId,
            // Pass booking context for CampusCuts service-centric messaging
            service_name: startConversationData.serviceName,
            service_price: startConversationData.servicePrice,
            scheduled_time: startConversationData.scheduledAt,
            location: startConversationData.location,
            location_details: startConversationData.locationDetails,
            notes: startConversationData.notes,
            barber_name: startConversationData.barberName,
            consumer_name: startConversationData.consumerName,
            barber_profile_picture: startConversationData.barberProfilePicture,
            consumer_profile_picture: startConversationData.consumerProfilePicture,
          });
          
          // Refresh conversations list
          await fetchConversations();
          
          // Navigate to the conversation
          const convId = (response as any).id || (response as any).conversation?.id || (response as any).data?.conversation?.id;
          if (convId) {
            const messagesPath = isBarberView ? 'barber/messages' : 'consumer/messages';
            navigate(`${platformPrefix}/${messagesPath}/${convId}`, { replace: true, state: null });
          }
        } catch (error) {
          console.error('Failed to create conversation:', error);
          toast.error('Failed to start conversation. Please try again later.');
          // Clear the state to prevent showing a loading state forever
          const messagesPath = isBarberView ? 'barber/messages' : 'consumer/messages';
          navigate(`${platformPrefix}/${messagesPath}`, { replace: true, state: null });
        } finally {
          setIsCreatingConversation(false);
        }
      }
    };
    
    startNewConversation();
  }, [startConversationData, isCreatingConversation, fetchConversations, navigate, platformPrefix, isBarberView]);

  // Handle conversation selection from URL
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
        fetchMessages(conversationId);
        setShowMobileChat(true);
      }
    }
  }, [conversationId, conversations, fetchMessages]);

  // Socket.io real-time messages
  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      // Add to messages if in current conversation
      if (selectedConversation && message.conversation_id === selectedConversation.id) {
        setMessages(prev => [...prev, message as unknown as MessageWithSender]);
        scrollToBottom();
        // Mark as read since we're viewing
        messageService.markConversationAsRead(message.conversation_id);
      }
      
      // Update conversation list
      fetchConversations();
    };

    socketService.onNewMessage(handleNewMessage);
    
    return () => {
      socketService.offNewMessage(handleNewMessage);
    };
  }, [selectedConversation, fetchConversations, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle selecting a conversation
  const handleSelectConversation = (conv: ConversationWithDetails) => {
    setSelectedConversation(conv);
    fetchMessages(conv.id);
    setShowMobileChat(true);
    const messagesPath = isBarberView ? 'barber/messages' : 'consumer/messages';
    navigate(`${platformPrefix}/${messagesPath}/${conv.id}`, { replace: true });
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Optimistic update
    const optimisticMessage: MessageWithSender = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_id: user?.id || '',
      content: messageContent,
      message_type: 'text',
      is_read: true,
      created_at: new Date().toISOString(),
      isOwn: true,
      sender: {
        id: user?.id || '',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      const response = await messageService.sendMessage(selectedConversation.id, messageContent);
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id ? { ...response, isOwn: true } as unknown as MessageWithSender : m
      ));
      
      // Update conversations list
      fetchConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle back button on mobile
  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
    const messagesPath = isBarberView ? 'barber/messages' : 'consumer/messages';
    navigate(`${platformPrefix}/${messagesPath}`, { replace: true });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
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

  // Render conversation list
  const renderConversationList = () => (
    <div className="flex flex-col h-full">
      {/* Header - Title only */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
            <p className="text-gray-500 mb-4">
              {isBarberView 
                ? "When customers book with you, you can message them here."
                : "When you book a service, you can message your barber here."}
            </p>
            <Button 
              onClick={() => navigate(isBarberView ? `${platformPrefix}/barber` : `${platformPrefix}/consumer`)} 
              variant="primary"
            >
              {isBarberView ? "Go to Dashboard" : "Find a Barber"}
            </Button>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation?.id === conv.id ? 'bg-primary-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  {conv.otherUser?.profilePicture ? (
                    <img 
                      src={conv.otherUser.profilePicture} 
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {conv.otherUser?.firstName} {conv.otherUser?.lastName}
                    </h3>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {conv.lastMessage?.time ? formatTime(conv.lastMessage.time) : ''}
                    </span>
                  </div>
                  
                  {/* Booking context */}
                  {conv.booking && (
                    <div className="flex items-center gap-1 text-xs text-primary-600 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span className="truncate">{conv.booking.serviceName}</span>
                    </div>
                  )}

                  {/* Last message */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate">
                      {conv.lastMessage?.content || 'No messages yet'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-primary-500 text-white text-xs font-bold rounded-full flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render chat view
  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50">
          <MessageCircle className="w-20 h-20 text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a conversation</h3>
          <p className="text-gray-500">Choose a conversation from the list to start messaging</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToList}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              {selectedConversation.otherUser?.profilePicture ? (
                <img 
                  src={selectedConversation.otherUser.profilePicture} 
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">
                {selectedConversation.otherUser?.firstName} {selectedConversation.otherUser?.lastName}
              </h2>
              {selectedConversation.booking && (
                <p className="text-xs text-gray-500 truncate">
                  {selectedConversation.booking.serviceName} • {new Date(selectedConversation.booking.scheduledTime).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Service Details Button - Mobile Only (panel is visible on desktop) */}
            <button 
              onClick={() => setShowServiceDetails(true)}
              className="md:hidden p-2 hover:bg-primary-50 rounded-lg transition-colors"
              title="View Service Details"
            >
              <Info className="w-5 h-5 text-primary-600" />
            </button>
          </div>

          {/* Pending Status Banner - Show when barber hasn't accepted yet */}
          {selectedConversation.booking?.status === 'pending' && !isBarberView && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Request Pending</span> - Your messages will be delivered once the barber accepts your booking request.
                </p>
              </div>
            </div>
          )}

          {/* Compact Booking Context Bar - Mobile: Interactive button | Desktop: Static display */}
          {selectedConversation.booking && (
            <>
              {/* Mobile - Interactive button to open service details modal */}
              <button 
                onClick={() => setShowServiceDetails(true)}
                className="md:hidden mt-3 w-full p-3 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-primary-700">
                      <Scissors className="w-4 h-4" />
                      <span className="font-medium">{selectedConversation.booking.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary-700">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary-700">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedConversation.booking.status === 'accepted' || selectedConversation.booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      selectedConversation.booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      selectedConversation.booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      selectedConversation.booking.status === 'cancelled' || selectedConversation.booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedConversation.booking.status}
                    </span>
                    <ChevronDown className="w-4 h-4 text-primary-600" />
                  </div>
                </div>
              </button>

              {/* Desktop - Static display (service details visible in right panel) */}
              <div className="hidden md:block mt-3 w-full p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-primary-700">
                      <Scissors className="w-4 h-4" />
                      <span className="font-medium">{selectedConversation.booking.serviceName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary-700">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary-700">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedConversation.booking.status === 'accepted' || selectedConversation.booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    selectedConversation.booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    selectedConversation.booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    selectedConversation.booking.status === 'cancelled' || selectedConversation.booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedConversation.booking.status}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, idx) => {
                const senderId = message.senderId || message.sender_id;
                const isOwn = senderId === user?.id || (message as any).isOwn;
                const prevSenderId = messages[idx - 1]?.senderId || messages[idx - 1]?.sender_id;
                const showAvatar = !isOwn && (idx === 0 || prevSenderId !== senderId);
                
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwn && showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {message.sender?.profilePicture ? (
                          <img 
                            src={message.sender.profilePicture} 
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8 flex-shrink-0" />}
                    
                    <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwn 
                            ? 'bg-primary-500 text-white rounded-br-sm' 
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs text-gray-400">
                          {formatTime(message.createdAt || message.created_at)}
                        </span>
                        {isOwn && (
                          (message.isRead || message.is_read)
                            ? <CheckCheck className="w-3 h-3 text-primary-500" />
                            : <Check className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ImageIcon className="w-5 h-5 text-gray-500" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className={`p-2 rounded-full transition-colors ${
                newMessage.trim() && !isSending
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Header - Same as BarberPage/ConsumerPage */}
      <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between relative">
            {/* Left section - Dashboard + Switch button */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Dashboard Button */}
              <button
                onClick={() => {
                  const destination = isBarberView ? `${platformPrefix}/barber` : `${platformPrefix}/consumer`;
                  navigate(destination);
                }}
                className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-300"
                title="Back to Dashboard"
              >
                <LayoutDashboard className="w-4 h-4 text-gray-600" />
                <span className="hidden lg:inline text-sm font-medium text-gray-700">Dashboard</span>
              </button>
              
              {/* Switch View Button */}
              {isBarberView ? (
                <button
                  onClick={() => navigate(`${platformPrefix}/consumer`)}
                  className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                  title="Switch to Consumer view"
                >
                  <Calendar className="w-4 h-4 text-primary-600" />
                  <span className="hidden sm:inline text-sm font-medium text-primary-700">Switch to Consumer</span>
                </button>
              ) : (
                // Only show "Switch to Barber" if user is a barber or campus manager
                (user?.user_type === 'barber' || user?.user_type === 'campus_manager' || user?.has_barber_profile) ? (
                  <button
                    onClick={() => navigate(`${platformPrefix}/barber`)}
                    className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                    title="Switch to Barber view"
                  >
                    <Scissors className="w-4 h-4 text-primary-600" />
                    <span className="hidden sm:inline text-sm font-medium text-primary-700">Switch to Barber</span>
                  </button>
                ) : null
              )}
            </div>
            
            {/* Center section - Logo always centered */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <img src={CampusCutLogo} alt="CampusCut" className="h-10 sm:h-12 w-auto" />
            </div>
            
            {/* Right section - Messages, Booking Requests (if barber) + Profile */}
            <div className="flex items-center gap-1.5 sm:gap-4">
              
              {/* Booking Requests Inbox - only for barbers */}
              {isBarberView && <BarberBookingRequestsDropdown barberId={barberId} />}

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Avatar src={user?.profile_picture_url} alt={user?.first_name || 'User'} size="md" />
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-w-[calc(100vw-2rem)]">
                    {(user?.user_type === 'admin' || user?.is_admin) && (
                      <>
                        <button
                          onClick={() => {
                            navigate(`${platformPrefix}/admin-role-select`);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                        >
                          <ArrowLeft className="w-4 h-4 text-gray-500" />
                          Back to Roles
                        </button>
                        <div className="border-t border-gray-200 my-1"></div>
                      </>
                    )}
                    <button
                      onClick={() => {
                        useAuthStore.getState().logout();
                        navigate(`${platformPrefix}`);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop Layout - Three Column */}
        <div className="hidden md:flex h-full">
          {/* Conversation List - Fixed Width */}
          <div className="w-80 lg:w-96 border-r border-gray-200 bg-white flex-shrink-0">
            {renderConversationList()}
          </div>
          
          {/* Chat View - Reduced Width */}
          <div className="flex-1 max-w-2xl border-r border-gray-200">
            {renderChatView()}
          </div>

          {/* Service Details Panel - Right Side (Desktop Only) */}
          <div className="w-80 lg:w-96 bg-white flex-shrink-0 overflow-y-auto">
            {selectedConversation?.booking ? (
              <div className="h-full flex flex-col">
                {/* Panel Header */}
                <div className="bg-gradient-to-r from-primary-500 to-primary-400 px-5 py-4">
                  <h2 className="text-lg font-bold text-white">Service Details</h2>
                  <p className="text-white/80 text-sm">Booking Information</p>
                </div>

                {/* Panel Content */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {/* Service Name & Price */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                        <Scissors className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{selectedConversation.booking.serviceName}</h3>
                        <p className="text-xs text-gray-500">Service</p>
                      </div>
                    </div>
                    {selectedConversation.booking.servicePrice && (
                      <p className="text-base font-bold text-gray-900">${selectedConversation.booking.servicePrice}</p>
                    )}
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs">Date</span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm">
                        {new Date(selectedConversation.booking.scheduledTime).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">Time</span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm">
                        {new Date(selectedConversation.booking.scheduledTime).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs">Location</span>
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{selectedConversation.booking.location || 'TBD'}</p>
                  </div>

                  {/* Status */}
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedConversation.booking.status === 'accepted' || selectedConversation.booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      selectedConversation.booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      selectedConversation.booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      selectedConversation.booking.status === 'cancelled' || selectedConversation.booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedConversation.booking.status === 'pending' ? 'Awaiting Acceptance' :
                       selectedConversation.booking.status === 'accepted' ? 'Accepted' :
                       selectedConversation.booking.status === 'confirmed' ? 'Confirmed' :
                       selectedConversation.booking.status === 'completed' ? 'Completed' :
                       selectedConversation.booking.status === 'cancelled' ? 'Cancelled' :
                       selectedConversation.booking.status === 'rejected' ? 'Rejected' :
                       selectedConversation.booking.status}
                    </span>
                  </div>

                  {/* Notes */}
                  {selectedConversation.booking.notes && (
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-xs">Notes</span>
                      </div>
                      <p className="text-gray-900 text-sm">{selectedConversation.booking.notes}</p>
                    </div>
                  )}

                  {/* Barber/Consumer Info */}
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {selectedConversation.otherUser?.profilePicture ? (
                          <img 
                            src={selectedConversation.otherUser.profilePicture} 
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {selectedConversation.otherUser?.firstName} {selectedConversation.otherUser?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {isBarberView ? 'Customer' : 'Barber'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-gray-50">
                <Info className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-base font-semibold text-gray-600 mb-1">Service Details</h3>
                <p className="text-sm text-gray-500">Select a conversation to view booking details</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout - Toggle Between List and Chat */}
        <div className="md:hidden h-full">
          {showMobileChat && selectedConversation ? (
            renderChatView()
          ) : (
            renderConversationList()
          )}
        </div>
      </div>

      {/* Service Details Modal - Mobile Only */}
      {showServiceDetails && selectedConversation?.booking && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 md:hidden"
          onClick={() => setShowServiceDetails(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-400 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Service Details</h2>
                <p className="text-white/80 text-sm">Booking Information</p>
              </div>
              <button 
                onClick={() => setShowServiceDetails(false)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Service Name & Price */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedConversation.booking.serviceName}</h3>
                    <p className="text-sm text-gray-500">Service</p>
                  </div>
                </div>
                {selectedConversation.booking.servicePrice && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">${selectedConversation.booking.servicePrice}</p>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">Date</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedConversation.booking.scheduledTime).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Time</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedConversation.booking.scheduledTime).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs">Location</span>
                </div>
                <p className="font-medium text-gray-900">{selectedConversation.booking.location || 'TBD'}</p>
                {selectedConversation.booking.locationDetails && (
                  <p className="text-sm text-gray-600 mt-1">{selectedConversation.booking.locationDetails}</p>
                )}
              </div>

              {/* Status */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                      selectedConversation.booking.status === 'accepted' || selectedConversation.booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      selectedConversation.booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      selectedConversation.booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      selectedConversation.booking.status === 'cancelled' || selectedConversation.booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedConversation.booking.status === 'pending' ? 'Awaiting Acceptance' :
                       selectedConversation.booking.status === 'accepted' ? 'Accepted' :
                       selectedConversation.booking.status === 'confirmed' ? 'Confirmed' :
                       selectedConversation.booking.status === 'completed' ? 'Completed' :
                       selectedConversation.booking.status === 'cancelled' ? 'Cancelled' :
                       selectedConversation.booking.status === 'rejected' ? 'Rejected' :
                       selectedConversation.booking.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedConversation.booking.notes && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs">Notes</span>
                  </div>
                  <p className="text-gray-900">{selectedConversation.booking.notes}</p>
                </div>
              )}

              {/* Barber/Consumer Info */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {selectedConversation.otherUser?.profilePicture ? (
                      <img 
                        src={selectedConversation.otherUser.profilePicture} 
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedConversation.otherUser?.firstName} {selectedConversation.otherUser?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isBarberView ? 'Customer' : 'Barber'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                onClick={() => setShowServiceDetails(false)}
                variant="primary"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

