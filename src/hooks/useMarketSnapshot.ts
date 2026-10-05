import { useEffect, useState } from 'react';
import { read, segment } from '../services/contractApi';
import { getAuthToken } from '../services/apiClient';
import { useFandexStore } from '../store/useFandexStore';
import type { EngineOrder, Row } from '../types/contracts';
export interface MarketSnapshot {
  quote: Row;
  orderbook: { bids: Row[]; asks: Row[] };
  candles: Row[];
  trades: Row[];
  orders: EngineOrder[];
  portfolio?: Row;
}
export function useMarketSnapshot(stockId?: string, interval = '1h') {
  const userId = useFandexStore((s) => s.user?.id);
  const [state, setState] = useState<{ scope: string; data?: MarketSnapshot; error?: unknown }>({
      scope: '',
    }),
    [status, setStatus] = useState('OFFLINE');
  const scope = `${userId}:${stockId}:${interval}`;
  useEffect(() => {
    if (!stockId) return;
    const controller = new AbortController();
    let loading = false,
      dirty = false;
    const refresh = async () => {
      if (loading) {
        dirty = true;
        return;
      }
      loading = true;
      try {
        do {
          dirty = false;
          const base = `/stocks/${segment(stockId)}`;
          const [quote, orderbook, candles, trades, orders, portfolio] = await Promise.all([
            read<Row>(base + '/quote', controller.signal),
            read<MarketSnapshot['orderbook']>(base + '/orderbook', controller.signal),
            read<Row[]>(base + '/candles?interval=' + interval, controller.signal),
            read<Row[]>(base + '/trades', controller.signal),
            getAuthToken() ? read<EngineOrder[]>('/orders/me', controller.signal) : Promise.resolve([]),
            getAuthToken() ? read<Row>('/portfolio/me', controller.signal) : Promise.resolve(undefined),
          ]);
          if (!controller.signal.aborted)
            setState({ scope, data: { quote, orderbook, candles, trades, orders, portfolio } });
        } while (dirty && !controller.signal.aborted);
      } catch (error) {
        if (!controller.signal.aborted) setState({ scope, error });
      } finally {
        loading = false;
      }
    };
    const onStatus = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    window.addEventListener('vfandex:realtime-status', onStatus);
    const invalidate = () => {
      void refresh();
    };
    window.addEventListener('vfandex:invalidate', invalidate);
    void refresh();
    return () => {
      controller.abort();
      window.removeEventListener('vfandex:realtime-status', onStatus);
      window.removeEventListener('vfandex:invalidate', invalidate);
    };
  }, [stockId, interval, userId, scope]);
  return { ...(state.scope === scope ? state : {}), status };
}
