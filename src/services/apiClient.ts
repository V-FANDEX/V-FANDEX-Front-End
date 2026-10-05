const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const API_BASE_URL =
  viteEnv?.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export const WS_URL = viteEnv?.VITE_WS_URL?.replace(/\/$/, '') || (API_BASE_URL ? API_BASE_URL.replace(/^http/, 'ws') + '/ws' : undefined);

export const AUTH_TOKEN_KEY = 'v-fandex-access-token';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  path?: string;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('VITE_API_BASE_URL을 설정하세요. 실제 서버에 연결되지 않았습니다.', 0, undefined);
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = getErrorMessage(payload, response.statusText || '요청 처리에 실패했습니다.');
    // Only the identity endpoint establishes an expired login. Provider 401 must retain its context.
    if (response.status === 401 && path === '/auth/me') {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('vfandex:unauthorized', { detail: { message } }));
    }
    const error = new ApiError(message, response.status, payload);
    error.path = path;
    throw error;
  }

  return payload as T;
}

export function jsonBody(body: unknown) {
  return JSON.stringify(body);
}

export function withQuery(path: string, params: Record<string, string | number | boolean | undefined | null>) {
  const [pathname, existing] = path.split('?');
  const searchParams = new URLSearchParams(existing);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getErrorMessage(payload: unknown, fallback = '요청 처리에 실패했습니다.') {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string' && message.trim()) return message;
  }

  return fallback;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
