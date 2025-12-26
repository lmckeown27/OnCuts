// API Configuration - Uses environment variables from .env
// Production fallback uses EC2 public IP; for local dev, set VITE_API_URL in .env
export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://13.57.219.149:3001/api/v1';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://13.57.219.149:3001';
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';

// Aptos Blockchain Configuration
export const APTOS_NETWORK = import.meta.env.VITE_APTOS_NETWORK || 'devnet';
export const APTOS_NODE_URL = import.meta.env.VITE_APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
export const APTOS_MODULE_ADDRESS = import.meta.env.VITE_APTOS_MODULE_ADDRESS || '';

// App Metadata
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'CampusCut';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  CAMPUS_SELECT: '/campus-select',
  ADMIN: '/admin',
  CONSUMER: '/consumer',
  BARBER: '/barber',
  WALLET: '/wallet',
  
  // Student routes
  STUDENT_DISCOVERY: '/student/discovery',
  STUDENT_BARBER_DETAIL: '/student/barber/:id',
  STUDENT_BOOKING: '/student/booking/:barberId',
  STUDENT_BOOKINGS: '/student/bookings',
  STUDENT_PROFILE: '/student/profile',
  STUDENT_MESSAGES: '/student/messages',
  
  // Barber routes
  BARBER_DASHBOARD: '/barber/dashboard',
  BARBER_CALENDAR: '/barber/calendar',
  BARBER_EARNINGS: '/barber/earnings',
  BARBER_PROFILE: '/barber/profile',
  BARBER_MESSAGES: '/barber/messages',
} as const;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  CAMPUS: 'campus',
} as const;

export const USER_ROLES = {
  STUDENT: 'student',
  BARBER: 'barber',
  ADMIN: 'admin',
} as const;

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  SYSTEM: 'system',
} as const;

