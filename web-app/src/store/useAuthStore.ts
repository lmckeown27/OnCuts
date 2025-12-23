import { create } from 'zustand';
import type { User } from '../types';
import authService from '../services/auth.service';
import socketService from '../services/socket.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;
  activeRole: 'admin' | 'barber' | 'consumer' | null;
  
  setUser: (user: User | null) => void;
  setActiveRole: (role: 'admin' | 'barber' | 'consumer') => void;
  login: (email: string, password: string) => Promise<{ isAdmin: boolean }>;
  signup: (data: any) => Promise<{ email: string; verificationCode?: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  getPendingVerificationEmail: () => string | null;
}

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
  email: 'lmckeown@calpoly.edu',
  password: 'Cr8zzy4R0GG$',
  user: {
    id: 'admin-liam-mckeown',
    email: 'lmckeown@calpoly.edu',
    first_name: 'Liam',
    last_name: 'McKeown',
    user_type: 'admin' as const,
    is_verified: true,
    is_admin: true,
    created_at: new Date().toISOString()
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  pendingVerificationEmail: authService.getPendingVerificationEmail(),
  activeRole: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setActiveRole: (role) => set({ activeRole: role }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    
    // Check for hardcoded admin credentials
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const adminUser = ADMIN_CREDENTIALS.user;
      // Store admin user in localStorage (using same keys as auth.service)
      localStorage.setItem('user', JSON.stringify(adminUser));
      localStorage.setItem('accessToken', 'admin-token-' + Date.now());
      
      set({ 
        user: adminUser, 
        isAuthenticated: true, 
        isLoading: false,
        activeRole: null // Will be selected on role page
      });
      socketService.connect();
      return { isAdmin: true };
    }
    
    try {
      const response = await authService.login({ email, password });
      set({ user: response.user, isAuthenticated: true, isLoading: false });
      socketService.connect();
      return { isAdmin: response.user.is_admin || false };
    } catch (error: any) {
      // Provide user-friendly error message for all login failures
      const errorMessage = 'Username and/or password not found';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  },

  signup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.signup(data);
      // Don't authenticate yet - user must verify email first
      set({ 
        isLoading: false, 
        pendingVerificationEmail: data.email 
      });
      return { email: response.email, verificationCode: response.verificationCode };
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Signup failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  verifyEmail: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.verifyEmail(email, code);
      set({ 
        user: response.user, 
        isAuthenticated: true, 
        isLoading: false,
        pendingVerificationEmail: null 
      });
      socketService.connect();
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || error.message || 'Verification failed', 
        isLoading: false 
      });
      throw error;
    }
  },

  resendVerificationCode: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await authService.resendVerificationCode(email);
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || 'Failed to resend code', 
        isLoading: false 
      });
      throw error;
    }
  },

  getPendingVerificationEmail: () => {
    return get().pendingVerificationEmail || authService.getPendingVerificationEmail();
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      socketService.disconnect();
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      // Even if logout fails on server, clear local state
      socketService.disconnect();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  loadUser: async () => {
    if (!authService.isAuthenticated()) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await authService.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
      socketService.connect();
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

