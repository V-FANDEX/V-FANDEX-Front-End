import { create } from 'zustand';
import { authApi, type LoginPayload, type SignupPayload } from '../services/authApi';
import { fandexApi } from '../services/fandexApi';
import type { ConditionalOrder, DividendSchedule, Market, RankingEntry, ScenarioLog, SeasonInfo, Stock, Transaction, UserAccount } from '../types';

interface FandexState {
  markets: Market[];
  stocks: Stock[];
  user?: UserAccount;
  season?: SeasonInfo;
  rankings: RankingEntry[];
  scenarios: ScenarioLog[];
  conditionalOrders: ConditionalOrder[];
  transactions: Transaction[];
  dividendSchedule?: DividendSchedule;
  toast?: string;
  isReady: boolean;
  load: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (stockId: string) => void;
  placeOrder: (stockId: string, type: 'buy' | 'sell', quantity: number) => void;
  updateDividendSchedule: (patch: Partial<DividendSchedule>) => void;
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
    const [marketsData, stocksData, userData, seasonData, rankingData, scenarioData, orderData, txData, scheduleData] = await Promise.all([
      fandexApi.getMarkets(),
      fandexApi.getStocks(),
      fandexApi.getCurrentUser(),
      fandexApi.getSeason(),
      fandexApi.getRankings(),
      fandexApi.getScenarios(),
      fandexApi.getConditionalOrders(),
      fandexApi.getTransactions(),
      fandexApi.getDividendSchedule(),
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
      dividendSchedule: scheduleData,
      isReady: true,
    });
  },
  login: async (payload) => {
    const user = await authApi.login(payload);
    set({
      user,
      toast: `${user.name}님, 다시 오신 것을 환영합니다.`,
    });
  },
  signup: async (payload) => {
    const user = await authApi.signup(payload);
    const totalAssets = user.cash;
    const entry: RankingEntry = {
      id: user.id,
      name: user.name,
      role: user.role,
      rank: get().rankings.length + 1,
      totalAssets,
      returnRate: 0,
      dividendTotal: 0,
      tradeVolume: 0,
    };

    set({
      user,
      rankings: [...get().rankings, entry],
      toast: `${user.name}님의 계정이 생성되었습니다.`,
    });
  },
  logout: async () => {
    await authApi.logout();
    set({
      user: undefined,
      toast: '로그아웃되었습니다.',
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
  updateDividendSchedule: (patch) => {
    const current = get().dividendSchedule;
    if (!current) return;
    set({
      dividendSchedule: { ...current, ...patch },
      toast: '배당 지급 스케줄이 업데이트되었습니다.',
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
