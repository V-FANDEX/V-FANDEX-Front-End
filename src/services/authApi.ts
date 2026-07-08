import type { Role, UserAccount } from '../types';
import { apiClient, clearAuthToken, jsonBody, setAuthToken } from './apiClient';
import { mapUser } from './mappers';

export interface LoginPayload {
  email: string;
  password: string;
  role?: Exclude<Role, 'ai'>;
  remember?: boolean;
}

export interface SignupPayload {
  nickname?: string;
  name?: string;
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  user: unknown;
}

export const authApi = {
  async login({ email, password }: LoginPayload): Promise<UserAccount> {
    const response = await apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: jsonBody({ email, password }),
    });
    setAuthToken(response.accessToken);
    return authApi.me(response.user);
  },

  async signup({ nickname, name, email, password }: SignupPayload): Promise<UserAccount> {
    const response = await apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: jsonBody({ nickname: nickname ?? name, email, password }),
    });
    setAuthToken(response.accessToken);
    return authApi.me(response.user);
  },

  async me(fallback?: unknown): Promise<UserAccount> {
    try {
      const user = await apiClient<unknown>('/auth/me');
      return mapUser(user);
    } catch (error) {
      if (fallback) return mapUser(fallback);
      throw error;
    }
  },

  async logout() {
    clearAuthToken();
    return true;
  },
};
