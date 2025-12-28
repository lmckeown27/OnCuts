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
  Settings,
  LogOut,
  LayoutDashboard
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
    serviceName: string;
    scheduledTime: string;
    location: string;
    status: string;
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
}

interface MessageWithSender {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  media_url?: string;
  is_read: boolean;
  created_at: string;
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

  // Handle navigation state for starting a new conversation
  const startConversationData = location.state as { 
    startConversation?: boolean; 
    otherUserId?: string; 
    bookingId?: string;
  } | null;

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await messageService.getConversations();
      if (response.data) {
        setConversations(response.data as unknown as ConversationWithDetails[]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, []);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const response = await messageService.getMessages(convId);
      if (response.data) {
        const messagesData = Array.isArray(response.data) ? response.data : (response.data as any).messages || [];
        setMessages(messagesData as MessageWithSender[]);
        // Mark as read
        await messageService.markConversationAsRead(convId);
        // Update unread count in conversations list
        setConversations(prev => prev.map(c => 
          c.id === convId ? { ...c, unreadCount: 0 } : c
        ));
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

  // Handle starting a new conversation from navigation state
  useEffect(() => {
    const startNewConversation = async () => {
      if (startConversationData?.startConversation && startConversationData.otherUserId && !isCreatingConversation) {
        setIsCreatingConversation(true);
        try {
          // Create or get existing conversation
          const response = await messageService.createConversation({
            other_user_id: startConversationData.otherUserId,
            booking_id: startConversationData.bookingId
          });
          
          // Refresh conversations list
          await fetchConversations();
          
          // Navigate to the conversation
          const convId = (response as any).id || (response as any).conversation?.id;
          if (convId) {
            const messagesPath = isBarberView ? 'barber/messages' : 'consumer/messages';
            navigate(`${platformPrefix}/${messagesPath}/${convId}`, { replace: true, state: null });
          }
        } catch (error) {
          console.error('Failed to create conversation:', error);
          toast.error('Failed to start conversation');
        } finally {
          setIsCreatingConversation(false);
        }
      }
    };
    
    startNewConversation();
  }, [startConversationData, isCreatingConversation, fetchConversations, navigate, platformPrefix]);

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

            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Booking context banner */}
          {selectedConversation.booking && (
            <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-primary-700">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary-700">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(selectedConversation.booking.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary-700">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate max-w-[100px]">{selectedConversation.booking.location}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedConversation.booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  selectedConversation.booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  selectedConversation.booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedConversation.booking.status}
                </span>
              </div>
            </div>
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
                const isOwn = message.sender_id === user?.id || message.isOwn;
                const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].sender_id !== message.sender_id);
                
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
                          {formatTime(message.created_at)}
                        </span>
                        {isOwn && (
                          message.is_read 
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
                <button
                  onClick={() => navigate(`${platformPrefix}/barber`)}
                  className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-200"
                  title="Switch to Barber view"
                >
                  <Scissors className="w-4 h-4 text-primary-600" />
                  <span className="hidden sm:inline text-sm font-medium text-primary-700">Switch to Barber</span>
                </button>
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
        {/* Desktop Layout - Side by Side */}
        <div className="hidden md:flex h-full">
          {/* Conversation List - Fixed Width */}
          <div className="w-80 lg:w-96 border-r border-gray-200 bg-white flex-shrink-0">
            {renderConversationList()}
          </div>
          
          {/* Chat View - Flexible Width */}
          <div className="flex-1">
            {renderChatView()}
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
    </div>
  );
}

