import type {
  ConditionalOrder,
  AdminDashboard,
  DividendSchedule,
  Holding,
  Market,
  RankingEntry,
  Role,
  ScenarioImpact,
  ScenarioLog,
  SeasonInfo,
  Stock,
  StockChartPoint,
  StockChartInterval,
  ScenarioApplyResult,
  Transaction,
  UserAccount,
} from '../types';

type AnyRecord = Record<string, unknown>;

const defaultMarketIcons = ['📡', '🎤', '✨', '🎬', '🎮', '💎'];
const placeholderImage =
  'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?auto=format&fit=crop&w=600&q=80';

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === 'bigint') return Number(value);
  return fallback;
}

export function mapRole(value: unknown): Role {
  const role = String(value ?? 'USER').toUpperCase();
  if (role === 'ADMIN') return 'admin';
  if (role === 'AI') return 'ai';
  return 'user';
}

export function mapUser(raw: unknown, extras?: Partial<UserAccount>): UserAccount {
  const source = asRecord(raw);
  return {
    id: String(source.id ?? extras?.id ?? ''),
    email: source.email ? String(source.email) : extras?.email,
    name: String(source.nickname ?? source.name ?? extras?.name ?? '팬덱스 유저'),
    role: mapRole(source.role ?? extras?.role),
    cash: toNumber(source.cash, extras?.cash ?? 0),
    initialCash: toNumber(source.initialCash, extras?.initialCash ?? 0),
    totalAssetValue: toNumber(source.totalAssetValue, extras?.totalAssetValue ?? 0),
    totalDividend: toNumber(
      source.totalDividendReceived ?? source.totalDividend ?? source.dividendTotal,
      extras?.totalDividend ?? 0,
    ),
    favoriteStockIds: extras?.favoriteStockIds ?? [],
    holdings: extras?.holdings ?? [],
  };
}

export function mapPortfolio(raw: unknown) {
  const source = asRecord(raw);
  const holdings = Array.isArray(source.holdings) ? source.holdings.map(mapHolding) : [];
  return {
    user: mapUser(source, { holdings }),
    holdings,
  };
}

export function mapHolding(raw: unknown): Holding {
  const source = asRecord(raw);
  const stock = source.stock ? mapStock(source.stock) : undefined;
  return {
    stockId: String(source.stockId ?? stock?.id ?? ''),
    quantity: toNumber(source.quantity ?? source.shares),
    averagePrice: toNumber(source.averagePrice ?? source.averageBuyPrice ?? source.avgBuyPrice ?? source.avgPrice),
    realizedProfit: toNumber(source.realizedProfit),
    stock,
  };
}

export function mapMarket(raw: unknown, stocks: Stock[] = [], index = 0): Market {
  const source = asRecord(raw);
  const id = String(source.id ?? source.marketId ?? '');
  const marketStocks = stocks.filter((stock) => stock.marketId === id);
  const marketCap = marketStocks.reduce((sum, stock) => sum + stock.marketCap, 0);
  const volume = marketStocks.reduce((sum, stock) => sum + stock.volume, 0);
  const changeRate = marketStocks.length
    ? marketStocks.reduce((sum, stock) => sum + stock.changeRate, 0) / marketStocks.length
    : toNumber(source.changeRate ?? source.todayChangeRate);

  return {
    id,
    name: String(source.name ?? '미분류 장'),
    description: String(source.description ?? '운영자가 등록한 가상 팬덤 시장입니다.'),
    icon: String(source.icon ?? source.iconUrl ?? defaultMarketIcons[index % defaultMarketIcons.length]),
    stockCount: toNumber(source.stockCount, marketStocks.length),
    marketCap: toNumber(source.marketCap, marketCap),
    changeRate,
    volume: toNumber(source.volume, volume),
    active: Boolean(source.isActive ?? source.active ?? true),
    sortOrder: toNumber(source.sortOrder, index),
  };
}

export function enrichMarkets(markets: Market[], stocks: Stock[]) {
  return markets
    .map((market, index) => mapMarket(market, stocks, index))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function mapStock(raw: unknown): Stock {
  const source = asRecord(raw);
  const market = source.market ? mapMarket(source.market) : undefined;
  const currentPrice = toNumber(
    source.currentPrice ?? source.price ?? source.lastPrice ?? source.closePrice ?? source.initialPrice,
    0,
  );
  const previousClose = toNumber(
    source.previousPrice ?? source.previousClose ?? source.prevPrice ?? source.openPrice ?? source.initialPrice,
    currentPrice,
  );
  const changeRate = previousClose > 0
    ? ((currentPrice - previousClose) / previousClose) * 100
    : toNumber(source.changeRate ?? source.fluctuationRate);
  const totalSupply = toNumber(source.totalSupply ?? source.circulatingSupply, 0);
  const circulatingSupply = toNumber(source.circulatingSupply, totalSupply);
  const tags = normalizeTags(source.tags);

  return {
    id: String(source.id ?? ''),
    marketId: String(source.marketId ?? market?.id ?? ''),
    market,
    name: String(source.name ?? '이름 없는 종목'),
    symbol: String(source.symbol ?? createSymbol(String(source.name ?? source.id ?? 'VF'))),
    price: currentPrice,
    previousClose,
    changeRate,
    volume: toNumber(source.volume ?? source.tradeVolume),
    tradeValue: toNumber(source.tradeValue),
    marketCap: toNumber(source.marketCap, currentPrice * circulatingSupply),
    dividendEnabled: Boolean(source.dividendEnabled ?? false),
    dividendRate: toNumber(source.baseDividendRate ?? source.dividendRate),
    description: String(source.description ?? '등록된 설명이 없습니다.'),
    imageUrl: String(source.imageUrl ?? source.thumbnailUrl ?? placeholderImage),
    tags,
    volatility: normalizeVolatility(source.volatilityLevel ?? source.volatility),
    active: Boolean(source.isListed ?? source.isActive ?? source.active ?? true),
    status: normalizeStockStatus(source.status, source.isListed, source.isTradingSuspended),
    isTradingSuspended: Boolean(source.isTradingSuspended ?? false),
    totalSupply,
    circulatingSupply,
    metadata: normalizeMetadata(source.metadata, {
      상장상태: normalizeStockStatus(source.status, source.isListed, source.isTradingSuspended),
      변동성: String(source.volatilityLevel ?? source.volatility ?? '-'),
    }),
  };
}

export function mapChartPoint(raw: unknown, index: number): StockChartPoint {
  const source = asRecord(raw);
  const time = String(source.bucket ?? source.timestamp ?? source.createdAt ?? source.time ?? source.appliedAt ?? '');
  const price = toNumber(source.price ?? source.closePrice ?? source.currentPrice ?? source.close ?? source.value);
  return {
    label: String(source.label ?? formatChartLabel(time, index)),
    price,
    volume: toNumber(source.volume ?? source.tradeVolume ?? source.count),
    interval: normalizeChartInterval(source.interval),
    bucket: source.bucket ? String(source.bucket) : undefined,
    openPrice: toNumber(source.openPrice, price),
    highPrice: toNumber(source.highPrice, price),
    lowPrice: toNumber(source.lowPrice, price),
    closePrice: toNumber(source.closePrice, price),
    changeRate: toNumber(source.changeRate),
    count: toNumber(source.count),
    occurredAt: time || undefined,
  };
}

export function mapRanking(raw: unknown): RankingEntry {
  const source = asRecord(raw);
  const user = asRecord(source.user);
  const role = mapRole(user.role ?? source.role);
  const id = String(source.userId ?? user.id ?? source.id ?? '');
  return {
    id,
    name: String(user.nickname ?? user.name ?? source.nickname ?? source.name ?? '익명 유저'),
    role,
    rank: toNumber(source.rank, 0),
    totalAssets: toNumber(source.totalAssetValue ?? source.totalAssets ?? source.assetValue),
    cash: toNumber(source.cash),
    returnRate: toNumber(source.profitRate ?? source.returnRate),
    realizedProfit: toNumber(source.realizedProfit),
    dividendTotal: toNumber(source.totalDividendReceived ?? source.dividendTotal),
    tradeVolume: toNumber(source.tradeVolume),
    favoriteMarket: source.favoriteMarket ? String(source.favoriteMarket) : undefined,
  };
}

export function mapScenario(raw: unknown): ScenarioLog {
  const source = asRecord(raw);
  const impacts = Array.isArray(source.impacts) ? source.impacts.map(mapScenarioImpact) : [];
  const affectedStockIds = normalizeStringArray(source.affectedStockIds);
  const affectedMarketIds = normalizeStringArray(source.affectedMarketIds);
  return {
    id: String(source.id ?? ''),
    title: String(source.title ?? '무제 시나리오'),
    type: normalizeScenarioType(source.type),
    affectedStockIds: affectedStockIds.length ? affectedStockIds : impacts.map((impact) => impact.stockId).filter(Boolean),
    affectedMarketIds: affectedMarketIds.length
      ? affectedMarketIds
      : impacts.map((impact) => impact.marketId).filter(Boolean),
    direction: normalizeTrend(source.sentiment ?? source.direction),
    strength: toNumber(source.impactLevel ?? source.strength),
    description: String(source.content ?? source.description ?? ''),
    content: String(source.content ?? source.description ?? ''),
    sentiment: source.sentiment ? String(source.sentiment) : undefined,
    impactLevel: toNumber(source.impactLevel ?? source.strength),
    impacts,
    occurredAt: String(source.appliedAt ?? source.createdAt ?? new Date().toISOString()),
  };
}

export function mapScenarioImpact(raw: unknown): ScenarioImpact {
  const source = asRecord(raw);
  const stock = asRecord(source.stock);
  const market = asRecord(source.market);
  return {
    id: String(source.id ?? ''),
    stockId: String(source.stockId ?? stock.id ?? ''),
    stockName: stock.name ? String(stock.name) : undefined,
    marketId: String(source.marketId ?? market.id ?? ''),
    marketName: market.name ? String(market.name) : undefined,
    direction: normalizeTrend(source.direction ?? source.sentiment),
    impactRate: toNumber(source.impactRate ?? source.priceChangeRate ?? source.changeRate),
    beforePrice: toNumber(source.beforePrice ?? source.previousPrice ?? source.oldPrice),
    afterPrice: toNumber(source.afterPrice ?? source.newPrice ?? source.newPrice),
  };
}

export function mapTransaction(raw: unknown): Transaction {
  const source = asRecord(raw);
  const stock = source.stock ? mapStock(source.stock) : undefined;
  const type = normalizeTransactionType(source.type ?? source.tradeType);
  const quantity = toNumber(source.quantity);
  const price = toNumber(source.price ?? source.executedPrice ?? source.stockPrice ?? stock?.price);
  return {
    id: String(source.id ?? `${type}-${source.createdAt ?? Date.now()}`),
    stockId: String(source.stockId ?? stock?.id ?? ''),
    stock,
    type,
    quantity,
    price,
    total: toNumber(source.totalAmount ?? source.total ?? source.amount, price * quantity),
    createdAt: String(source.createdAt ?? source.claimedAt ?? new Date().toISOString()),
  };
}

export function mapDividend(raw: unknown): Transaction {
  const tx = mapTransaction(raw);
  return {
    ...tx,
    type: 'dividend',
    total: toNumber(asRecord(raw).amount ?? asRecord(raw).totalAmount ?? tx.total),
    createdAt: String(asRecord(raw).claimedAt ?? asRecord(raw).createdAt ?? tx.createdAt),
  };
}

export function mapConditionalOrder(raw: unknown): ConditionalOrder {
  const source = asRecord(raw);
  const conditionType = String(source.conditionType ?? '').toUpperCase();
  const type = String(source.type ?? '').toUpperCase();
  const active = String(source.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE' && Boolean(source.isActive ?? true);
  return {
    id: String(source.id ?? ''),
    stockId: String(source.stockId ?? ''),
    direction: conditionType.includes('GREATER') || type === 'SELL' ? 'sellAbove' : 'buyBelow',
    targetPrice: toNumber(source.triggerPrice ?? source.targetPrice),
    quantity: toNumber(source.quantity),
    active,
    status: String(source.status ?? (active ? 'ACTIVE' : 'CANCELLED')),
    createdAt: String(source.createdAt ?? new Date().toISOString()),
    executedAt: source.executedAt ? String(source.executedAt) : undefined,
  };
}

export function mapDividendSchedule(raw: unknown): DividendSchedule {
  const source = asRecord(raw);
  const cooldownMinutes = toNumber(source.claimCooldownMinutes, 1440);
  const nextPayoutAt = source.nextRunAt
    ? String(source.nextRunAt)
    : source.nextPayoutAt
      ? String(source.nextPayoutAt)
    : new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
  const enabled = Boolean(source.isEnabled ?? source.enabled ?? true);
  return {
    enabled,
    frequency: cooldownMinutes >= 60 * 24 * 25 ? 'monthly' : cooldownMinutes >= 60 * 24 * 6 ? 'weekly' : 'daily',
    payoutTime: String(source.payoutTime ?? '12:00'),
    timezone: String(source.timezone ?? 'UTC'),
    nextPayoutAt,
    nextRunAt: nextPayoutAt,
    eligiblePolicy: String(source.eligiblePolicy ?? '배당 가능 종목 보유자'),
    status: enabled ? 'active' : 'paused',
    lastRunAt: source.lastRunAt ? String(source.lastRunAt) : undefined,
    baseDividendRate: toNumber(source.baseDividendRate),
    claimCountMultiplier: toNumber(source.claimCountMultiplier),
    claimCooldownMinutes: cooldownMinutes,
    seasonalClaimLimit: toNumber(source.seasonalClaimLimit),
  };
}

export function fallbackDividendSchedule(): DividendSchedule {
  return {
    enabled: true,
    frequency: 'daily',
    payoutTime: '12:00',
    timezone: 'UTC',
    nextPayoutAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    eligiblePolicy: '배당 가능 종목 보유자',
    status: 'active',
  };
}

export function mapSeason(raw: unknown): SeasonInfo | undefined {
  if (!raw) return undefined;
  const source = asRecord(raw);
  const startsAt = String(source.startsAt ?? new Date().toISOString());
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  return {
    id: String(source.id ?? ''),
    name: String(source.name ?? '현재 시즌'),
    startsAt,
    endsAt: String(source.endsAt ?? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()),
    day: Number.isFinite(start) ? Math.max(1, Math.floor((now - start) / 86_400_000) + 1) : 1,
    initialCash: toNumber(source.initialCash),
    status: source.status ? String(source.status) : undefined,
  };
}

export function mapAdminDashboard(raw: unknown): AdminDashboard {
  const source = asRecord(raw);
  return {
    totalUsers: toNumber(source.totalUsers),
    activeUsers: toNumber(source.activeUsers),
    aiAccountCount: toNumber(source.aiAccountCount),
    stockCount: toNumber(source.stockCount),
    marketCount: toNumber(source.marketCount),
    totalMarketCap: toNumber(source.totalMarketCap),
    dailyTradeVolume: toNumber(source.dailyTradeVolume),
    userGrowthSeries: listFromRecord(source.userGrowthSeries).map((item) => {
      const point = asRecord(item);
      return {
        date: String(point.date ?? ''),
        count: toNumber(point.count),
      };
    }),
    marketVolumeSeries: listFromRecord(source.marketVolumeSeries).map((item) => {
      const point = asRecord(item);
      return {
        marketId: String(point.marketId ?? ''),
        marketName: String(point.marketName ?? '미분류 장'),
        tradeVolume: toNumber(point.tradeVolume),
        tradeCount: toNumber(point.tradeCount),
      };
    }),
  };
}

export function mapScenarioApplyResult(raw: unknown): ScenarioApplyResult {
  const source = asRecord(raw);
  return {
    id: String(source.id ?? ''),
    title: String(source.title ?? '시나리오 적용 결과'),
    affectedStocks: listFromRecord(source.affectedStocks).map((item) => {
      const stock = asRecord(item);
      return {
        stockId: String(stock.stockId ?? ''),
        stockName: String(stock.stockName ?? stock.name ?? stock.stockId ?? '종목'),
        beforePrice: toNumber(stock.beforePrice ?? stock.oldPrice),
        afterPrice: toNumber(stock.afterPrice ?? stock.newPrice),
        appliedRate: toNumber(stock.appliedRate ?? stock.changeRate),
        impactReason: stock.impactReason ? String(stock.impactReason) : undefined,
      };
    }),
    conditionalOrderResults: listFromRecord(source.conditionalOrderResults).map((item) => {
      const result = asRecord(item);
      return {
        orderId: result.orderId ? String(result.orderId) : undefined,
        stockId: result.stockId ? String(result.stockId) : undefined,
        status: result.status ? String(result.status) : undefined,
        type: result.type ? String(result.type) : undefined,
        quantity: toNumber(result.quantity),
        reason: result.reason ?? result.failureReason ? String(result.reason ?? result.failureReason) : undefined,
      };
    }),
    aiTradeSummary: source.aiTradeSummary ? String(source.aiTradeSummary) : undefined,
    aiTradeResults: listFromRecord(source.aiTradeResults).map((item) => {
      const result = asRecord(item);
      return {
        aiAccountId: result.aiAccountId ? String(result.aiAccountId) : undefined,
        userId: result.userId ? String(result.userId) : undefined,
        action: String(result.action ?? '-'),
        stockId: result.stockId ? String(result.stockId) : undefined,
        quantity: toNumber(result.quantity),
        tradeId: result.tradeId ? String(result.tradeId) : undefined,
        reason: result.reason ? String(result.reason) : undefined,
      };
    }),
  };
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? (value as AnyRecord) : {};
}

function listFromRecord(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return ['V-FANDEX'];
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeMetadata(value: unknown, fallback: Record<string, string>) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, item]) => {
      acc[key] = String(item);
      return acc;
    }, {});
  }
  return fallback;
}

function normalizeVolatility(value: unknown): Stock['volatility'] {
  if (typeof value === 'number') {
    if (value >= 8) return 'S';
    if (value >= 6) return 'A';
    if (value >= 3) return 'B';
    return 'C';
  }
  const volatility = String(value ?? 'B').toUpperCase();
  if (volatility === 'S' || volatility === 'A' || volatility === 'B' || volatility === 'C') return volatility;
  return 'B';
}

function normalizeStockStatus(status: unknown, isListed: unknown, isTradingSuspended: unknown) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'LISTED' || normalized === 'SUSPENDED' || normalized === 'UNLISTED') return normalized;
  if (isTradingSuspended) return 'SUSPENDED';
  return isListed === false ? 'UNLISTED' : 'LISTED';
}

function normalizeChartInterval(value: unknown): StockChartInterval | undefined {
  const interval = String(value ?? '').toLowerCase();
  if (interval === 'day' || interval === 'hour' || interval === 'minute') return interval;
  return undefined;
}

function normalizeScenarioType(value: unknown): ScenarioLog['type'] {
  const type = String(value ?? 'small').toLowerCase();
  if (type.includes('main')) return 'main';
  if (type.includes('big')) return 'big';
  return 'small';
}

function normalizeTrend(value: unknown): ScenarioLog['direction'] {
  const trend = String(value ?? '').toUpperCase();
  if (trend.includes('POSITIVE') || trend.includes('UP') || trend.includes('상승')) return 'up';
  if (trend.includes('NEGATIVE') || trend.includes('DOWN') || trend.includes('하락')) return 'down';
  return 'flat';
}

function normalizeTransactionType(value: unknown): Transaction['type'] {
  const type = String(value ?? '').toUpperCase();
  if (type.includes('SELL')) return 'sell';
  if (type.includes('DIVIDEND')) return 'dividend';
  return 'buy';
}

function createSymbol(value: string) {
  return value
    .replace(/[^a-zA-Z0-9가-힣]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'VF';
}

function formatChartLabel(value: string, index: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${index + 1}`;
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
