import { create } from 'zustand';
import { fandexApi } from '../services/fandexApi';
import type { ConditionalOrder, Market, RankingEntry, ScenarioLog, SeasonInfo, Stock, Transaction, UserAccount } from '../types';

interface FandexState {
  markets: Market[];
  stocks: Stock[];
  user?: UserAccount;
  season?: SeasonInfo;
  rankings: RankingEntry[];
  scenarios: ScenarioLog[];
  conditionalOrders: ConditionalOrder[];
  transactions: Transaction[];
  toast?: string;
  isReady: boolean;
  load: () => Promise<void>;
  toggleFavorite: (stockId: string) => void;
  placeOrder: (stockId: string, type: 'buy' | 'sell', quantity: number) => void;
  claimDividend: (stockId: string) => void;
  cancelConditionalOrder: (orderId: string) => void;
  notify: (message: string) => void;
  clearToast: () => void;
}

export const useFandexStore = create<FandexState>((set, get) => ({
  markets: [],
  stocks: [],
  rankings: [],
  scenarios: [],
  conditionalOrders: [],
  transactions: [],
  isReady: false,
  load: async () => {
    const [marketsData, stocksData, userData, seasonData, rankingData, scenarioData, orderData, txData] = await Promise.all([
      fandexApi.getMarkets(),
      fandexApi.getStocks(),
      fandexApi.getCurrentUser(),
      fandexApi.getSeason(),
      fandexApi.getRankings(),
      fandexApi.getScenarios(),
      fandexApi.getConditionalOrders(),
      fandexApi.getTransactions(),
    ]);

    set({
      markets: marketsData,
      stocks: stocksData,
      user: userData,
      season: seasonData,
      rankings: rankingData,
      scenarios: scenarioData,
      conditionalOrders: orderData,
      transactions: txData,
      isReady: true,
    });
  },
  toggleFavorite: (stockId) => {
    const user = get().user;
    if (!user) return;
    const exists = user.favoriteStockIds.includes(stockId);
    set({
      user: {
        ...user,
        favoriteStockIds: exists
          ? user.favoriteStockIds.filter((id) => id !== stockId)
          : [...user.favoriteStockIds, stockId],
      },
      toast: exists ? '즐겨찾기에서 제거했습니다.' : '즐겨찾기에 추가했습니다.',
    });
  },
  placeOrder: (stockId, type, quantity) => {
    const user = get().user;
    const stock = get().stocks.find((item) => item.id === stockId);
    if (!user || !stock || quantity <= 0) return;

    const total = stock.price * quantity;
    const holding = user.holdings.find((item) => item.stockId === stockId);

    if (type === 'buy' && user.cash < total) {
      set({ toast: '잔액이 부족합니다.' });
      return;
    }

    if (type === 'sell' && (!holding || holding.quantity < quantity)) {
      set({ toast: '보유 수량이 부족합니다.' });
      return;
    }

    const nextHoldings =
      type === 'buy'
        ? upsertHolding(user.holdings, stockId, quantity, stock.price)
        : user.holdings
            .map((item) => (item.stockId === stockId ? { ...item, quantity: item.quantity - quantity } : item))
            .filter((item) => item.quantity > 0);

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      stockId,
      type,
      quantity,
      price: stock.price,
      total,
      createdAt: new Date().toISOString(),
    };

    set({
      user: {
        ...user,
        cash: type === 'buy' ? user.cash - total : user.cash + total,
        holdings: nextHoldings,
      },
      transactions: [tx, ...get().transactions],
      toast: type === 'buy' ? '매수 주문이 체결되었습니다.' : '매도 주문이 체결되었습니다.',
    });
  },
  claimDividend: (stockId) => {
    const user = get().user;
    const stock = get().stocks.find((item) => item.id === stockId);
    const holding = user?.holdings.find((item) => item.stockId === stockId);
    if (!user || !stock || !holding || !stock.dividendEnabled) {
      set({ toast: '수령 가능한 배당금이 없습니다.' });
      return;
    }
    const amount = Math.round(holding.quantity * stock.price * (stock.dividendRate / 100) * 0.1);
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      stockId,
      type: 'dividend',
      quantity: holding.quantity,
      price: amount / holding.quantity,
      total: amount,
      createdAt: new Date().toISOString(),
    };
    set({
      user: { ...user, cash: user.cash + amount, totalDividend: user.totalDividend + amount },
      transactions: [tx, ...get().transactions],
      toast: '배당금을 수령했습니다.',
    });
  },
  cancelConditionalOrder: (orderId) => {
    set({
      conditionalOrders: get().conditionalOrders.map((order) =>
        order.id === orderId ? { ...order, active: false } : order,
      ),
      toast: '조건 주문을 취소했습니다.',
    });
  },
  notify: (message) => set({ toast: message }),
  clearToast: () => set({ toast: undefined }),
}));

function upsertHolding(holdings: UserAccount['holdings'], stockId: string, quantity: number, price: number) {
  const existing = holdings.find((item) => item.stockId === stockId);
  if (!existing) return [...holdings, { stockId, quantity, averagePrice: price }];

  return holdings.map((item) => {
    if (item.stockId !== stockId) return item;
    const totalQuantity = item.quantity + quantity;
    const averagePrice = (item.averagePrice * item.quantity + price * quantity) / totalQuantity;
    return { ...item, quantity: totalQuantity, averagePrice };
  });
}
