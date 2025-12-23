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
// NOTE: lmckeown@calpoly.edu temporarily removed for email verification testing
const ADMIN_CREDENTIALS = [
  {
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
  },
  {
    email: 'schroete@calpoly.edu',
    password: 'barberdrama@13',
    user: {
      id: 'admin-justin-schroeter',
      email: 'schroete@calpoly.edu',
      first_name: 'Justin',
      last_name: 'Schroeter',
      user_type: 'admin' as const,
      is_verified: true,
      is_admin: true,
      created_at: new Date().toISOString()
    }
  }
];

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
    const adminMatch = ADMIN_CREDENTIALS.find(
      admin => admin.email === email && admin.password === password
    );
    
    if (adminMatch) {
      const adminUser = adminMatch.user;
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
    
    // For now, only admin accounts are supported (backend auth not yet configured)
    // Show user-friendly error for non-admin login attempts
    set({ 
      error: 'Username and/or password not found', 
      isLoading: false 
    });
    throw new Error('Invalid credentials');
  },

  signup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Re-enable backend call when auth routes are configured
      // const response = await authService.signup(data);
      
      // MOCK: Simulate successful registration for testing email verification UI
      // In production, this would call the backend API
      console.log('📧 [MOCK] Registration for:', data.email);
      console.log('📧 [MOCK] Verification code would be sent to email');
      
      // Store pending verification email
      localStorage.setItem('pendingVerificationEmail', data.email);
      
      // Don't authenticate yet - user must verify email first
      set({ 
        isLoading: false, 
        pendingVerificationEmail: data.email 
      });
      
      // Mock response - in production this comes from backend
      return { email: data.email, verificationCode: '123456' }; // Mock code for testing
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
      // TODO: Re-enable backend call when auth routes are configured
      // const response = await authService.verifyEmail(email, code);
      
      // MOCK: Simulate verification for testing
      console.log('✅ [MOCK] Verifying email:', email, 'with code:', code);
      
      // Accept any 6-digit code for testing, or specifically "123456"
      if (code.length !== 6) {
        throw new Error('Invalid verification code');
      }
      
      // Mock user response
      const mockUser = {
        id: 'mock-user-' + Date.now(),
        email: email,
        first_name: 'Test',
        last_name: 'User',
        user_type: 'student' as const,
        is_verified: true,
        is_admin: false,
        created_at: new Date().toISOString()
      };
      
      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('accessToken', 'mock-token-' + Date.now());
      localStorage.removeItem('pendingVerificationEmail');
      
      set({ 
        user: mockUser, 
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
      // TODO: Re-enable backend call when auth routes are configured
      // await authService.resendVerificationCode(email);
      
      // MOCK: Simulate resend for testing
      console.log('📧 [MOCK] Resending verification code to:', email);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
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

