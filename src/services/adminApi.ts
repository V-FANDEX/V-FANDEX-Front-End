import type { AdminSection } from '../types/admin';
import type { AdminDashboard, Market, ScenarioApplyResult, SeasonResetResult, Stock } from '../types';
import { apiClient, jsonBody, withQuery } from './apiClient';
import { mapAdminDashboard, mapDividendSchedule, mapMarket, mapScenarioApplyResult, mapSeasonResetResult, mapStock, toNumber } from './mappers';

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

export interface AdminAiPayload {
  nickname: string;
  strategyType: 'AGGRESSIVE' | 'STABLE' | 'RANDOM' | 'MARKET_FOCUSED';
  preferredMarketIds?: string[];
  riskLevel: number;
  initialCash?: number;
  isActive?: boolean;
}

export interface AdminSeasonPayload {
  name: string;
  startsAt: string;
  endsAt: string;
  initialCash: number;
  status?: 'ACTIVE' | 'ENDED' | 'UPCOMING';
}

export const adminApi = {
  getDashboard: async (): Promise<AdminDashboard> => mapAdminDashboard(await apiClient<unknown>('/admin/dashboard')),
  getUsers: (role?: string) => apiClient<unknown>(withQuery('/admin/users', { role })),
  updateUser: (id: string, body: Record<string, unknown>) =>
    apiClient<unknown>(`/admin/users/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  recalculateRankings: () => apiClient<unknown>('/admin/rankings/recalculate', { method: 'POST' }),

  getMarkets: async (params: { includeInactive?: boolean } = {}): Promise<Market[]> =>
    (await apiClient<unknown[]>(withQuery('/admin/markets', { ...params }))).map((market, index) => mapMarket(market, [], index)),
  createMarket: (body: AdminMarketPayload) =>
    apiClient<unknown>('/admin/markets', { method: 'POST', body: jsonBody(body) }),
  updateMarket: (id: string, body: Partial<AdminMarketPayload>) =>
    apiClient<unknown>(`/admin/markets/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  deleteMarket: (id: string) => apiClient<unknown>(`/admin/markets/${id}`, { method: 'DELETE' }),

  getStocks: async (params: { includeUnlisted?: boolean; marketId?: string; search?: string } = {}): Promise<Stock[]> =>
    (await apiClient<unknown[]>(withQuery('/admin/stocks', { ...params }))).map(mapStock),
  createStock: (body: AdminStockPayload) =>
    apiClient<unknown>('/admin/stocks', { method: 'POST', body: jsonBody(body) }),
  updateStock: (id: string, body: Partial<AdminStockPayload>) =>
    apiClient<unknown>(`/admin/stocks/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  updateStockListingStatus: (id: string, body: { isListed: boolean }) =>
    apiClient<unknown>(`/admin/stocks/${id}/listing-status`, { method: 'PATCH', body: jsonBody(body) }),

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

  getAiAccounts: () => apiClient<unknown>('/admin/ai-accounts'),
  createAiAccount: (body: AdminAiPayload) =>
    apiClient<unknown>('/admin/ai-accounts', { method: 'POST', body: jsonBody(body) }),
  updateAiAccount: (id: string, body: Partial<AdminAiPayload>) =>
    apiClient<unknown>(`/admin/ai-accounts/${id}`, { method: 'PATCH', body: jsonBody(body) }),
  deleteAiAccount: (id: string) => apiClient<unknown>(`/admin/ai-accounts/${id}`, { method: 'DELETE' }),
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
      return adminApi.updateMarket(requiredId(values.marketId ?? values.targetMarket, '수정할 장 ID'), {
        name: optionalString(values.marketName),
        description: optionalString(values.marketDescription),
        sortOrder: optionalNumber(values.sortOrder),
        isActive: parseActiveState(values.activeState),
      });
    }
    if (action === '장/시장 삭제') {
      requireConfirm(values.confirmText, '장 삭제');
      return adminApi.deleteMarket(requiredId(values.marketId ?? values.targetMarket, '삭제할 장 ID'));
    }
    if (action === '장/시장 비활성화') {
      return adminApi.updateMarket(requiredId(values.marketId ?? values.targetMarket, '비활성화할 장 ID'), {
        isActive: false,
      });
    }
  }

  if (section === 'stocks') {
    if (action === '새 종목 상장') {
      return adminApi.createStock({
        marketId: requiredId(values.marketId ?? values.market, '소속 장 ID'),
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
    }
    if (action === '종목 수정') {
      return adminApi.updateStock(requiredId(values.stockId ?? values.targetStock, '수정할 종목 ID'), {
        initialPrice: optionalNumber(values.manualPrice),
        volatilityLevel: optionalString(values.volatility),
        baseDividendRate: optionalNumber(values.dividendRate),
        isListed: parseActiveState(values.activeState),
      });
    }
    if (action === '종목 비활성화') {
      return adminApi.updateStockListingStatus(requiredId(values.stockId ?? values.targetStock, '비활성화할 종목 ID'), {
        isListed: false,
      });
    }
    if (action === '종목 상장폐지') {
      requireConfirm(values.confirmText, '상장폐지');
      return adminApi.updateStockListingStatus(requiredId(values.stockId ?? values.targetStock, '상장폐지할 종목 ID'), {
        isListed: false,
      });
    }
  }

  if (section === 'ai') {
    if (action === 'AI 계정 추가') {
      return adminApi.createAiAccount({
        nickname: String(values.aiName || ''),
        strategyType: parseStrategy(values.profile),
        preferredMarketIds: optionalString(values.preferredMarketIds ?? values.favoriteMarket)
          ?.split(',')
          .map((id) => id.trim())
          .filter(Boolean),
        riskLevel: toNumber(values.riskLevel ?? values.riskLimit, 50),
        initialCash: optionalNumber(values.initialCash),
        isActive: values.active !== false,
      });
    }
    if (action === 'AI 투자 성향 리밸런싱') {
      return adminApi.runAiTrade(requiredId(values.aiAccountId ?? values.targetAi, 'AI 계정 ID'));
    }
    if (action === 'AI 계정 삭제') {
      requireConfirm(values.confirmText, 'AI 삭제');
      return adminApi.deleteAiAccount(requiredId(values.aiAccountId ?? values.targetAi, '삭제할 AI 계정 ID'));
    }
    if (action === 'AI 계정 수정') {
      return adminApi.updateAiAccount(requiredId(values.aiAccountId ?? values.targetAi, '수정할 AI 계정 ID'), {
        strategyType: parseStrategy(values.profile),
        riskLevel: optionalNumber(values.riskLevel ?? values.cashLimit),
        isActive: parseActiveState(values.activeState),
      });
    }
  }

  if (section === 'scenarios') {
    const body = buildScenarioBody(values);
    if (action === '메인 시나리오 생성 요청') return adminApi.generateMainScenario(body);
    if (action === 'BIG 시나리오 생성 요청') return adminApi.generateBigScenario(body);
    if (action === '소규모 시나리오 생성 요청') return adminApi.generateSmallScenario(body);
    if (action === '시나리오 적용') return adminApi.applyScenario(requiredId(values.scenarioId, '적용할 시나리오 ID'));
    if (action === '시나리오 적용 내역 확인') {
      if (values.scenarioId) return adminApi.applyScenario(String(values.scenarioId));
      return adminApi.getOpenAiStatus();
    }
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
    if (action === '랭킹 초기화') return adminApi.recalculateRankings();
    if (action === '유저 권한 변경') {
      return adminApi.updateUser(requiredId(values.userId ?? values.targetUser, '대상 유저 ID'), {
        role: parseRole(values.role),
        isActive: true,
      });
    }
    if (action === '유저 거래 제한') {
      return adminApi.updateUser(requiredId(values.userId ?? values.targetUser, '대상 유저 ID'), {
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
    if (values.newSeasonName || values.startsAt || values.endsAt) {
      return adminApi.createSeason({
        name: String(values.newSeasonName || values.seasonName || ''),
        startsAt: String(values.startsAt || new Date().toISOString()),
        endsAt: String(values.endsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
        initialCash: toNumber(values.initialCash, 1_000_000),
        status: 'UPCOMING',
      });
    }
  }

  return adminApi.getDashboard();
}

function buildScenarioBody(values: Record<string, string | boolean>): ScenarioGeneratePayload {
  return {
    prompt: optionalString(values.prompt ?? values.promptHint ?? values.theme),
    affectedMarketIds: optionalString(values.affectedMarketIds ?? values.targetMarket)
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    affectedStockIds: optionalString(values.affectedStockIds ?? values.targetStock)
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

function optionalString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function optionalNumber(value: unknown) {
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredId(value: unknown, label: string) {
  const id = optionalString(value);
  if (!id) throw new Error(`${label}를 입력해주세요.`);
  return id;
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

function parseStrategy(value: unknown): AdminAiPayload['strategyType'] {
  const text = String(value ?? '');
  if (text.includes('공격')) return 'AGGRESSIVE';
  if (text.includes('안정')) return 'STABLE';
  if (text.includes('집중')) return 'MARKET_FOCUSED';
  return 'RANDOM';
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
