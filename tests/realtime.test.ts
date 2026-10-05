import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtime } from '../src/services/realtime';
import { AUTH_TOKEN_KEY } from '../src/services/apiClient';
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.onclose?.();
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => vi.useRealTimers());
describe('native WS invalidation and recovery', () => {
  it('authenticates through messages, subscribes first, coalesces and deduplicates', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'test-token');
    const refresh = vi.fn(),
      status = vi.fn();
    const stop = createRealtime(refresh, status, 'stock');
    const socket = FakeSocket.instances[0];
    expect(socket.url).not.toContain('test-token');
    socket.onopen?.();
    expect(socket.sent.map((x) => JSON.parse(x))).toEqual([
      { type: 'authenticate', token: 'test-token' },
      { type: 'subscribe', stockId: 'stock' },
    ]);
    socket.message({ type: 'connected', realtimeAvailable: true });
    socket.message({ id: 'one', type: 'trade:new' });
    socket.message({ id: 'two', type: 'orderbook:update' });
    vi.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    socket.message({ id: 'one', type: 'trade:new' });
    vi.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });
  it('refetches on reconnect, resync and realtime unavailable without applying stale order payload', () => {
    const refresh = vi.fn(),
      status = vi.fn();
    const stop = createRealtime(refresh, status, 'stock');
    const socket = FakeSocket.instances[0];
    socket.onopen?.();
    vi.advanceTimersByTime(200);
    socket.message({ type: 'resync:required' });
    socket.message({ type: 'connected', realtimeAvailable: false });
    socket.message({
      id: 'old',
      type: 'order:update',
      payload: { updatedAt: '2000-01-01T00:00Z', filledQuantity: 0 },
    });
    vi.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith('POLLING');
    socket.close();
    vi.advanceTimersByTime(1600);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onopen?.();
    vi.advanceTimersByTime(200);
    expect(refresh).toHaveBeenCalledTimes(4);
    stop();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
