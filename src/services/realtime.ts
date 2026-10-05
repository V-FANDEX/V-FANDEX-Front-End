import { getAuthToken, WS_URL } from './apiClient';
export interface Envelope {
  id?: string;
  type: string;
  realtimeAvailable?: boolean;
  stockId?: string;
  sequence?: string;
}
export function createRealtime(
  onInvalidate: () => void,
  onStatus: (status: string) => void,
  stockId?: string,
) {
  let socket: WebSocket | undefined,
    stopped = false,
    attempt = 0,
    timer: ReturnType<typeof setTimeout> | undefined,
    debounce: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  // Notifications only invalidate REST snapshots. Never overwrite order state with a delayed event.
  const invalidate = () => {
    if (!debounce)
      debounce = setTimeout(() => {
        debounce = undefined;
        onInvalidate();
      }, 200);
  };
  const connect = () => {
    if (!WS_URL || stopped) {
      onStatus('OFFLINE');
      return;
    }
    onStatus(attempt ? 'RECONNECTING' : 'CONNECTING');
    socket = new WebSocket(WS_URL);
    socket.onopen = () => {
      if (stopped) return;
      attempt = 0;
      const token = getAuthToken();
      if (token) socket?.send(JSON.stringify({ type: 'authenticate', token }));
      if (stockId) socket?.send(JSON.stringify({ type: 'subscribe', stockId }));
      invalidate();
    };
    socket.onmessage = (event) => {
      let message: Envelope;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'connected') {
        onStatus(message.realtimeAvailable === false ? 'POLLING' : 'LIVE');
        invalidate();
        return;
      }
      if (message.type === 'auth:expired') {
        onStatus('AUTH_EXPIRED');
        invalidate();
        return;
      }
      if (message.id) {
        if (seen.has(message.id)) return;
        seen.add(message.id);
        if (seen.size > 5000) seen.delete(seen.values().next().value!);
      }
      if (
        [
          'resync:required',
          'price:update',
          'trade:new',
          'order:update',
          'orderbook:update',
          'portfolio:update',
          'market:index',
          'news:new',
        ].includes(message.type) ||
        message.realtimeAvailable === false
      )
        invalidate();
    };
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      if (stopped) return;
      onStatus('RECONNECTING');
      invalidate();
      timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++) + Math.random() * 500);
    };
  };
  connect();
  const poll = setInterval(invalidate, 15000);
  return () => {
    stopped = true;
    clearInterval(poll);
    clearTimeout(timer);
    clearTimeout(debounce);
    socket?.close();
  };
}
