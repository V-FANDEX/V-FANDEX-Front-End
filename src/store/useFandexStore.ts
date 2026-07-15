import { create } from 'zustand';
import { authApi, type LoginPayload, type SignupPayload } from '../services/authApi';
import { clearAuthToken, getErrorMessage } from '../services/apiClient';
import { fandexApi, mergeUserData, type ConditionalOrderPayload } from '../services/fandexApi';
import { enrichMarkets } from '../services/mappers';
import type {
  ConditionalOrder,
  DividendSchedule,
  Market,
  RankingEntry,
  ScenarioLog,
  SeasonInfo,
  Stock,
  Transaction,
  UserAccount,
} from '../types';

type OrderKind = 'buy' | 'sell';

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
  loadStocks: (params?: { marketId?: string; search?: string }) => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  toggleFavorite: (stockId: string) => Promise<void>;
  placeOrder: (stockId: string, type: OrderKind, quantity: number) => Promise<void>;
  createConditionalOrder: (payload: ConditionalOrderPayload) => Promise<void>;
  claimDividend: (stockId?: string) => Promise<void>;
  updateDividendSchedule: (patch: Partial<DividendSchedule>) => void;
  cancelConditionalOrder: (orderId: string) => Promise<void>;
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
    try {
      const publicResults = await Promise.allSettled([
        fandexApi.getStocks(),
        fandexApi.getMarkets(),
        fandexApi.getSeason(),
        fandexApi.getRankings(),
        fandexApi.getScenarios(),
      ]);
      const stocksData = settledValue(publicResults[0], []);
      const marketsData = settledValue(publicResults[1], []);
      const seasonData = settledValue(publicResults[2], undefined);
      const rankingData = settledValue(publicResults[3], []);
      const scenarioData = settledValue(publicResults[4], []);
      const failedPublicData = publicResults
        .map((result, index) => (result.status === 'rejected' ? ['종목', '시장', '시즌', '랭킹', '시나리오'][index] : null))
        .filter((label): label is string => Boolean(label));
      const [currentUser, portfolio, watchlist, orderData, tradeData, dividendData, scheduleData, myRanking] =
        await Promise.all([
          safe(fandexApi.getCurrentUser()),
          safe(fandexApi.getPortfolio()),
          safe(fandexApi.getWatchlist(), []),
          safe(fandexApi.getConditionalOrders(), []),
          safe(fandexApi.getTransactions(), []),
          safe(fandexApi.getDividends(), []),
          safe(fandexApi.getDividendSchedule()),
          safe(fandexApi.getMyRanking()),
        ]);
      const transactions = [...(tradeData ?? []), ...(dividendData ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const user = mergeUserData(currentUser, portfolio, watchlist ?? [], dividendData ?? []);
      const rankings = upsertMyRanking(rankingData, myRanking, user);

      set({
        markets: enrichMarkets(marketsData, stocksData),
        stocks: stocksData,
        user,
        season: seasonData,
        rankings,
        scenarios: scenarioData,
        conditionalOrders: orderData ?? [],
        transactions,
        dividendSchedule: scheduleData,
        isReady: true,
        ...(failedPublicData.length
          ? { toast: `${failedPublicData.join(', ')} 데이터를 서버에서 불러오지 못했습니다. 잠시 후 다시 시도해주세요.` }
          : {}),
      });
    } catch (error) {
      set({
        isReady: true,
        toast: errorMessage(error),
      });
    }
  },

  loadStocks: async (params) => {
    try {
      const stocks = await fandexApi.getStocks(params);
      set({ stocks, markets: enrichMarkets(get().markets, stocks) });
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  login: async (payload) => {
    try {
      const user = await authApi.login(payload);
      set({ user, toast: `${user.name}님, 다시 오신 것을 환영합니다.` });
      await get().load();
    } catch (error) {
      set({ toast: errorMessage(error) });
      throw error;
    }
  },

  signup: async (payload) => {
    try {
      const user = await authApi.signup(payload);
      set({ user, toast: `${user.name}님의 계정이 생성되었습니다.` });
      await get().load();
    } catch (error) {
      set({ toast: errorMessage(error) });
      throw error;
    }
  },

  logout: async () => {
    await authApi.logout();
    set({
      user: undefined,
      conditionalOrders: [],
      transactions: [],
      toast: '로그아웃되었습니다.',
    });
  },

  toggleFavorite: async (stockId) => {
    const user = get().user;
    if (!user) {
      set({ toast: '즐겨찾기를 사용하려면 로그인이 필요합니다.' });
      return;
    }

    const exists = user.favoriteStockIds.includes(stockId);
    try {
      if (exists) {
        await fandexApi.removeWatchlist(stockId);
      } else {
        await fandexApi.addWatchlist(stockId);
      }
      const favoriteStockIds = await fandexApi.getWatchlist();

      set({
        user: {
          ...user,
          favoriteStockIds,
        },
        toast: exists ? '즐겨찾기에서 제거했습니다.' : '즐겨찾기에 추가했습니다.',
      });
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  placeOrder: async (stockId, type, quantity) => {
    if (!get().user) {
      set({ toast: '거래하려면 로그인이 필요합니다.' });
      return;
    }
    if (quantity <= 0) {
      set({ toast: '주문 수량을 1주 이상 입력해주세요.' });
      return;
    }

    try {
      const payload = { stockId, quantity, orderType: 'MARKET' as const };
      if (type === 'buy') {
        await fandexApi.buyStock(payload);
      } else {
        await fandexApi.sellStock(payload);
      }

      set({ toast: type === 'buy' ? '매수 주문이 체결되었습니다.' : '매도 주문이 체결되었습니다.' });
      await get().load();
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  createConditionalOrder: async (payload) => {
    if (!get().user) {
      set({ toast: '조건 주문을 등록하려면 로그인이 필요합니다.' });
      return;
    }

    try {
      await fandexApi.createConditionalOrder(payload);
      set({ toast: '조건 주문이 등록되었습니다.' });
      const conditionalOrders = await fandexApi.getConditionalOrders();
      set({ conditionalOrders });
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  claimDividend: async (stockId) => {
    if (!get().user) {
      set({ toast: '배당금을 수령하려면 로그인이 필요합니다.' });
      return;
    }

    try {
      await fandexApi.claimDividend(stockId);
      set({ toast: stockId ? '종목 배당금 수령 요청이 완료되었습니다.' : '시스템 배당금 수령 요청이 완료되었습니다.' });
      await get().load();
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  updateDividendSchedule: (patch) => {
    const current = get().dividendSchedule;
    if (!current) return;
    set({ dividendSchedule: { ...current, ...patch } });
  },

  cancelConditionalOrder: async (orderId) => {
    try {
      await fandexApi.cancelConditionalOrder(orderId);
      set({
        conditionalOrders: get().conditionalOrders.map((order) =>
          order.id === orderId ? { ...order, active: false, status: 'CANCELLED' } : order,
        ),
        toast: '조건 주문을 취소했습니다.',
      });
    } catch (error) {
      set({ toast: errorMessage(error) });
    }
  },

  notify: (message) => set({ toast: message }),
  clearToast: () => set({ toast: undefined }),
}));

async function safe<T>(promise: Promise<T>, fallback?: T) {
  try {
    return await promise;
  } catch (error) {
    if (isUnauthorized(error)) {
      clearAuthToken();
      return fallback;
    }
    return fallback;
  }
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function isUnauthorized(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 401);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return getErrorMessage(error);
}

function upsertMyRanking(rankings: RankingEntry[], myRanking?: RankingEntry, user?: UserAccount) {
  if (!myRanking && !user) return rankings;
  const mine =
    myRanking ??
    (user && {
      id: user.id,
      name: user.name,
      role: user.role,
      rank: rankings.length + 1,
      totalAssets: user.totalAssetValue ?? user.cash,
      cash: user.cash,
      returnRate: 0,
      dividendTotal: user.totalDividend,
      tradeVolume: 0,
    });

  if (!mine) return rankings;
  const exists = rankings.some((entry) => entry.id === mine.id);
  return exists ? rankings.map((entry) => (entry.id === mine.id ? { ...entry, ...mine } : entry)) : [...rankings, mine];
}
