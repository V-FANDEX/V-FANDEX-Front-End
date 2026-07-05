import type { Role, UserAccount } from '../types';
import { currentUser } from './mockData';

export interface LoginPayload {
  email: string;
  password: string;
  role: Exclude<Role, 'ai'>;
  remember: boolean;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

const latency = 220;

const wait = <T,>(data: T): Promise<T> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(data), latency);
  });

export const authApi = {
  login: ({ email, role }: LoginPayload) => {
    if (role === 'admin') return wait({ ...currentUser, role: 'admin' as const });

    return wait(createUserAccount(email.split('@')[0] || '팬덱스 유저', 'user'));
  },
  signup: ({ name }: SignupPayload) => wait(createUserAccount(name, 'user')),
  logout: () => wait(true),
};

function createUserAccount(name: string, role: Exclude<Role, 'ai'>): UserAccount {
  return {
    id: `user-${Date.now()}`,
    name: name.trim() || '팬덱스 유저',
    role,
    cash: 10_000_000,
    totalDividend: 0,
    favoriteStockIds: [],
    holdings: [],
  };
}
