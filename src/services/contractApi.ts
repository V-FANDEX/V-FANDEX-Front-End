import { apiClient, jsonBody } from './apiClient';
export function read<T>(path: string, signal?: AbortSignal) {
  return apiClient<T>(path, { signal, cache: 'no-store' });
}
export function write<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, key?: string) {
  return apiClient<T>(path, {
    method,
    ...(body === undefined ? {} : { body: jsonBody(body) }),
    ...(key ? { headers: { 'Idempotency-Key': key } } : {}),
  });
}
export const segment = (id: string) => encodeURIComponent(id);
