export type MarketCategory = string;
export type Trend = 'up' | 'down' | 'flat';
export type Role = 'user' | 'admin' | 'ai';
export type RiskProfile = 'aggressive' | 'stable' | 'random' | 'focused';
export type StockStatus = 'LISTED' | 'SUSPENDED' | 'UNLISTED' | string;
export type StockChartInterval = 'day' | 'hour' | 'minute';
export type AiStrategyType = 'AGGRESSIVE' | 'STABLE' | 'RANDOM' | 'MARKET_FOCUSED';
export type SeedSource = 'FILE' | 'ADMIN' | null;
export type DecimalValue = string;
export type MarketStatus = 'OPEN' | 'CLOSED' | 'HALTED' | string;
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED';
export type WebSocketConnectionStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE';

/**
 * Backend decimal values stay as strings at the transport boundary. Existing
 * screens still use mapped numbers; new market-engine APIs must use these
 * decimal-safe contracts instead of coercing values to JavaScript Number.
 */
export interface StockQuote {
  id: string;
  marketId: string;
  name: string;
  currentPrice: DecimalValue;
  previousPrice: DecimalValue;
  changeRate: DecimalValue;
  priceAsOf: string;
}

export interface OrderBookLevel {
  price: DecimalValue;
  quantity: DecimalValue;
  cumulativeQuantity?: DecimalValue;
}

export interface OrderBook {
  stockId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  sequence: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  stockId: string;
  price: DecimalValue;
  quantity: DecimalValue;
  side?: OrderSide;
  executedAt: string;
}

export interface Candle {
  timestamp: string;
  open: DecimalValue;
  high: DecimalValue;
  low: DecimalValue;
  close: DecimalValue;
  volume: DecimalValue;
}

export interface OrderRequest {
  stockId: string;
  side: OrderSide;
  type: OrderType;
  quantity: DecimalValue;
  price?: DecimalValue;
  idempotencyKey?: string;
}

export interface Order extends OrderRequest {
  id: string;
  status: OrderStatus;
  filledQuantity: DecimalValue;
  remainingQuantity: DecimalValue;
  averageFillPrice?: DecimalValue;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  stockId: string;
  quantity: DecimalValue;
  averagePrice: DecimalValue;
  currentPrice: DecimalValue;
  marketValue: DecimalValue;
  unrealizedProfit: DecimalValue;
  returnRate: DecimalValue;
}

export interface Portfolio {
  totalAssets: DecimalValue;
  cash: DecimalValue;
  stockValue: DecimalValue;
  unrealizedProfit: DecimalValue;
  realizedProfit: DecimalValue;
  positions: Position[];
  asOf: string;
}

export interface MarketEvent {
  id: string;
  title: string;
  content: string;
  occurredAt: string;
  marketIds: string[];
  stockIds: string[];
  verification: 'OFFICIAL' | 'RUMOR' | 'UNVERIFIED';
}

export interface AgentSummary {
  id: string;
  name: string;
  strategy?: string;
  primaryMarketId?: string;
  totalAssets: DecimalValue;
  returnRate: DecimalValue;
  rank: number;
}

export interface MarketIndex {
  marketId: string;
  value: DecimalValue;
  previousClose: DecimalValue;
  changeRate: DecimalValue;
  tradeValue: DecimalValue;
  asOf: string;
}

export interface WebSocketMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
  channel?: string;
  sequence?: string;
  sentAt?: string;
}

export interface Market {
  marketCapExact?: string;
  id: MarketCategory;
  name: string;
  description: string;
  icon: string;
  stockCount: number;
  marketCap: number;
  changeRate: number;
  volume: number;
  metricsAvailable: boolean;
  active: boolean;
  sortOrder: number;
  seedSource: SeedSource;
  seededAt: string | null;
}

export interface Stock {
  marketCapExact?: string;
  tradeValueExact?: string;
  sectorId?: string | null;
  sectorRevision?: number;
  priceExact?: string;
  id: string;
  marketId: MarketCategory;
  market?: Market;
  name: string;
  symbol: string;
  initialPrice: number;
  price: number;
  previousClose: number;
  changeRate: number;
  volume: number;
  tradeValue: number;
  marketCap: number;
  dividendEnabled: boolean;
  dividendRate: number;
  description: string;
  imageUrl: string;
  tags: string[];
  volatility: 'S' | 'A' | 'B' | 'C';
  active: boolean;
  status: StockStatus;
  isTradingSuspended?: boolean;
  metadata: Record<string, string>;
  totalSupply?: number;
  circulatingSupply?: number;
  seedSource: SeedSource;
  seedPrice: number | null;
  seededAt: string | null;
}

export interface Holding {
  stockId: string;
  quantity: number;
  averagePrice: number;
  realizedProfit?: number;
  stock?: Stock;
}

export interface Transaction {
  totalExact?: string;
  id: string;
  stockId: string;
  stock?: Stock;
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
  status?: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED' | 'FAILED' | string;
  createdAt: string;
  executedAt?: string;
}

export interface DividendSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  payoutTime: string;
  timezone: string;
  nextPayoutAt: string;
  nextRunAt?: string;
  eligiblePolicy: string;
  status: 'active' | 'paused';
  lastRunAt?: string;
  baseDividendRate?: number;
  claimCountMultiplier?: number;
  claimCooldownMinutes?: number;
  seasonalClaimLimit?: number;
}

export interface UserAccount {
  totalDividendExact?: string;
  cashExact?: string;
  totalAssetValueExact?: string;
  id: string;
  email?: string;
  name: string;
  role: Role;
  cash: number;
  initialCash?: number;
  totalAssetValue?: number;
  totalDividend: number;
  favoriteStockIds: string[];
  holdings: Holding[];
}

export interface RankingEntry {
  totalAssetsExact?: string;
  id: string;
  name: string;
  role: Role;
  rank: number;
  totalAssets: number;
  cash?: number;
  returnRate: number;
  realizedProfit?: number;
  dividendTotal: number;
  tradeVolume: number;
  favoriteMarket?: string;
}

export interface ScenarioImpact {
  id: string;
  stockId: string;
  stockName?: string;
  marketId: MarketCategory;
  marketName?: string;
  direction: Trend;
  impactRate: number;
  beforePrice: number;
  afterPrice: number;
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
  content?: string;
  sentiment?: string;
  impactLevel?: number;
  impacts?: ScenarioImpact[];
  occurredAt: string;
}

export interface SeasonInfo {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  day: number;
  initialCash?: number;
  status?: string;
}

export interface StockChartPoint {
  label: string;
  price: number;
  volume: number;
  interval?: StockChartInterval;
  bucket?: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  changeRate?: number;
  count?: number;
  occurredAt?: string;
}

export interface AdminDashboardSeriesPoint {
  date: string;
  count: number;
}

export interface AdminMarketVolumePoint {
  marketId: string;
  marketName: string;
  tradeVolume: number;
  tradeCount: number;
}

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  aiAccountCount: number;
  stockCount: number;
  marketCount: number;
  totalMarketCap: number;
  dailyTradeVolume: number;
  userGrowthSeries: AdminDashboardSeriesPoint[];
  marketVolumeSeries: AdminMarketVolumePoint[];
}

export interface AdminAiAccount {
  id: string;
  userId: string;
  strategyType: AiStrategyType;
  preferredMarketIds: string[];
  riskLevel: number;
  isActive: boolean;
  nickname: string;
  cash: number;
  totalAssetValue: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  user?: UserAccount;
}

export interface SeasonResetResult {
  seasonId: string;
  resetMode: 'SEED_CATALOG_ONLY' | string;
  usersReset: number;
  holdingsCleared: number;
  conditionalOrdersCleared: number;
  watchlistItemsCleared: number;
  tradesCleared: number;
  dividendsCleared: number;
  rankingsCleared: number;
  scenarioImpactsCleared: number;
  scenariosCleared: number;
  priceHistoriesCleared: number;
  nonSeedStocksDeleted: number;
  nonSeedMarketsDeleted: number;
  seedMarketsApplied: number;
  seedStocksApplied: number;
  adminSeedMarketsPreserved: number;
  adminSeedStocksRestored: number;
  seedPriceHistoriesCreated: number;
}

export interface ScenarioAppliedStock {
  stockId: string;
  stockName: string;
  marketId?: string;
  marketName?: string;
  beforePrice: number;
  afterPrice: number;
  appliedRate: number;
  impactReason?: string;
}

export interface ScenarioConditionalOrderResult {
  orderId?: string;
  stockId?: string;
  stockName?: string;
  marketId?: string;
  marketName?: string;
  status?: string;
  type?: string;
  quantity?: number;
  reason?: string;
}

export interface ScenarioAiTradeResult {
  aiAccountId?: string;
  userId?: string;
  action: string;
  stockId?: string;
  stockName?: string;
  marketId?: string;
  marketName?: string;
  quantity?: number;
  tradeId?: string;
  reason?: string;
}

export interface ScenarioApplyResult {
  id: string;
  title: string;
  affectedStocks: ScenarioAppliedStock[];
  conditionalOrderResults: ScenarioConditionalOrderResult[];
  aiTradeSummary?: string;
  aiTradeResults: ScenarioAiTradeResult[];
}

export interface MarketSimulationSettings {
  id: string;
  isEnabled: boolean;
  intervalMinutes: number;
  randomIntervalEnabled: boolean;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  minChangeRate: number;
  maxChangeRate: number;
  extremeMinRate: number;
  extremeMaxRate: number;
  extremeChance: number;
  volatilityWeight: number;
  targetStockCount?: number | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  updatedAt?: string;
}

export interface MarketSimulationAffectedStock {
  stockId: string;
  stockName: string;
  marketId?: string;
  marketName?: string;
  beforePrice: number;
  afterPrice: number;
  appliedRate: number;
  mode: 'NORMAL' | 'EXTREME' | string;
  reason?: string;
}

export interface MarketSimulationRunResult {
  ok: boolean;
  mode: 'MANUAL' | 'SCHEDULED' | string;
  affectedCount: number;
  affectedStocks: MarketSimulationAffectedStock[];
  conditionalOrderResults: ScenarioConditionalOrderResult[];
  nextRunAt?: string | null;
  scheduledIntervalMinutes?: number | null;
}

export type ScenarioAutomationRunStatus =
  | 'COMPLETED'
  | 'GENERATED_APPLY_FAILED'
  | 'FAILED'
  | 'SKIPPED_ALREADY_RUNNING'
  | 'SKIPPED_NOT_DUE'
  | 'SKIPPED_LEASED'
  | 'SKIPPED_DAILY_LIMIT';

export interface ScenarioAutomationSettings {
  id: string;
  isEnabled: boolean;
  mainEnabled: boolean;
  smallEnabled: boolean;
  autoApply: boolean;
  mainMinIntervalHours: number;
  mainMaxIntervalHours: number;
  smallMinIntervalMinutes: number;
  smallMaxIntervalMinutes: number;
  dailyMainLimit: number;
  dailySmallLimit: number;
  retryDelayMinutes: number;
  lastMainRunAt?: string | null;
  nextMainRunAt?: string | null;
  lastSmallRunAt?: string | null;
  nextSmallRunAt?: string | null;
  lastMainError?: string | null;
  lastMainErrorAt?: string | null;
  lastSmallError?: string | null;
  lastSmallErrorAt?: string | null;
  todayMainCount: number;
  todaySmallCount: number;
  serverTime: string;
  updatedAt: string;
}

export interface ScenarioAutomationRunResult {
  type: 'MAIN' | 'SMALL';
  status: ScenarioAutomationRunStatus;
  scenario?: ScenarioLog;
  autoApply?: boolean;
  application?: ScenarioApplyResult | null;
  applyError?: string | null;
  completedAt?: string;
  nextRunAt?: string;
}

export interface ScenarioAutomationProcessResult {
  ok: boolean;
  status: 'DISABLED' | 'IDLE' | 'PROCESSED' | string;
  checkedAt: string;
  results: ScenarioAutomationRunResult[];
}
