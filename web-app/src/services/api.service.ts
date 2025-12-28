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
        if (token && config.headers) {
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
        
        // Don't redirect for auth endpoints (login, register, etc.) - let the UI handle those errors
        const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                               requestUrl.includes('/auth/register') ||
                               requestUrl.includes('/auth/verify');
        
        if (error.response?.status === 401 && !isAuthEndpoint) {
          // Token expired, try to refresh
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
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
              // Refresh failed, logout user
              localStorage.clear();
              window.location.href = '/';
            }
          } else {
            // No refresh token, logout
            localStorage.clear();
            window.location.href = '/';
          }
        }
        return Promise.reject(error);
      }
    );
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

  async delete<T = any>(url: string): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url);
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

