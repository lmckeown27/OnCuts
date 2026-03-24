// API Configuration - Uses environment variables from .env
// Production uses relative URL (proxied through Nginx); for local dev, set VITE_API_URL=http://localhost:3001/api/v1
export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Origin for non-versioned routes (e.g. /api/zklogin). */
export function getBackendOrigin(): string {
  if (import.meta.env.VITE_API_ORIGIN) {
    return import.meta.env.VITE_API_ORIGIN.replace(/\/$/, '');
  }
  const base = API_BASE_URL;
  if (base.startsWith('http')) {
    try {
      const url = new URL(base);
      return url.origin;
    } catch {
      return '';
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}
export const WS_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.host}`;
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';

// Sui (Path B)
export const SUI_RPC_URL =
  import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';
export const SUI_PROVER_URL = import.meta.env.VITE_SUI_PROVER_URL || '';

// App Metadata
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'CampusCut';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  CAMPUS_SELECT: '/campus-select',
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

