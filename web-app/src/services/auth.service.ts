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

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    this.saveAuthData(response);
    return response;
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    this.saveAuthData(response);
    return response;
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    await api.post('/auth/verify-email', { email, code });
  }

  async getCurrentUser(): Promise<User> {
    return await api.get<User>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      this.clearAuthData();
    }
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
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
}

export default new AuthService();

