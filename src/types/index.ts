export type MarketCategory = 'streamer' | 'singer' | 'character' | 'anime';
export type Trend = 'up' | 'down' | 'flat';
export type Role = 'user' | 'admin' | 'ai';
export type RiskProfile = 'aggressive' | 'stable' | 'random' | 'focused';

export interface Market {
  id: MarketCategory;
  name: string;
  description: string;
  icon: string;
  stockCount: number;
  marketCap: number;
  changeRate: number;
  volume: number;
  active: boolean;
  sortOrder: number;
}

export interface Stock {
  id: string;
  marketId: MarketCategory;
  name: string;
  symbol: string;
  price: number;
  previousClose: number;
  changeRate: number;
  volume: number;
  marketCap: number;
  dividendEnabled: boolean;
  dividendRate: number;
  description: string;
  imageUrl: string;
  tags: string[];
  volatility: 'S' | 'A' | 'B' | 'C';
  active: boolean;
  metadata: Record<string, string>;
}

export interface Holding {
  stockId: string;
  quantity: number;
  averagePrice: number;
}

export interface Transaction {
  id: string;
  stockId: string;
  type: 'buy' | 'sell' | 'dividend';
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
}

export interface ConditionalOrder {
  id: string;
  stockId: string;
  direction: 'buyBelow' | 'sellAbove';
  targetPrice: number;
  quantity: number;
  active: boolean;
  createdAt: string;
  executedAt?: string;
}

export interface DividendSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  payoutTime: string;
  timezone: string;
  nextPayoutAt: string;
  eligiblePolicy: string;
  status: 'active' | 'paused';
  lastRunAt?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  role: Role;
  cash: number;
  totalDividend: number;
  favoriteStockIds: string[];
  holdings: Holding[];
}

export interface RankingEntry {
  id: string;
  name: string;
  role: Role;
  rank: number;
  totalAssets: number;
  returnRate: number;
  dividendTotal: number;
  tradeVolume: number;
  favoriteMarket?: string;
}

export interface ScenarioLog {
  id: string;
  title: string;
  type: 'main' | 'big' | 'small';
  affectedStockIds: string[];
  affectedMarketIds: MarketCategory[];
  direction: Trend;
  strength: number;
  description: string;
  occurredAt: string;
}

export interface SeasonInfo {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  day: number;
}
