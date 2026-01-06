import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';
import type { ApiResponse } from '../types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        // Only add token if it exists and is not the literal string "null" or "undefined"
        if (token && token !== 'null' && token !== 'undefined' && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const requestUrl = error.config?.url || '';
        
        // Handle rate limit errors with a user-friendly message
        if (error.response?.status === 429) {
          const rateLimitError = new Error('Rate limit reached. Please wait a moment and reload the page.');
          (rateLimitError as any).response = error.response;
          (rateLimitError as any).isRateLimitError = true;
          return Promise.reject(rateLimitError);
        }
        
        // Don't redirect for auth endpoints (login, register, etc.) - let the UI handle those errors
        const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                               requestUrl.includes('/auth/register') ||
                               requestUrl.includes('/auth/verify');
        
        if (error.response?.status === 401 && !isAuthEndpoint) {
          // Token expired, try to refresh
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
          
          if (refreshToken) {
            try {
              const response = await this.post<{ accessToken: string }>('/auth/refresh-token', {
                refreshToken,
              });
              
              if (response.accessToken) {
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
                // Retry the original request
                if (error.config) {
                  return this.client.request(error.config);
                }
              }
            } catch (refreshError) {
              // Refresh failed, logout user - only clear auth items, preserve app state
              this.clearAuthStorage();
              window.location.href = '/';
            }
          } else if (accessToken) {
            // Had access token but no refresh token - session is invalid, logout
            this.clearAuthStorage();
            window.location.href = '/';
          }
          // If no access token and no refresh token, user was never logged in
          // Don't redirect - let the calling code handle the 401 gracefully
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Clear only auth-related localStorage items
   * Preserves app state like selected university, filters, etc.
   */
  private clearAuthStorage(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('postLoginRedirect');
  }

  async get<T = any>(url: string, params?: any): Promise<T> {
    const response = await this.client.get(url, { params });
    
    // If response has both 'data' and 'pagination', return the whole response
    // Otherwise, extract just the data field
    if (response.data.pagination) {
      return response.data as T;
    }
    
    return response.data.data !== undefined ? response.data.data as T : response.data as T;
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data.data as T;
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data.data as T;
  }

  async delete<T = any>(url: string, data?: any): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, { data });
    return response.data.data as T;
  }

  async upload<T = any>(url: string, formData: FormData): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as T;
  }
}

export default new ApiService();

