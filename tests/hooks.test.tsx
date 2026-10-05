import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePage, useRemote } from '../src/hooks/useRemote';
describe('read isolation and cursor pages', () => {
  it('resets cursor on filter/account change and removes duplicate IDs', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        const parsed = new URL(url);
        return new Response(
          JSON.stringify(
            parsed.searchParams.get('stockId') === 'b'
              ? { items: [{ id: 'b' }], nextCursor: null }
              : parsed.searchParams.has('cursor')
                ? { items: [{ id: 'a' }, { id: 'c' }], nextCursor: null }
                : { items: [{ id: 'a' }], nextCursor: 'opaque+/==' },
          ),
        );
      }),
    );
    const { result, rerender } = renderHook(
      ({ stock }) => usePage<{ id: string }>(`/page?stockId=${stock}`),
      { initialProps: { stock: 'a' } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.more());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
    rerender({ stock: 'b' });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'b' }]));
    expect(new URL(urls.at(-1)!).searchParams.has('cursor')).toBe(false);
  });
  it('ignores late response from previous account', async () => {
    let resolveA: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/a')
          ? new Promise<Response>((r) => {
              resolveA = r;
            })
          : Promise.resolve(new Response(JSON.stringify({ account: 'b' }))),
      ),
    );
    const { result, rerender } = renderHook(({ id }) => useRemote<{ account: string }>(`/${id}`), {
      initialProps: { id: 'a' },
    });
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data?.account).toBe('b'));
    await act(async () => resolveA(new Response(JSON.stringify({ account: 'a' }))));
    expect(result.current.data?.account).toBe('b');
  });
});

describe('order before cursor contract', () => {
  it('keeps the server boundary as an unchanged before string', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify({ items: [{ id: 'order' }], nextCursor: '9007199254740993' }));
      }),
    );
    const { result } = renderHook(() => usePage<{ id: string }>('/orders/me/page?limit=50', 'before'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.more());
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(new URL(urls[1]).searchParams.get('before')).toBe('9007199254740993');
    expect(new URL(urls[1]).searchParams.has('cursor')).toBe(false);
  });
});
