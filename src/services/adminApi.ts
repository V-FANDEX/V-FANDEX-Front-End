import type { AdminSection } from '../types/admin';
import type {
  AdminAiAccount,
  AdminDashboard,
  AiStrategyType,
  Market,
  MarketSimulationRunResult,
  MarketSimulationSettings,
  ScenarioApplyResult,
  ScenarioAutomationProcessResult,
  ScenarioAutomationRunResult,
  ScenarioAutomationSettings,
  SeasonResetResult,
  Stock,
} from '../types';
import { apiClient, jsonBody, withQuery } from './apiClient';
import {
  mapAdminAiAccount,
  mapAdminDashboard,
  mapDividendSchedule,
  mapMarket,
  mapMarketSimulationRunResult,
  mapMarketSimulationSettings,
  mapScenarioApplyResult,
  mapScenarioAutomationProcessResult,
  mapScenarioAutomationRunResult,
  mapScenarioAutomationSettings,
  mapSeasonResetResult,
  mapStock,
  toNumber,
} from './mappers';

export interface AdminActionPayload {
  section: AdminSection;
  action: string;
  values: Record<string, string | boolean>;
  requestedAt: string;
}

export interface AdminActionResult {
  requestId: string;
  status: 'sent' | 'queued';
  data?: unknown;
}

export interface AdminMarketPayload {
  name: string;
  description?: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AdminStockPayload {
  marketId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  initialPrice: number;
  totalSupply: number;
  circulatingSupply?: number;
  volatilityLevel?: string;
  dividendEnabled?: boolean;
  baseDividendRate?: number;
  isListed?: boolean;
}

export interface SaveStockToSeedPayload {
  seedPrice?: number;
}

export interface AdminStockCreationResult {
  stock: Stock;
  seedSaved: boolean | null;
  seedSaveError?: string;
}

export interface AdminAiCreatePayload {
  nickname: string;
  strategyType: AiStrategyType;
  preferredMarketIds?: string[];
  riskLevel: number;
  initialCash?: number;
}

export type AdminAiUpdatePayload = Partial<AdminAiCreatePayload>;

export interface AdminSeasonPayload {
  name: string;
  startsAt: string;
  endsAt: string;
  initialCash: number;
  status?: 'ACTIVE' | 'ENDED' | 'UPCOMING';
}

export interface AdminMarketSimulationPayload {
  isEnabled?: boolean;
  intervalMinutes?: number;
  randomIntervalEnabled?: boolean;
  minIntervalMinutes?: number;
  maxIntervalMinutes?: number;
  minChangeRate?: number;
  maxChangeRate?: number;
  extremeMinRate?: number;
  extremeMaxRate?: number;
  extremeChance?: number;
  volatilityWeight?: number;
  targetStockCount?: number;
  nextRunAt?: string;
}

export interface AdminScenarioAutomationPayload {
  isEnabled?: boolean;
  mainEnabled?: boolean;
  smallEnabled?: boolean;
  autoApply?: boolean;
  mainMinIntervalHours?: number;
  mainMaxIntervalHours?: number;
  smallMinIntervalMinutes?: number;
  smallMaxIntervalMinutes?: number;
  dailyMainLimit?: number;
  dailySmallLimit?: number;
  retryDelayMinutes?: number;
  nextMainRunAt?: string;
  nextSmallRunAt?: string;
}

export const adminApi = {
  getDashboard: async (): Promise<AdminDashboard> => mapAdminDashboard(await apiClient<unknown>('/admin/dashboard')),
  getUsers: (role?: string) => apiClient<unknown>(withQuery('/admin/users', { role })),
  updateUser: (id: string, body: Record<string, unknown>) =>
    apiClient<unknown>(`/admin/users/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  recalculateRankings: () => apiClient<unknown>('/admin/rankings/recalculate', { method: 'POST' }),

  getMarketSimulationSettings: async (): Promise<MarketSimulationSettings> =>
    mapMarketSimulationSettings(await apiClient<unknown>('/admin/market-simulation/settings')),
  updateMarketSimulationSettings: async (body: AdminMarketSimulationPayload): Promise<MarketSimulationSettings> =>
    mapMarketSimulationSettings(await apiClient<unknown>('/admin/market-simulation/settings', { method: 'PATCH', body: jsonBody(body) })),
  runMarketSimulation: async (): Promise<MarketSimulationRunResult> =>
    mapMarketSimulationRunResult(await apiClient<unknown>('/admin/market-simulation/run', { method: 'POST' })),

  getScenarioAutomationSettings: async (): Promise<ScenarioAutomationSettings> =>
    mapScenarioAutomationSettings(await apiClient<unknown>('/admin/scenario-automation/settings')),
  updateScenarioAutomationSettings: async (body: AdminScenarioAutomationPayload): Promise<ScenarioAutomationSettings> =>
    mapScenarioAutomationSettings(await apiClient<unknown>('/admin/scenario-automation/settings', { method: 'PATCH', body: jsonBody(body) })),
  runMainScenarioAutomation: async (): Promise<ScenarioAutomationRunResult> =>
    mapScenarioAutomationRunResult(await apiClient<unknown>('/admin/scenario-automation/run-main', { method: 'POST' })),
  runSmallScenarioAutomation: async (): Promise<ScenarioAutomationRunResult> =>
    mapScenarioAutomationRunResult(await apiClient<unknown>('/admin/scenario-automation/run-small', { method: 'POST' })),
  runDueScenarioAutomation: async (): Promise<ScenarioAutomationProcessResult> =>
    mapScenarioAutomationProcessResult(await apiClient<unknown>('/admin/scenario-automation/run-due', { method: 'POST' })),

  getMarkets: async (params: { includeInactive?: boolean } = {}): Promise<Market[]> =>
    (await apiClient<unknown[]>(withQuery('/admin/markets', { ...params }))).map((market, index) => mapMarket(market, undefined, index)),
  createMarket: (body: AdminMarketPayload) =>
    apiClient<unknown>('/admin/markets', { method: 'POST', body: jsonBody(body) }),
  updateMarket: (id: string, body: Partial<AdminMarketPayload>) =>
    apiClient<unknown>(`/admin/markets/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  deleteMarket: (id: string) => apiClient<unknown>(`/admin/markets/${id}`, { method: 'DELETE' }),

  getStocks: async (params: { includeUnlisted?: boolean; marketId?: string; search?: string } = {}): Promise<Stock[]> =>
    (await apiClient<unknown[]>(withQuery('/admin/stocks', { ...params }))).map(mapStock),
  createStock: async (body: AdminStockPayload): Promise<Stock> =>
    mapStock(await apiClient<unknown>('/admin/stocks', { method: 'POST', body: jsonBody(body) })),
  updateStock: async (id: string, body: Partial<AdminStockPayload>): Promise<Stock> =>
    mapStock(await apiClient<unknown>(`/admin/stocks/${id}`, { method: 'PATCH', body: jsonBody(body) })),
  updateStockListingStatus: async (id: string, body: { isListed: boolean }): Promise<Stock> =>
    mapStock(await apiClient<unknown>(`/admin/stocks/${id}/listing-status`, { method: 'PATCH', body: jsonBody(body) })),
  saveStockToSeed: async (id: string, body: SaveStockToSeedPayload = {}): Promise<Stock> =>
    mapStock(await apiClient<unknown>(`/admin/stocks/${id}/save-to-seed`, { method: 'POST', body: jsonBody(body) })),

  getOpenAiStatus: () => apiClient<unknown>('/admin/scenarios/openai-status'),
  testOpenAi: () => apiClient<unknown>('/admin/scenarios/test-openai', { method: 'POST' }),
  generateMainScenario: (body: ScenarioGeneratePayload) =>
    apiClient<unknown>('/admin/scenarios/generate-main', { method: 'POST', body: jsonBody(body) }),
  generateBigScenario: (body: ScenarioGeneratePayload) =>
    apiClient<unknown>('/admin/scenarios/generate-big', { method: 'POST', body: jsonBody(body) }),
  generateSmallScenario: (body: ScenarioGeneratePayload) =>
    apiClient<unknown>('/admin/scenarios/generate-small', { method: 'POST', body: jsonBody(body) }),
  applyScenario: async (id: string): Promise<ScenarioApplyResult> =>
    mapScenarioApplyResult(await apiClient<unknown>(`/admin/scenarios/${id}/apply`, { method: 'POST' })),

  getAiAccounts: async (): Promise<AdminAiAccount[]> => {
    const data = await apiClient<unknown>('/admin/ai-accounts');
    return (Array.isArray(data) ? data : []).map(mapAdminAiAccount);
  },
  createAiAccount: async (body: AdminAiCreatePayload): Promise<AdminAiAccount> =>
    mapAdminAiAccount(await apiClient<unknown>('/admin/ai-accounts', { method: 'POST', body: jsonBody(body) })),
  updateAiAccount: async (id: string, body: AdminAiUpdatePayload): Promise<AdminAiAccount> =>
    mapAdminAiAccount(await apiClient<unknown>(`/admin/ai-accounts/${id}`, { method: 'PATCH', body: jsonBody(body) })),
  deleteAiAccount: async (id: string): Promise<AdminAiAccount> =>
    mapAdminAiAccount(await apiClient<unknown>(`/admin/ai-accounts/${id}`, { method: 'DELETE' })),
  runAiTrade: (id: string) => apiClient<unknown>(`/admin/ai-accounts/${id}/run-trade`, { method: 'POST' }),

  getSeasons: () => apiClient<unknown>('/seasons'),
  createSeason: (body: AdminSeasonPayload) =>
    apiClient<unknown>('/admin/seasons', { method: 'POST', body: jsonBody(body) }),
  resetSeason: async (id: string): Promise<SeasonResetResult> =>
    mapSeasonResetResult(await apiClient<unknown>(`/admin/seasons/${id}/reset`, { method: 'POST', body: jsonBody({ confirm: true }) })),

  getDividendSettings: async () => mapDividendSchedule(await apiClient<unknown>('/admin/dividend-settings')),
  updateDividendSettings: async (body: AdminDividendSettingsPayload) =>
    mapDividendSchedule(await apiClient<unknown>('/admin/dividend-settings', { method: 'PATCH', body: jsonBody(body) })),
  runDividendSettings: () => apiClient<unknown>('/admin/dividend-settings/run', { method: 'POST' }),

  async submitAction(payload: AdminActionPayload): Promise<AdminActionResult> {
    const data = await submitAdminAction(payload);
    return {
      requestId: `${payload.section}-${Date.now()}`,
      status: 'sent',
      data,
    };
  },
};

interface ScenarioGeneratePayload {
  prompt?: string;
  affectedMarketIds?: string[];
  affectedStockIds?: string[];
}

interface AdminDividendSettingsPayload {
  baseDividendRate?: number;
  claimCountMultiplier?: number;
  claimCooldownMinutes?: number;
  seasonalClaimLimit?: number;
  isEnabled?: boolean;
  nextRunAt?: string;
}

async function submitAdminAction({ section, action, values }: AdminActionPayload) {
  if (section === 'markets') {
    if (action === '새 장/시장 추가') {
      return adminApi.createMarket({
        name: String(values.marketName || ''),
        description: optionalString(values.marketDescription),
        iconUrl: optionalString(values.icon),
        sortOrder: toNumber(values.sortOrder),
        isActive: values.active === true,
      });
    }
    if (action === '장/시장 수정') {
      return adminApi.updateMarket(requiredId(firstFilled(values.marketId, values.targetMarket), '수정할 장'), {
        name: optionalString(values.marketName),
        description: optionalString(values.marketDescription),
        sortOrder: optionalNumber(values.sortOrder),
        isActive: parseActiveState(values.activeState),
      });
    }
    if (action === '장/시장 삭제') {
      requireConfirm(values.confirmText, '장 삭제');
      return adminApi.deleteMarket(requiredId(firstFilled(values.marketId, values.targetMarket), '삭제할 장'));
    }
    if (action === '장/시장 비활성화') {
      return adminApi.updateMarket(requiredId(firstFilled(values.marketId, values.targetMarket), '비활성화할 장'), {
        isActive: false,
      });
    }
  }

  if (section === 'stocks') {
    if (action === '새 종목 상장') {
      const stock = await adminApi.createStock({
        marketId: requiredId(firstFilled(values.marketId, values.market), '소속 장'),
        name: String(values.stockName || ''),
        description: optionalString(values.description),
        imageUrl: optionalString(values.imageUrl),
        tags: optionalString(values.tags)?.split(',').map((tag) => tag.trim()).filter(Boolean),
        initialPrice: toNumber(values.initialPrice),
        totalSupply: toNumber(values.totalSupply ?? values.initialSupply),
        circulatingSupply: optionalNumber(values.circulatingSupply),
        volatilityLevel: optionalString(values.volatility),
        dividendEnabled: values.dividendEnabled === true,
        baseDividendRate: optionalNumber(values.dividendRate),
        isListed: true,
      });
      if (values.persistToSeed !== true) {
        return { stock, seedSaved: null } satisfies AdminStockCreationResult;
      }
      try {
        const seededStock = await adminApi.saveStockToSeed(stock.id);
        return { stock: seededStock, seedSaved: true } satisfies AdminStockCreationResult;
      } catch (error) {
        return {
          stock,
          seedSaved: false,
          seedSaveError: error instanceof Error ? error.message : '기본 종목 저장에 실패했습니다.',
        } satisfies AdminStockCreationResult;
      }
    }
    if (action === '종목 수정') {
      return adminApi.updateStock(requiredId(firstFilled(values.stockId, values.targetStock), '수정할 종목'), {
        initialPrice: optionalNumber(values.manualPrice),
        volatilityLevel: optionalSetting(values.volatility),
        baseDividendRate: optionalNumber(values.dividendRate),
        isListed: parseActiveState(values.activeState),
      });
    }
    if (action === '종목 비활성화') {
      return adminApi.updateStockListingStatus(requiredId(firstFilled(values.stockId, values.targetStock), '비활성화할 종목'), {
        isListed: false,
      });
    }
    if (action === '종목 상장폐지') {
      requireConfirm(values.confirmText, '상장폐지');
      return adminApi.updateStockListingStatus(requiredId(firstFilled(values.stockId, values.targetStock), '상장폐지할 종목'), {
        isListed: false,
      });
    }
  }

  if (section === 'ai') {
    if (action === 'AI 계정 추가') {
      const nickname = requiredText(firstFilled(values.nickname, values.aiName), 'AI 계정 이름', 32);
      const riskLevel = requiredNumber(values.riskLevel ?? values.riskLimit, '위험도', { min: 1, max: 10, integer: true });
      const initialCash = requiredNumber(values.initialCash, '초기 자금', { min: 0, integer: true });
      return adminApi.createAiAccount({
        nickname,
        strategyType: parseStrategy(firstFilled(values.strategyType, values.profile)),
        preferredMarketIds: parseIdList(firstFilled(values.preferredMarketIds, values.favoriteMarket)),
        riskLevel,
        initialCash,
      });
    }
    if (action === 'AI 투자 성향 리밸런싱') {
      return adminApi.runAiTrade(requiredId(firstFilled(values.aiAccountId, values.targetAi), 'AI 계정'));
    }
    if (action === 'AI 계정 비활성화' || action === 'AI 계정 삭제') {
      requireConfirm(values.confirmText, action === 'AI 계정 비활성화' ? 'AI 비활성화' : 'AI 삭제');
      return adminApi.deleteAiAccount(requiredId(firstFilled(values.aiAccountId, values.targetAi), '비활성화할 AI 계정'));
    }
    if (action === 'AI 계정 수정') {
      const nickname = optionalString(values.nickname);
      if (nickname && nickname.length > 32) throw new Error('AI 계정 이름은 32자 이하로 입력해주세요.');
      const preferredMarketValue = optionalString(values.preferredMarketIds);
      const body: AdminAiUpdatePayload = {
        nickname,
        strategyType: parseOptionalStrategy(values.strategyType ?? values.profile),
        preferredMarketIds: values.clearPreferredMarkets === true
          ? []
          : preferredMarketValue
            ? parseIdList(preferredMarketValue)
            : undefined,
        riskLevel: optionalValidatedNumber(values.riskLevel, '위험도', { min: 1, max: 10, integer: true }),
        initialCash: optionalValidatedNumber(values.initialCash, '초기 자금', { min: 0, integer: true }),
      };
      if (Object.values(body).every((value) => value === undefined)) throw new Error('수정할 값을 하나 이상 입력해주세요.');
      return adminApi.updateAiAccount(requiredId(firstFilled(values.aiAccountId, values.targetAi), '수정할 AI 계정'), body);
    }
  }

  if (section === 'scenarios') {
    const body = buildScenarioBody(values);
    if (action === '메인 시나리오 생성 요청') return adminApi.generateMainScenario(body);
    if (action === 'BIG 시나리오 생성 요청') return adminApi.generateBigScenario(body);
    if (action === '소규모 시나리오 생성 요청') return adminApi.generateSmallScenario(body);
    if (action === '시나리오 적용') return adminApi.applyScenario(requiredId(values.scenarioId, '적용할 시나리오'));
  }

  if (section === 'dividends') {
    if (action === '배당 즉시 실행') return adminApi.runDividendSettings();
    return adminApi.updateDividendSettings({
      baseDividendRate: optionalNumber(values.baseDividendRate ?? values.baseRate),
      claimCountMultiplier: optionalNumber(values.claimCountMultiplier ?? values.growthStep),
      claimCooldownMinutes: optionalNumber(values.claimCooldownMinutes),
      seasonalClaimLimit: optionalNumber(values.seasonalClaimLimit ?? values.maxRate),
      isEnabled: parseDividendEnabled(values),
      nextRunAt: optionalString(values.nextRunAt),
    });
  }

  if (section === 'users') {
    if (action === '랭킹 초기화') {
      requireConfirm(values.confirmText, '랭킹 초기화');
      return adminApi.recalculateRankings();
    }
    if (action === '유저 권한 변경') {
      return adminApi.updateUser(requiredId(firstFilled(values.userId, values.targetUser), '대상 유저'), {
        role: parseRole(values.role),
        isActive: true,
      });
    }
    if (action === '유저 거래 제한') {
      return adminApi.updateUser(requiredId(firstFilled(values.userId, values.targetUser), '대상 유저'), {
        isActive: false,
      });
    }
    return adminApi.getUsers();
  }

  if (section === 'season') {
    if (action === '시즌 초기화') {
      requireSeasonResetConfirm(values);
      return adminApi.resetSeason(requiredId(values.seasonId, '시즌 ID'));
    }
    if (action === '새 시즌 생성' || values.newSeasonName || values.startsAt || values.endsAt) {
      return adminApi.createSeason({
        name: String(values.newSeasonName || values.seasonName || ''),
        startsAt: String(values.startsAt || new Date().toISOString()),
        endsAt: String(values.endsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
        initialCash: toNumber(values.initialCash, 1_000_000),
        status: parseSeasonStatus(values.status),
      });
    }
  }

  return adminApi.getDashboard();
}

function buildScenarioBody(values: Record<string, string | boolean>): ScenarioGeneratePayload {
  return {
    prompt: optionalString(values.prompt ?? values.promptHint ?? values.theme),
    affectedMarketIds: firstFilled(values.affectedMarketIds, values.targetMarket)
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    affectedStockIds: firstFilled(values.affectedStockIds, values.targetStock)
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

function optionalString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function optionalSetting(value: unknown) {
  const text = optionalString(value);
  if (!text || text === '변경 없음') return undefined;
  return text;
}

function firstFilled(...values: unknown[]) {
  for (const value of values) {
    const text = optionalString(value);
    if (text) return text;
  }
  return undefined;
}

function optionalNumber(value: unknown) {
  if (!optionalString(value)) return undefined;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalValidatedNumber(
  value: unknown,
  label: string,
  constraints: { min?: number; max?: number; integer?: boolean } = {},
) {
  if (!optionalString(value)) return undefined;
  return requiredNumber(value, label, constraints);
}

function requiredId(value: unknown, label: string) {
  const id = optionalString(value);
  if (!id) throw new Error(`${label}를 입력해주세요.`);
  return id;
}

function requiredText(value: unknown, label: string, maxLength?: number) {
  const text = optionalString(value);
  if (!text) throw new Error(`${label} 값을 입력해주세요.`);
  if (maxLength && text.length > maxLength) throw new Error(`${label}은 ${maxLength}자 이하로 입력해주세요.`);
  return text;
}

function requiredNumber(
  value: unknown,
  label: string,
  constraints: { min?: number; max?: number; integer?: boolean } = {},
) {
  const parsed = Number(value);
  if (!optionalString(value) || !Number.isFinite(parsed)) throw new Error(`${label} 값을 숫자로 입력해주세요.`);
  if (constraints.integer && !Number.isInteger(parsed)) throw new Error(`${label} 값은 정수여야 합니다.`);
  if (constraints.min !== undefined && parsed < constraints.min) throw new Error(`${label} 값은 ${constraints.min} 이상이어야 합니다.`);
  if (constraints.max !== undefined && parsed > constraints.max) throw new Error(`${label} 값은 ${constraints.max} 이하여야 합니다.`);
  return parsed;
}

function parseIdList(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function requireConfirm(value: unknown, phrase: string) {
  if (String(value ?? '').trim() !== phrase) {
    throw new Error(`위험 작업을 실행하려면 확인 문구 "${phrase}"를 정확히 입력해주세요.`);
  }
}

function requireSeasonResetConfirm(values: Record<string, string | boolean>) {
  if (values.understandDeletionScope !== true) {
    throw new Error('시즌 초기화 삭제 범위를 이해했다는 체크가 필요합니다.');
  }

  requireConfirm(values.confirmText, 'RESET');
}

function parseActiveState(value: unknown) {
  const text = String(value ?? '');
  if (text === '활성' || text === '활성화') return true;
  if (text === '비활성' || text === '일시정지') return false;
  return undefined;
}

function parseStrategy(value: unknown): AdminAiCreatePayload['strategyType'] {
  const text = String(value ?? '').toUpperCase();
  if (text === 'AGGRESSIVE' || text === 'STABLE' || text === 'RANDOM' || text === 'MARKET_FOCUSED') return text;
  if (text.includes('공격')) return 'AGGRESSIVE';
  if (text.includes('안정')) return 'STABLE';
  if (text.includes('집중')) return 'MARKET_FOCUSED';
  return 'RANDOM';
}

function parseOptionalStrategy(value: unknown) {
  const text = optionalSetting(value);
  return text ? parseStrategy(text) : undefined;
}

function parseSeasonStatus(value: unknown): AdminSeasonPayload['status'] {
  const text = String(value ?? '');
  if (text === 'ACTIVE' || text === 'ENDED' || text === 'UPCOMING') return text;
  return 'UPCOMING';
}

function parseRole(value: unknown) {
  const text = String(value ?? '');
  if (text.includes('관리')) return 'ADMIN';
  return 'USER';
}

function parseDividendEnabled(values: Record<string, string | boolean>) {
  if (values.enabled === true || values.isEnabled === true) return true;
  if (values.scheduleStatus === '활성화') return true;
  if (values.scheduleStatus === '일시정지') return false;
  if (values.enabled === false || values.isEnabled === false) return false;
  return undefined;
}
