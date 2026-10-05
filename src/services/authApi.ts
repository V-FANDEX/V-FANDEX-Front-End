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
    return authApi.me();
  },

  async signup({ nickname, name, email, password }: SignupPayload): Promise<UserAccount> {
    const response = await apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: jsonBody({ nickname: nickname ?? name, email, password }),
    });
    setAuthToken(response.accessToken);
    return authApi.me();
  },

  async me(): Promise<UserAccount> { return mapUser(await apiClient<unknown>('/auth/me')); },

  async logout() {
    clearAuthToken();
    return true;
  },
};
