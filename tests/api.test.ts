import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, AUTH_TOKEN_KEY } from '../src/services/apiClient';
import { clearOperations, newOperation, operationRequest } from '../src/hooks/useRemote';
describe('HTTP and idempotency boundary', () => {
  beforeEach(() => clearOperations());
  it('keeps provider 401 context without discarding login', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'access');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: ['provider key invalid'] }), { status: 401 }),
        ),
    );
    await expect(apiClient('/admin/storylines/generate', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      path: '/admin/storylines/generate',
      message: 'provider key invalid',
    });
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('access');
  });
  it('expires identity on auth/me 401', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'access');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(apiClient('/auth/me')).rejects.toThrow();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });
  it('uses same key/body after response loss, new keys only explicitly', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockImplementation(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const body = { stockId: 's', side: 'BUY', type: 'MARKET', quantity: 3 };
    await expect(operationRequest('user:order', '/orders', body)).rejects.toThrow();
    await operationRequest('user:order', '/orders', body);
    const a = fetch.mock.calls[0][1],
      b = fetch.mock.calls[1][1];
    expect(a.headers.get('Idempotency-Key')).toBe(b.headers.get('Idempotency-Key'));
    expect(a.body).toBe(b.body);
    await expect(operationRequest('user:order', '/orders', { ...body, quantity: 4 })).rejects.toThrow();
    newOperation('user:order');
    await operationRequest('user:order', '/orders', body);
    expect(fetch.mock.calls[2][1].headers.get('Idempotency-Key')).not.toBe(a.headers.get('Idempotency-Key'));
  });
  it('adds Bearer token and no /api prefix', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'access');
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await apiClient('/admin/ai-accounts');
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://contract.test/admin/ai-accounts');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer access');
  });
});

describe('tab reload recovery', () => {
  it('persists fingerprint/key without private input or response', async () => {
    clearOperations();
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await operationRequest('admin:generate', '/admin/storylines/generate', {
      stockId: 's',
      prompt: 'PRIVATE_STORY_PROMPT',
    });
    const stored = sessionStorage.getItem('vfandex:operation:admin:generate')!;
    expect(stored).not.toContain('PRIVATE_STORY_PROMPT');
    expect(JSON.parse(stored).fingerprint).toHaveLength(64);
    const key = JSON.parse(stored).key;
    vi.resetModules();
    const fresh = await import('../src/hooks/useRemote');
    await fresh.operationRequest('admin:generate', '/admin/storylines/generate', {
      stockId: 's',
      prompt: 'PRIVATE_STORY_PROMPT',
    });
    expect((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toBeDefined();
    expect(
      new Headers((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].headers).get(
        'Idempotency-Key',
      ),
    ).toBe(key);
    fresh.clearOperations();
  });
});
