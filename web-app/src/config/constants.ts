export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  CAMPUS_SELECT: '/campus-select',
  
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

