export type Row = Record<string, unknown>;
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface Identified extends Row {
  id: string;
}
export interface AiProfile extends Identified {
  userId: string;
  nickname?: string;
  strategyType: string;
  riskLevel: number;
  isActive: boolean;
  user?: { id: string; nickname: string; cash: string };
  personality?: Record<string, number>;
  preferredMarketIds?: string[];
  watchlistStockIds?: string[];
  favoriteStockIds?: string[];
}
export interface Decision extends Identified {
  agentId: string;
  sequence: string;
  strategyType: string;
  model: string;
  action: string;
  stockId: string | null;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}
export interface DecisionDetail extends Decision {
  profile: Row;
  result: Row | null;
  orders: EngineOrder[];
  executionCount: number;
  executedQuantity: number;
  observedAt: string;
}
export interface PerformanceItem {
  agentId: string;
  accountId: string;
  nickname: string;
  currentStrategyType: string;
  decisions: { strategyType: string; action: string; count: number }[];
  status: 'LIVE' | 'CLOSED' | 'BASELINE_UNAVAILABLE';
  baselineSource?: string;
  baselineAt?: string;
  valuedAt?: string;
  initialCash?: string;
  initialStockValue?: string;
  capitalAdjustments?: string;
  basis?: string;
  cash?: string;
  stockValue?: string;
  totalAssets?: string;
  profit?: string;
  returnPct?: string | null;
}
export interface Performance {
  seasonId: string;
  seasonStatus: string;
  observedAt: string;
  items: PerformanceItem[];
  limitations: string[];
}
export interface CompareResult extends Row {
  label: string;
  strategyType: string;
  finalCash: string;
  finalQuantity: number;
  finalValue: string;
  profit: string;
  returnPct: number;
  maxDrawdownPct: number;
  fees: string;
  tradeCount: number;
  skippedGapSignals: number;
  unfilledSignals: number;
  trades: Row[];
  equity: { at?: string; timestamp?: string; value: string }[];
}
export interface Comparison {
  model: string;
  source: Row;
  parameters: Row;
  limitations: string[];
  results: CompareResult[];
}
export interface Sector extends Identified {
  code: string;
  name: string;
  revision: number;
}
export interface EngineOrder extends Identified {
  stockId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: string | null;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: 'PENDING' | 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';
  updatedAt: string;
  createdAt: string;
  sequence: string;
  idempotencyKey: string;
}
export interface NewOrder {
  stockId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: string;
}
export interface Artifact extends Row {
  status: 'MISSING' | 'AVAILABLE' | 'STALE';
  revision: number;
}
export interface Storyline extends Identified {
  type: string;
  stockId?: string;
  marketId?: string;
  startedAt: string;
  state: string;
  revision: number;
  nextStep: number;
  steps: Row[];
}

export interface RetentionPolicy extends Row {
  revision: number;
  failedRunsEnabled: boolean;
  resolvedAlertsEnabled: boolean;
  failedRunRetentionDays: number;
  resolvedAlertRetentionDays: number;
  automaticCleanupEnabled: boolean;
  cleanupIntervalHours: number;
  cleanupBatchSize: number;
}
export interface RetentionPreview extends Row {
  policy: RetentionPolicy;
  evaluatedAt: string;
  cutoffs: Row;
  failedRuns: { count: string; items: Identified[] };
  resolvedAlerts: { count: string; items: Identified[] };
}
export interface StoryPreview extends Identified {
  type: string;
  startedAt: string;
  state: string;
  revision: number;
  nextStep: number;
  continuationOfId?: string | null;
  mergeSourceIds?: string[];
  steps: Row[];
}
