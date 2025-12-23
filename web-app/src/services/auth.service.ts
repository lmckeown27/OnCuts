import api from './api.service';
import type { User } from '../types';
import { STORAGE_KEYS } from '../config/constants';

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  user_type: 'student' | 'barber';
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface RegistrationPendingResponse {
  email: string;
  expiresIn: number;
  verificationCode?: string; // Only in dev/auto-verify mode
}

interface VerifyEmailResponse {
  user: User;
  token: string;
  aptosAddress?: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    this.saveAuthData(response);
    return response;
  }

  /**
   * Register a new user - sends verification email
   * Does NOT authenticate the user - they must verify email first
   */
  async signup(data: SignupData): Promise<RegistrationPendingResponse> {
    const response = await api.post<{ data: RegistrationPendingResponse }>('/auth/register', {
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      role: data.user_type,
    });
    
    // Store email for verification page
    localStorage.setItem('pendingVerificationEmail', data.email);
    
    return response.data;
  }

  /**
   * Verify email with 6-digit code - creates the user account
   */
  async verifyEmail(email: string, code: string): Promise<VerifyEmailResponse> {
    const response = await api.post<{ data: VerifyEmailResponse }>('/auth/verify-email', { email, code });
    
    // Save auth data after successful verification
    if (response.data.user && response.data.token) {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }
    
    // Clear pending verification email
    localStorage.removeItem('pendingVerificationEmail');
    
    return response.data;
  }

  /**
   * Resend verification code to email
   */
  async resendVerificationCode(email: string): Promise<RegistrationPendingResponse> {
    const response = await api.post<{ data: RegistrationPendingResponse }>('/auth/resend-verification', { email });
    return response.data;
  }

  /**
   * Get pending verification email from storage
   */
  getPendingVerificationEmail(): string | null {
    return localStorage.getItem('pendingVerificationEmail');
  }

  async getCurrentUser(): Promise<User> {
    return await api.get<User>('/auth/me');
  }

  async logout(): Promise<void> {
    // For JWT-based auth, we just clear local storage
    // No server-side session to invalidate
    this.clearAuthData();
  }

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post<{ accessToken: string }>('/auth/refresh-token', {
      refreshToken,
    });
    
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    return response.accessToken;
  }

  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/request-password-reset', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  }

  private saveAuthData(data: AuthResponse): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
  }

  private clearAuthData(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  getStoredUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : undefined;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
}

export default new AuthService();

