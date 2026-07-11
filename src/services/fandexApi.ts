import type {
  ConditionalOrder,
  DividendSchedule,
  RankingEntry,
  ScenarioLog,
  SeasonInfo,
  Stock,
  StockChartPoint,
  StockChartInterval,
  Transaction,
  UserAccount,
} from '../types';
import { apiClient, hasAuthToken, jsonBody, withQuery } from './apiClient';
import {
  enrichMarkets,
  fallbackDividendSchedule,
  mapChartPoint,
  mapConditionalOrder,
  mapDividend,
  mapDividendSchedule,
  mapMarket,
  mapPortfolio,
  mapRanking,
  mapScenario,
  mapSeason,
  mapStock,
  mapTransaction,
  mapUser,
  toNumber,
} from './mappers';

export interface StockQuery {
  marketId?: string;
  search?: string;
}

export interface TradePayload {
  stockId: string;
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT' | 'CONDITION';
}

export interface ConditionalOrderPayload {
  stockId: string;
  type: 'BUY' | 'SELL';
  triggerPrice: number;
  conditionType: 'PRICE_LESS_THAN_OR_EQUAL' | 'PRICE_GREATER_THAN_OR_EQUAL';
  quantity: number;
}

export const fandexApi = {
  async health() {
    return apiClient<{ status: string; service: string; timestamp: string }>('/health');
  },

  async getMarkets(stocks?: Stock[]) {
    const markets = listFrom(await apiClient<unknown>('/markets')).map((item, index) => mapMarket(item, stocks, index));
    return stocks ? enrichMarkets(markets, stocks) : markets.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async getStocks(params: StockQuery = {}) {
    const stocks = listFrom(await apiClient<unknown>(withQuery('/stocks', { ...params }))).map(mapStock);
    return stocks.sort((a, b) => b.volume - a.volume);
  },

  async getMarketStocks(marketId: string) {
    const stocks = listFrom(await apiClient<unknown>(`/markets/${marketId}/stocks`)).map(mapStock);
    return stocks.sort((a, b) => b.volume - a.volume);
  },

  async getStock(id: string) {
    const stock = await apiClient<unknown>(`/stocks/${id}`);
    return stock ? mapStock(stock) : undefined;
  },

  async getStockChart(id: string, interval: StockChartInterval = 'day', take = 30): Promise<StockChartPoint[]> {
    const data = await apiClient<unknown>(withQuery(`/stocks/${id}/chart`, { interval, take }));
    return listFrom(data).map(mapChartPoint);
  },

  async getSeason(): Promise<SeasonInfo | undefined> {
    return mapSeason(await apiClient<unknown>('/seasons/current'));
  },

  async getSeasons() {
    return listFrom(await apiClient<unknown>('/seasons')).map(mapSeason).filter(Boolean) as SeasonInfo[];
  },

  async getRankings(params: { includeAi?: boolean } = {}): Promise<RankingEntry[]> {
    return listFrom(await apiClient<unknown>(withQuery('/rankings', params)))
      .map(mapRanking)
      .sort((a, b) => a.rank - b.rank);
  },

  async getSeasonRankings(seasonId: string) {
    return listFrom(await apiClient<unknown>(`/rankings/season/${seasonId}`)).map(mapRanking);
  },

  async getMyRanking() {
    if (!hasAuthToken()) return undefined;
    return mapRanking(await apiClient<unknown>('/rankings/me'));
  },

  async getScenarios(): Promise<ScenarioLog[]> {
    return listFrom(await apiClient<unknown>('/scenarios')).map(mapScenario);
  },

  async getScenario(id: string) {
    const scenario = await apiClient<unknown>(`/scenarios/${id}`);
    return scenario ? mapScenario(scenario) : undefined;
  },

  async getCurrentUser(): Promise<UserAccount | undefined> {
    if (!hasAuthToken()) return undefined;
    return mapUser(await apiClient<unknown>('/auth/me'));
  },

  async getPortfolio() {
    if (!hasAuthToken()) return undefined;
    return mapPortfolio(await apiClient<unknown>('/portfolio/me'));
  },

  async getTransactions(): Promise<Transaction[]> {
    if (!hasAuthToken()) return [];
    return listFrom(await apiClient<unknown>('/trades/me')).map(mapTransaction);
  },

  async getConditionalOrders(): Promise<ConditionalOrder[]> {
    if (!hasAuthToken()) return [];
    return listFrom(await apiClient<unknown>('/conditional-orders/me')).map(mapConditionalOrder);
  },

  async getWatchlist(): Promise<string[]> {
    if (!hasAuthToken()) return [];
    const rows = listFrom(await apiClient<unknown>('/watchlist/me'));
    return rows
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const stock = row.stock && typeof row.stock === 'object' ? (row.stock as Record<string, unknown>) : {};
        return String(row.stockId ?? stock.id ?? row.id ?? '');
      })
      .filter(Boolean);
  },

  async addWatchlist(stockId: string) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    await apiClient<unknown>(`/watchlist/${stockId}`, { method: 'POST' });
  },

  async removeWatchlist(stockId: string) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    await apiClient<unknown>(`/watchlist/${stockId}`, { method: 'DELETE' });
  },

  async getDividends(): Promise<Transaction[]> {
    if (!hasAuthToken()) return [];
    return listFrom(await apiClient<unknown>('/dividends/me')).map(mapDividend);
  },

  async claimDividend(stockId?: string) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    return apiClient<unknown>('/dividends/claim', {
      method: 'POST',
      body: jsonBody(stockId ? { stockId } : {}),
    });
  },

  async buyStock(payload: TradePayload) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    return apiClient<unknown>('/trades/buy', {
      method: 'POST',
      body: jsonBody({ ...payload, orderType: payload.orderType ?? 'MARKET' }),
    });
  },

  async sellStock(payload: TradePayload) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    return apiClient<unknown>('/trades/sell', {
      method: 'POST',
      body: jsonBody({ ...payload, orderType: payload.orderType ?? 'MARKET' }),
    });
  },

  async createConditionalOrder(payload: ConditionalOrderPayload) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    return apiClient<unknown>('/conditional-orders', {
      method: 'POST',
      body: jsonBody(payload),
    });
  },

  async cancelConditionalOrder(orderId: string) {
    if (!hasAuthToken()) throw new Error('로그인이 필요합니다.');
    return apiClient<unknown>(`/conditional-orders/${orderId}/cancel`, { method: 'PATCH' });
  },

  async getDividendSchedule(): Promise<DividendSchedule> {
    if (!hasAuthToken()) return fallbackDividendSchedule();
    try {
      return mapDividendSchedule(await apiClient<unknown>('/admin/dividend-settings'));
    } catch {
      return fallbackDividendSchedule();
    }
  },
};

function listFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const source = value as Record<string, unknown>;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(source.results)) return source.results;

  const numericKeys = Object.keys(source).filter((key) => /^\d+$/.test(key));
  if (numericKeys.length) return numericKeys.map((key) => source[key]);

  if ('totalAssetValue' in source || 'cash' in source || 'profitRate' in source) {
    return [source];
  }

  if ('price' in source || 'currentPrice' in source) {
    return [source];
  }

  return [];
}

export function mergeUserData(
  currentUser?: UserAccount,
  portfolio?: { user: UserAccount; holdings: UserAccount['holdings'] },
  watchlist: string[] = [],
  dividends: Transaction[] = [],
) {
  const base = portfolio?.user ?? currentUser;
  if (!base) return undefined;

  return {
    ...base,
    ...currentUser,
    cash: toNumber(portfolio?.user.cash, currentUser?.cash ?? base.cash),
    initialCash: toNumber(portfolio?.user.initialCash, currentUser?.initialCash ?? base.initialCash),
    totalAssetValue: toNumber(portfolio?.user.totalAssetValue, currentUser?.totalAssetValue ?? base.totalAssetValue),
    holdings: portfolio?.holdings ?? base.holdings,
    favoriteStockIds: watchlist,
    totalDividend: dividends.reduce((sum, item) => sum + item.total, currentUser?.totalDividend ?? base.totalDividend),
  };
}
