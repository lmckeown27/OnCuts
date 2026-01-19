import { io, Socket } from 'socket.io-client';
import { WS_URL, STORAGE_KEYS } from '../config/constants';
import type { Message, Booking } from '../types';

type SocketEventHandler = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) {
      console.warn('Cannot connect to socket without authentication token');
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected');
      this.isConnected = true;
      
      // Join personal room
      const user = localStorage.getItem(STORAGE_KEYS.USER);
      if (user) {
        const userId = JSON.parse(user).id;
        this.socket?.emit('join-personal', userId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event: string, handler: SocketEventHandler): void {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: SocketEventHandler): void {
    if (handler) {
      this.socket?.off(event, handler);
    } else {
      this.socket?.off(event);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, attempting to reconnect...');
      this.connect();
    }
    this.socket?.emit(event, ...args);
  }

  // Message-specific methods
  joinConversation(conversationId: string): void {
    this.emit('join-conversation', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.emit('leave-conversation', conversationId);
  }

  sendMessage(conversationId: string, content: string): void {
    this.emit('send-message', { conversationId, content });
  }

  onNewMessage(handler: (message: Message) => void): void {
    this.on('new-message', handler);
  }

  offNewMessage(handler?: (message: Message) => void): void {
    this.off('new-message', handler);
  }

  // Booking-specific methods
  onBookingUpdate(handler: (booking: Booking) => void): void {
    this.on('booking-update', handler);
  }

  offBookingUpdate(handler?: (booking: Booking) => void): void {
    this.off('booking-update', handler);
  }

  // New booking request methods (for barbers)
  onNewBookingRequest(handler: (booking: any) => void): void {
    this.on('new-booking-request', handler);
  }

  offNewBookingRequest(handler?: (booking: any) => void): void {
    this.off('new-booking-request', handler);
  }

  // Booking completed methods (for consumers - payment request)
  onBookingCompleted(handler: (data: {
    bookingId: string;
    status: string;
    barberName: string;
    serviceName: string;
    price: number;
    priceFormatted: string;
    paymentUrl: string;
    scheduledDate: string;
    scheduledTime: string;
    location: string;
  }) => void): void {
    this.on('booking-completed', handler);
  }

  offBookingCompleted(handler?: (data: any) => void): void {
    this.off('booking-completed', handler);
  }

  // Notification methods
  onNotification(handler: (notification: any) => void): void {
    this.on('notification', handler);
  }

  offNotification(handler?: (notification: any) => void): void {
    this.off('notification', handler);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export default new SocketService();

