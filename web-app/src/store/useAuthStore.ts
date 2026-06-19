import { create } from 'zustand';
import type { User } from '../types';
import authService from '../services/auth.service';
import type { VerifyPhoneOtpData } from '../services/auth.service';
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
  loginWithPhone: (
    phoneNumber: string,
    code: string
  ) => Promise<
    | { kind: 'signed_in'; isAdmin: boolean }
    | { kind: 'no_account'; phoneNumber: string; message?: string }
  >;
  signup: (data: any) => Promise<{ email: string; verificationCode?: string }>;
  confirmVerificationCode: (email: string, code: string) => Promise<void>;
  completeRegistration: (email: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
  getPendingVerificationEmail: () => string | null;
}

// Hardcoded admin credentials (empty - all auth goes through real API)
const ADMIN_CREDENTIALS: Array<{ email: string; password: string; user: User }> = [];

function mapBackendUser(responseUser: Record<string, unknown>): User {
  const rawRole = ((responseUser.role || responseUser.user_type || '') as string).toString().toLowerCase();
  const mappedRole = rawRole === 'consumer' ? 'student' : rawRole === 'campus_manager' ? 'barber' : rawRole;
  const isAdmin = mappedRole === 'admin';

  return {
    id: (responseUser.id || responseUser.userId) as string,
    email: responseUser.email as string,
    first_name: (responseUser.firstName || responseUser.first_name) as string,
    last_name: (responseUser.lastName || responseUser.last_name) as string,
    user_type: mappedRole as 'student' | 'barber' | 'admin',
    is_verified: (responseUser.emailVerified ?? responseUser.is_verified ?? true) as boolean,
    is_admin: isAdmin,
    has_barber_profile: (responseUser.hasBarberProfile ?? false) as boolean,
    created_at: (responseUser.created_at as string) || new Date().toISOString(),
    campus_id: (responseUser.campusId || responseUser.campus_id)?.toString(),
    profile_picture_url: (responseUser.profile_picture_url || responseUser.avatarUrl) as string | undefined,
    phone_number: (responseUser.phoneNumber ?? responseUser.phone_number ?? null) as string | null,
    sui_address: (responseUser.suiAddress ?? responseUser.sui_address ?? null) as string | null,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: authService.getStoredUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  pendingVerificationEmail: authService.getPendingVerificationEmail(),
  activeRole: null,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user, isAuthenticated: !!user });
  },
  
  setActiveRole: (role) => set({ activeRole: role }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    
    const adminMatch = ADMIN_CREDENTIALS.find(
      admin => admin.email === email && admin.password === password
    );
    
    if (adminMatch) {
      const adminUser = adminMatch.user;
      localStorage.setItem('user', JSON.stringify(adminUser));
      localStorage.setItem('accessToken', 'admin-token-' + Date.now());
      
      set({ 
        user: adminUser, 
        isAuthenticated: true, 
        isLoading: false,
        activeRole: null
      });
      socketService.connect();
      return { isAdmin: true };
    }
    
    try {
      const response = await authService.login({ email, password });
      const user = mapBackendUser(response.user as unknown as Record<string, unknown>);
      
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false,
        activeRole: null
      });
      socketService.connect();
      return { isAdmin: user.is_admin || false };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Invalid credentials';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  },

  loginWithPhone: async (phoneNumber, code) => {
    set({ isLoading: true, error: null });
    try {
      const data: VerifyPhoneOtpData = await authService.verifyPhoneOtp(phoneNumber, code);

      if (!data.accountExists || !data.user) {
        set({ isLoading: false });
        return {
          kind: 'no_account' as const,
          phoneNumber: data.phoneNumber ?? phoneNumber,
          message:
            'No account for this number yet. Use Sign Up with the same phone and your email, or try another number.',
        };
      }

      const user = mapBackendUser(data.user as unknown as Record<string, unknown>);
      localStorage.setItem('user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        activeRole: null,
      });
      socketService.connect();
      return {
        kind: 'signed_in' as const,
        isAdmin: user.is_admin || false,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Could not verify code';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  signup: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.signup(data);
      localStorage.setItem('pendingVerificationEmail', data.email);
      set({ 
        isLoading: false, 
        pendingVerificationEmail: data.email 
      });
      return { email: response.email, verificationCode: response.verificationCode };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Signup failed';
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  },

  confirmVerificationCode: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      await authService.confirmVerificationCode(email, code);
      set({ isLoading: false });
    } catch (error: any) {
      let errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Verification failed';
      if (
        error.response?.status === 400 ||
        errorMessage.toLowerCase().includes('invalid') ||
        errorMessage.toLowerCase().includes('expired')
      ) {
        errorMessage = 'Wrong verification code. Please check and try again.';
      }
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  completeRegistration: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.completeRegistration(email);
      const user = mapBackendUser(response.user as unknown as Record<string, unknown>);
      localStorage.removeItem('pendingVerificationEmail');

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        pendingVerificationEmail: null,
      });
      socketService.connect();
    } catch (error: any) {
      let errorMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Could not create your account';

      set({
        error: errorMessage,
        isLoading: false,
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
      const errorMessage = error.response?.data?.message || error.message || 'Failed to resend code';
      set({ 
        error: errorMessage, 
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
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
      socketService.connect();
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
