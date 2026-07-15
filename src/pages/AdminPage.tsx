import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Coins,
  DatabaseZap,
  FilePlus2,
  LineChart,
  Minus,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Workflow,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '../components/Cards';
import {
  adminApi,
  type AdminStockCreationResult,
  type AdminMarketSimulationPayload,
  type AdminScenarioAutomationPayload,
  type SaveStockToSeedPayload,
} from '../services/adminApi';
import { ApiError, getErrorMessage } from '../services/apiClient';
import { enrichMarkets } from '../services/mappers';
import { useFandexStore } from '../store/useFandexStore';
import type { AdminSection } from '../types/admin';
import type {
  AdminDashboard,
  AdminAiAccount,
  DividendSchedule,
  Market,
  MarketSimulationRunResult,
  MarketSimulationSettings,
  RankingEntry,
  ScenarioApplyResult,
  ScenarioAutomationProcessResult,
  ScenarioAutomationRunResult,
  ScenarioAutomationSettings,
  ScenarioLog,
  SeasonInfo,
  SeasonResetResult,
  Stock,
} from '../types';
import { compact, currency, dateTime } from '../utils/format';
import { formatStockWithMarket } from '../utils/scenarioLabels';

interface AdminNavItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: ReactNode;
}

interface AdminActionField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'checkbox';
  placeholder?: string;
  options?: AdminSelectOption[];
  defaultValue?: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: number;
  maxItems?: number;
}

type AdminSelectOption = string | { label: string; value: string };

interface AdminActionOptions {
  marketOptions: AdminSelectOption[];
  stockOptions: AdminSelectOption[];
  aiOptions: AdminSelectOption[];
  userOptions: AdminSelectOption[];
  scenarioOptions: AdminSelectOption[];
}

interface AdminActionRequest {
  section: AdminSection;
  title: string;
  action: string;
  description: string;
  fields: AdminActionField[];
}

type ScenarioAutomationRunMode = 'MAIN' | 'SMALL' | 'DUE';

const adminNavItems: AdminNavItem[] = [
  { id: 'overview', label: '대시보드', description: '서비스 지표', icon: <BarChart3 size={18} /> },
  { id: 'season', label: '시즌 운영', description: '초기화/자금', icon: <CalendarClock size={18} /> },
  { id: 'markets', label: '장 관리', description: '시장 추가/수정', icon: <Building2 size={18} /> },
  { id: 'stocks', label: '종목 관리', description: '상장/비활성화', icon: <Coins size={18} /> },
  { id: 'ai', label: 'AI 계정', description: '성향/선호 장', icon: <Bot size={18} /> },
  { id: 'scenarios', label: '시나리오', description: 'GPT 생성/적용', icon: <Sparkles size={18} /> },
  { id: 'scenarioAutomation', label: 'GPT 자동 운영', description: '생성/자동 적용', icon: <Workflow size={18} /> },
  { id: 'simulation', label: '시장 시뮬레이션', description: '자동 가격 변동', icon: <Activity size={18} /> },
  { id: 'dividends', label: '배당 정책', description: '회복 시스템', icon: <WalletCards size={18} /> },
  { id: 'users', label: '유저 관리', description: '권한/랭킹', icon: <Users size={18} /> },
];

const userGrowthData = [
  { day: '7/01', users: 82, active: 61 },
  { day: '7/02', users: 96, active: 70 },
  { day: '7/03', users: 118, active: 83 },
  { day: '7/04', users: 142, active: 101 },
  { day: '7/05', users: 168, active: 124 },
  { day: '7/06', users: 187, active: 139 },
  { day: '7/07', users: 214, active: 158 },
];

const dividendPolicyData = [
  { tier: '1회', rate: 1.0 },
  { tier: '3회', rate: 1.25 },
  { tier: '5회', rate: 1.55 },
  { tier: '10회', rate: 2.1 },
];

const adminLogs = [
  { label: 'BIG 시나리오 생성', owner: 'admin', time: '2026-07-05T08:30:00Z', status: '완료' },
  { label: '캐릭터장 변동성 정책 수정', owner: 'admin', time: '2026-07-05T07:10:00Z', status: '완료' },
  { label: 'AI 계정 BETA 리밸런싱', owner: 'system', time: '2026-07-05T06:40:00Z', status: '대기' },
  { label: '배당금 지급 배치', owner: 'system', time: '2026-07-05T05:00:00Z', status: '완료' },
];

export function AdminPage() {
  const { markets, stocks, rankings, scenarios, transactions, season, dividendSchedule, updateDividendSchedule, notify, load } = useFandexStore();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [actionRequest, setActionRequest] = useState<AdminActionRequest | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard>();
  const [adminMarkets, setAdminMarkets] = useState<Market[]>([]);
  const [adminStocks, setAdminStocks] = useState<Stock[]>([]);
  const [adminAiAccounts, setAdminAiAccounts] = useState<AdminAiAccount[]>([]);
  const [marketSimulationSettings, setMarketSimulationSettings] = useState<MarketSimulationSettings>();
  const [marketSimulationResult, setMarketSimulationResult] = useState<MarketSimulationRunResult | null>(null);
  const [scenarioAutomationSettings, setScenarioAutomationSettings] = useState<ScenarioAutomationSettings>();
  const [scenarioAutomationResult, setScenarioAutomationResult] = useState<ScenarioAutomationProcessResult | null>(null);
  const [scenarioAutomationRunRequest, setScenarioAutomationRunRequest] = useState<ScenarioAutomationRunMode | null>(null);
  const [scenarioApplyResult, setScenarioApplyResult] = useState<ScenarioApplyResult | null>(null);
  const [seasonResetResult, setSeasonResetResult] = useState<SeasonResetResult | null>(null);
  const [seedStockRequest, setSeedStockRequest] = useState<Stock | null>(null);
  const [isSeedStockSaving, setIsSeedStockSaving] = useState(false);
  const [isSimulationSaving, setIsSimulationSaving] = useState(false);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [isAutomationSaving, setIsAutomationSaving] = useState(false);
  const [automationRunningMode, setAutomationRunningMode] = useState<ScenarioAutomationRunMode | null>(null);
  const [isAdminDataLoading, setIsAdminDataLoading] = useState(false);
  const adminMarketsForView = adminMarkets.length ? adminMarkets : markets;
  const adminStocksForView = adminStocks.length ? adminStocks : stocks;
  const totalCap = adminDashboard?.totalMarketCap ?? adminMarketsForView.reduce((sum, market) => sum + market.marketCap, 0);
  const totalVolume = adminDashboard?.dailyTradeVolume ?? adminMarketsForView.reduce((sum, market) => sum + market.volume, 0);
  const users = useMemo(() => rankings.filter((entry) => entry.role !== 'ai'), [rankings]);
  const aiAccounts = adminAiAccounts;
  const activeDividendStocks = adminStocksForView.filter((stock) => stock.dividendEnabled);

  const refreshAdminData = useCallback(async (silent = false) => {
    setIsAdminDataLoading(true);
    try {
      const [dashboard, marketsData, stocksData, settingsData, simulationData, aiData, automationData] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getMarkets({ includeInactive: true }),
        adminApi.getStocks({ includeUnlisted: true }),
        adminApi.getDividendSettings(),
        adminApi.getMarketSimulationSettings(),
        adminApi.getAiAccounts(),
        adminApi.getScenarioAutomationSettings(),
      ]);
      setAdminDashboard(dashboard);
      setAdminMarkets(enrichMarkets(marketsData, stocksData));
      setAdminStocks(stocksData);
      setAdminAiAccounts(aiData);
      setMarketSimulationSettings(simulationData);
      setScenarioAutomationSettings(automationData);
      updateDividendSchedule(settingsData);
      if (!silent) notify('관리자 데이터가 새로고침되었습니다.');
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : '관리자 데이터 새로고침에 실패했습니다.');
    } finally {
      setIsAdminDataLoading(false);
    }
  }, [notify, updateDividendSchedule]);

  useEffect(() => {
    void refreshAdminData(true);
  }, [refreshAdminData]);

  const accountTypeData = useMemo(
    () => [
      { name: '사용자', value: adminDashboard?.totalUsers ?? users.length, color: '#38d5ff' },
      { name: 'AI', value: adminDashboard?.aiAccountCount ?? aiAccounts.length, color: '#7c5cff' },
      { name: '관리자', value: rankings.filter((entry) => entry.role === 'admin').length, color: '#42e3a3' },
    ],
    [adminDashboard, aiAccounts.length, rankings, users.length],
  );

  const marketCapData = adminDashboard?.marketVolumeSeries.length
    ? adminDashboard.marketVolumeSeries.map((market) => ({
      name: market.marketName.replace('장', ''),
      marketCap: adminStocksForView
        .filter((stock) => stock.marketId === market.marketId)
        .reduce((sum, stock) => sum + stock.marketCap, 0),
      volume: market.tradeVolume,
      tradeCount: market.tradeCount,
    }))
    : adminMarketsForView.map((market) => ({
      name: market.name.replace('장', ''),
      marketCap: market.marketCap,
      volume: market.volume,
      tradeCount: 0,
    }));
  const actionOptions = useMemo<AdminActionOptions>(
    () => ({
      marketOptions: buildMarketOptions(adminMarketsForView),
      stockOptions: buildStockOptions(adminStocksForView, adminMarketsForView),
      aiOptions: buildAiOptions(aiAccounts),
      userOptions: buildUserOptions(rankings),
      scenarioOptions: buildScenarioOptions(scenarios),
    }),
    [adminMarketsForView, adminStocksForView, aiAccounts, rankings, scenarios],
  );
  const buildCurrentActionRequest = useCallback((section: AdminSection, action: string) => {
    const request = createAdminActionRequest(section, action, actionOptions);
    if (section === 'season' && action === '시즌 초기화' && season?.id) {
      request.fields = request.fields.map((field) =>
        field.name === 'seasonId' ? { ...field, defaultValue: season.id, placeholder: season.id } : field,
      );
    }
    return request;
  }, [actionOptions, season?.id]);

  useEffect(() => {
    setActionRequest((current) => (
      current ? buildCurrentActionRequest(current.section, current.action) : current
    ));
  }, [buildCurrentActionRequest]);

  const openActionRequest = (action: string) => {
    setActionRequest(buildCurrentActionRequest(activeSection, action));
  };
  const submitActionRequest = async (values: Record<string, string | boolean>) => {
    if (!actionRequest) return;
    setIsSubmittingAction(true);
    try {
      const result = await adminApi.submitAction({
        section: actionRequest.section,
        action: actionRequest.action,
        values,
        requestedAt: new Date().toISOString(),
      });
      if (actionRequest.section === 'dividends') {
        const schedulePatch = buildDividendSchedulePatch(actionRequest.action, values);
        if (Object.keys(schedulePatch).length) {
          updateDividendSchedule(schedulePatch);
        }
      }
      if (actionRequest.section === 'scenarios' && hasScenarioApplyResult(result.data)) {
        setScenarioApplyResult(result.data);
      }
      if (actionRequest.section === 'season' && actionRequest.action === '시즌 초기화' && hasSeasonResetResult(result.data)) {
        setSeasonResetResult(result.data);
        notify(
          `시즌 초기화 완료 · 파일 기본 종목 ${result.data.seedStocksApplied}개, 관리자 기본 종목 ${result.data.adminSeedStocksRestored}개 복원`,
        );
        const refreshResults = await Promise.allSettled([load(), refreshAdminData(true), adminApi.getSeasons()]);
        if (refreshResults.some((item) => item.status === 'rejected')) {
          notify('초기화는 완료됐지만 일부 데이터 새로고침에 실패했습니다. 새로고침을 눌러주세요.');
        }
        setActionRequest(null);
        return;
      }
      if (actionRequest.section === 'stocks' && actionRequest.action === '새 종목 상장' && hasAdminStockCreationResult(result.data)) {
        const creationResult = result.data;
        setAdminStocks((current) => upsertStock(current, creationResult.stock));
        if (creationResult.seedSaved === false) {
          notify(`상장은 완료됐지만 기본 종목 저장에 실패했습니다. ${creationResult.seedSaveError ?? '종목 목록에서 다시 시도해주세요.'}`);
        } else if (creationResult.seedSaved) {
          notify(`${creationResult.stock.name} 상장 및 기본 카탈로그 저장이 완료되었습니다.`);
        } else {
          notify(`${creationResult.stock.name} 종목이 상장되었습니다.`);
        }
        await Promise.allSettled([load(), refreshAdminData(true)]);
        setActionRequest(null);
        return;
      }
      notify(`${actionRequest.action} 요청이 접수되었습니다. (${result.requestId})`);
      await Promise.all([load(), refreshAdminData(true)]);
      setActionRequest(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '관리자 요청 처리에 실패했습니다.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const saveStockToSeed = async (stock: Stock, body: SaveStockToSeedPayload) => {
    setIsSeedStockSaving(true);
    try {
      const updated = await adminApi.saveStockToSeed(stock.id, body);
      setAdminStocks((current) => upsertStock(current, updated));
      notify(`${updated.name}을(를) 관리자 기본 종목으로 저장했습니다.`);
      setSeedStockRequest(null);
      const refreshResults = await Promise.allSettled([load(), refreshAdminData(true)]);
      if (refreshResults.some((item) => item.status === 'rejected')) {
        notify('기본 종목 저장은 완료됐지만 일부 목록 새로고침에 실패했습니다.');
      }
      return null;
    } catch (error) {
      const message = formatStockSeedError(error);
      notify(message);
      if (error instanceof ApiError && error.status === 404) {
        await refreshAdminData(true);
      }
      return message;
    } finally {
      setIsSeedStockSaving(false);
    }
  };

  const saveMarketSimulationSettings = async (values: AdminMarketSimulationPayload) => {
    setIsSimulationSaving(true);
    try {
      const updated = await adminApi.updateMarketSimulationSettings(values);
      setMarketSimulationSettings(updated);
      notify(updated.isEnabled ? '자동 가격 변동 설정이 활성화되었습니다.' : '자동 가격 변동 설정이 저장되었습니다.');
      await refreshAdminData(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : '시장 시뮬레이션 설정 저장에 실패했습니다.');
    } finally {
      setIsSimulationSaving(false);
    }
  };

  const runMarketSimulation = async () => {
    setIsSimulationRunning(true);
    try {
      const result = await adminApi.runMarketSimulation();
      setMarketSimulationResult(result);
      notify(`시장 시뮬레이션 실행 완료 · ${result.affectedCount.toLocaleString('ko-KR')}개 종목 변동`);
      const refreshResults = await Promise.allSettled([load(), refreshAdminData(true)]);
      if (refreshResults.some((item) => item.status === 'rejected')) {
        notify('시뮬레이션은 완료됐지만 일부 데이터 새로고침에 실패했습니다. 새로고침을 눌러주세요.');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : '시장 시뮬레이션 실행에 실패했습니다.');
    } finally {
      setIsSimulationRunning(false);
    }
  };

  const saveScenarioAutomationSettings = async (values: AdminScenarioAutomationPayload) => {
    setIsAutomationSaving(true);
    try {
      const updated = await adminApi.updateScenarioAutomationSettings(values);
      setScenarioAutomationSettings(updated);
      notify(updated.isEnabled ? 'GPT 시나리오 자동 운영 설정이 활성화되었습니다.' : 'GPT 시나리오 자동 운영 설정이 저장되었습니다.');
      await refreshAdminData(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'GPT 자동 운영 설정 저장에 실패했습니다.');
    } finally {
      setIsAutomationSaving(false);
    }
  };

  const runScenarioAutomation = async (mode: ScenarioAutomationRunMode) => {
    setScenarioAutomationRunRequest(null);
    setAutomationRunningMode(mode);
    try {
      const result = mode === 'DUE'
        ? await adminApi.runDueScenarioAutomation()
        : wrapScenarioAutomationRunResult(
          mode === 'MAIN'
            ? await adminApi.runMainScenarioAutomation()
            : await adminApi.runSmallScenarioAutomation(),
        );
      setScenarioAutomationResult(result);
      const status = result.results[0]?.status ?? result.status;
      notify(`GPT 자동 운영 실행 결과 · ${formatAutomationStatus(status)}`);
      const refreshResults = await Promise.allSettled([load(), refreshAdminData(true)]);
      if (refreshResults.some((item) => item.status === 'rejected')) {
        notify('자동 운영 실행은 완료됐지만 일부 데이터 새로고침에 실패했습니다.');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'GPT 자동 운영 실행에 실패했습니다.');
    } finally {
      setAutomationRunningMode(null);
    }
  };

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <span className="eyebrow">Admin Console</span>
          <h1>운영 센터</h1>
          <p>{season?.name} · DAY {season?.day}</p>
          {season?.id && <code className="admin-season-id">Season ID: {season.id}</code>}
        </div>
        <nav className="admin-sidebar-nav" aria-label="관리자 메뉴">
          {adminNavItems.map((item) => (
            <button
              key={item.id}
              className={activeSection === item.id ? 'active' : ''}
              onClick={() => setActiveSection(item.id)}
            >
              {item.icon}
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <strong>{currency(totalCap)}</strong>
          <span>서비스 시가총액</span>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-content-header">
          <div>
            <span className="eyebrow">{adminNavItems.find((item) => item.id === activeSection)?.description}</span>
            <h1>{adminNavItems.find((item) => item.id === activeSection)?.label}</h1>
          </div>
          <div className="admin-header-actions">
            <button
              className="secondary-button"
              onClick={() => void refreshAdminData()}
              disabled={isAdminDataLoading}
            >
              <RefreshCw size={17} /> {isAdminDataLoading ? '동기화 중' : '새로고침'}
            </button>
            <button className="primary-button" onClick={() => notify('운영 변경 사항이 저장되었습니다.')}>
              <ShieldCheck size={17} /> 변경 저장
            </button>
          </div>
        </header>

        {activeSection === 'overview' && (
          <OverviewSection
            totalCap={totalCap}
            totalVolume={totalVolume}
            userCount={adminDashboard?.totalUsers ?? users.length}
            activeUsers={adminDashboard?.activeUsers ?? users.length}
            aiCount={adminDashboard?.aiAccountCount ?? aiAccounts.length}
            stockCount={adminDashboard?.stockCount ?? adminStocksForView.length}
            activeMarketCount={adminDashboard?.marketCount ?? adminMarketsForView.filter((market) => market.active).length}
            accountTypeData={accountTypeData}
            marketCapData={marketCapData}
            userGrowthData={buildAdminUserGrowth(adminDashboard)}
          />
        )}
        {activeSection === 'season' && (
          <SeasonSection
            season={season}
            totalUsers={users.length}
            totalVolume={totalVolume}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'markets' && (
          <MarketsSection
            rows={adminMarketsForView.map((market) => [
              market.name,
              `${market.stockCount}개`,
              currency(market.marketCap),
              compact(market.volume),
              market.active ? '활성' : '비활성',
            ])}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'stocks' && (
          <StocksSection
            stocks={adminStocksForView}
            markets={adminMarketsForView}
            onAction={openActionRequest}
            onSeedAction={setSeedStockRequest}
          />
        )}
        {activeSection === 'ai' && (
          <AiSection
            aiAccounts={aiAccounts}
            markets={adminMarketsForView}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'scenarios' && (
          <ScenarioSection
            scenarioCount={scenarios.length}
            rows={scenarios.map((scenario) => [
              scenario.title,
              scenario.type.toUpperCase(),
              scenario.direction === 'up' ? '상승' : scenario.direction === 'down' ? '하락' : '보합',
              `${scenario.strength}`,
              dateTime(scenario.occurredAt),
            ])}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'simulation' && (
          <MarketSimulationSection
            settings={marketSimulationSettings}
            listedStockCount={adminStocksForView.filter((stock) => stock.status === 'LISTED' || stock.active).length}
            isSaving={isSimulationSaving}
            isRunning={isSimulationRunning}
            onSave={saveMarketSimulationSettings}
            onRun={runMarketSimulation}
          />
        )}
        {activeSection === 'scenarioAutomation' && (
          <ScenarioAutomationSection
            settings={scenarioAutomationSettings}
            isSaving={isAutomationSaving}
            runningMode={automationRunningMode}
            onSave={saveScenarioAutomationSettings}
            onRequestRun={setScenarioAutomationRunRequest}
          />
        )}
        {activeSection === 'dividends' && (
          <DividendSection
            schedule={dividendSchedule}
            dividendStockCount={activeDividendStocks.length}
            dividendTotal={transactions.filter((tx) => tx.type === 'dividend').reduce((sum, tx) => sum + tx.total, 0)}
            onAction={openActionRequest}
            onRunNow={async () => {
              try {
                await adminApi.runDividendSettings();
                notify('배당 즉시 실행 요청이 완료되었습니다.');
                await Promise.all([load(), refreshAdminData(true)]);
              } catch (error) {
                notify(error instanceof Error ? error.message : '배당 즉시 실행에 실패했습니다.');
              }
            }}
            onToggleAuto={async (enabled) => {
              try {
                const updated = await adminApi.updateDividendSettings({ isEnabled: enabled });
                updateDividendSchedule(updated);
                notify(enabled ? '자동 배당 지급을 활성화했습니다.' : '자동 배당 지급을 일시정지했습니다.');
                await refreshAdminData(true);
              } catch (error) {
                notify(error instanceof Error ? error.message : '자동 배당 설정 변경에 실패했습니다.');
              }
            }}
          />
        )}
        {activeSection === 'users' && (
          <UsersSection
            rows={rankings.map((entry) => [
              entry.name,
              entry.role === 'ai' ? 'AI' : entry.role === 'admin' ? '관리자' : '사용자',
              `#${entry.rank}`,
              currency(entry.totalAssets),
              `${entry.returnRate.toFixed(1)}%`,
            ])}
            onAction={openActionRequest}
          />
        )}
      </section>
      {actionRequest && (
        <AdminActionModal
          request={actionRequest}
          isSubmitting={isSubmittingAction}
          onClose={() => setActionRequest(null)}
          onSubmit={submitActionRequest}
        />
      )}
      {scenarioApplyResult && (
        <ScenarioApplyResultModal
          result={scenarioApplyResult}
          stocks={adminStocksForView}
          markets={adminMarketsForView}
          onClose={() => setScenarioApplyResult(null)}
        />
      )}
      {marketSimulationResult && (
        <MarketSimulationResultModal
          result={marketSimulationResult}
          stocks={adminStocksForView}
          markets={adminMarketsForView}
          onClose={() => setMarketSimulationResult(null)}
        />
      )}
      {seasonResetResult && (
        <SeasonResetResultModal result={seasonResetResult} onClose={() => setSeasonResetResult(null)} />
      )}
      {seedStockRequest && (
        <StockSeedModal
          stock={seedStockRequest}
          marketName={seedStockRequest.market?.name ?? adminMarketsForView.find((market) => market.id === seedStockRequest.marketId)?.name}
          isSubmitting={isSeedStockSaving}
          onClose={() => setSeedStockRequest(null)}
          onSubmit={(body) => saveStockToSeed(seedStockRequest, body)}
        />
      )}
      {scenarioAutomationRunRequest && (
        <ScenarioAutomationConfirmModal
          mode={scenarioAutomationRunRequest}
          autoApply={scenarioAutomationSettings?.autoApply ?? false}
          onClose={() => setScenarioAutomationRunRequest(null)}
          onConfirm={() => void runScenarioAutomation(scenarioAutomationRunRequest)}
        />
      )}
      {scenarioAutomationResult && (
        <ScenarioAutomationResultModal
          result={scenarioAutomationResult}
          onClose={() => setScenarioAutomationResult(null)}
        />
      )}
    </div>
  );
}

function OverviewSection({
  totalCap,
  totalVolume,
  userCount,
  activeUsers,
  aiCount,
  stockCount,
  activeMarketCount,
  accountTypeData,
  marketCapData,
  userGrowthData,
}: {
  totalCap: number;
  totalVolume: number;
  userCount: number;
  activeUsers: number;
  aiCount: number;
  stockCount: number;
  activeMarketCount: number;
  accountTypeData: Array<{ name: string; value: number; color: string }>;
  marketCapData: Array<{ name: string; marketCap: number; volume: number; tradeCount?: number }>;
  userGrowthData: Array<{ day: string; users: number; active: number }>;
}) {
  return (
    <>
      <section className="admin-kpi-grid">
        <StatCard label="전체 유저" value={`${userCount}명`} hint={`AI ${aiCount}개 별도 운영`} />
        <StatCard label="활성 유저" value={`${activeUsers}명`} hint="관리자 대시보드 기준" />
        <StatCard label="상장 종목" value={`${stockCount}개`} hint={`${activeMarketCount}개 장 활성`} />
        <StatCard label="서비스 시가총액" value={currency(totalCap)} />
        <StatCard label="오늘 거래량" value={compact(totalVolume)} />
      </section>
      <section className="admin-dashboard-grid">
        <article className="panel admin-chart-panel wide">
          <div className="panel-title"><Users size={20} /><h2>유저 수 추이</h2></div>
          <ResponsiveContainer width="100%" height={290}>
            <AreaChart data={userGrowthData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="usersGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#38d5ff" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#38d5ff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="activeUsersGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="users" name="누적 유저" stroke="#38d5ff" fill="url(#usersGradient)" strokeWidth={3} />
              <Area type="monotone" dataKey="active" name="활성 유저" stroke="#7c5cff" fill="url(#activeUsersGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </article>
        <article className="panel admin-chart-panel">
          <div className="panel-title"><Trophy size={20} /><h2>계정 구성</h2></div>
          <ResponsiveContainer width="100%" height={290}>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Pie data={accountTypeData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {accountTypeData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="admin-legend">
            {accountTypeData.map((entry) => (
              <span key={entry.name}><i style={{ background: entry.color }} />{entry.name} {entry.value}</span>
            ))}
          </div>
        </article>
      </section>
      <section className="admin-dashboard-grid">
        <article className="panel admin-chart-panel wide">
          <div className="panel-title"><LineChart size={20} /><h2>장별 시가총액 / 거래량</h2></div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={marketCapData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip formatter={(value, name) => [name === 'marketCap' ? currency(Number(value)) : compact(Number(value)), name === 'marketCap' ? '시가총액' : name === 'tradeCount' ? '거래 건수' : '거래량']} contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="marketCap" fill="#7c5cff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="volume" fill="#38d5ff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="tradeCount" fill="#42e3a3" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <OperationLog />
      </section>
    </>
  );
}

function SeasonSection({
  season,
  totalUsers,
  totalVolume,
  onAction,
}: {
  season?: SeasonInfo;
  totalUsers: number;
  totalVolume: number;
  onAction: (message: string) => void;
}) {
  return (
    <AdminWorkArea
      summary={[
        ['시즌 상태', season?.status ?? '진행 중'],
        ['현재 시즌 ID', season?.id ?? '-'],
        ['지급 대상', `${totalUsers}명`],
        ['오늘 거래량', compact(totalVolume)],
      ]}
      actions={['새 시즌 생성', '시즌 초기화']}
      onAction={onAction}
      formTitle="시즌 운영 설정"
      fields={['시즌명', '시작일', '종료일', '사용자 초기 자금', '랭킹 집계 기준']}
    />
  );
}

function MarketsSection({ rows, onAction }: { rows: Array<Array<ReactNode>>; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['활성 장', `${rows.length}개`],
        ['관리 상태', '정상'],
        ['정렬 정책', '수동'],
      ]}
      actions={['새 장/시장 추가', '장/시장 수정', '장/시장 비활성화', '장/시장 삭제']}
      onAction={onAction}
      formTitle="장 추가 / 수정"
      fields={['장 이름', '장 설명', '아이콘', '정렬 순서']}
      table={{ columns: ['장 이름', '종목 수', '시가총액', '거래량', '상태'], rows }}
    />
  );
}

function StocksSection({
  stocks,
  markets,
  onAction,
  onSeedAction,
}: {
  stocks: Stock[];
  markets: Market[];
  onAction: (message: string) => void;
  onSeedAction: (stock: Stock) => void;
}) {
  const listedCount = stocks.filter((stock) => stock.status === 'LISTED' || stock.active).length;
  const dividendCount = stocks.filter((stock) => stock.dividendEnabled).length;
  const seedStockCount = stocks.filter((stock) => stock.seedSource !== null).length;

  return (
    <>
      <section className="panel admin-stock-control-panel">
        <div className="admin-stock-control-head">
          <div className="panel-title"><Coins size={20} /><h2>종목 운영 현황</h2></div>
          <span>비상장 종목을 포함한 전체 카탈로그</span>
        </div>
        <div className="admin-stock-kpi-grid">
          <SummaryItem label="전체 종목" value={`${stocks.length}개`} />
          <SummaryItem label="상장 종목" value={`${listedCount}개`} />
          <SummaryItem label="배당 종목" value={`${dividendCount}개`} />
          <SummaryItem label="기본 종목" value={`${seedStockCount}개`} />
        </div>
        <ActionGrid actions={['새 종목 상장', '종목 수정', '종목 비활성화', '종목 상장폐지']} onAction={onAction} />
      </section>

      <section className="panel admin-stock-list-panel">
        <div className="admin-stock-list-head">
          <div className="panel-title"><DatabaseZap size={20} /><h2>종목 목록</h2></div>
          <span>{stocks.length.toLocaleString('ko-KR')}개</span>
        </div>
        <div className="admin-stock-list">
          {stocks.length ? stocks.map((stock) => {
            const marketName = stock.market?.name ?? markets.find((market) => market.id === stock.marketId)?.name ?? '소속 장 없음';
            return (
              <article className="admin-stock-item" key={stock.id}>
                <div className="admin-stock-identity">
                  <img
                    src={stock.imageUrl}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = '/assets/v-fandex-logo.svg';
                      event.currentTarget.classList.add('fallback');
                    }}
                  />
                  <div>
                    <strong>{stock.name}</strong>
                    <span>{marketName} · {stock.symbol}</span>
                    {stock.tags.length > 0 && <small>{stock.tags.slice(0, 2).join(' · ')}</small>}
                  </div>
                </div>

                <div className="admin-stock-metrics">
                  <span><small>현재가</small><strong>{currency(stock.price)}</strong></span>
                  <span><small>거래량</small><strong>{compact(stock.volume)}</strong></span>
                  <span><small>거래대금</small><strong>{currency(stock.tradeValue)}</strong></span>
                </div>

                <div className="admin-stock-operation-state">
                  <span className={`admin-stock-status ${stock.status.toLowerCase()}`}>{formatStockStatus(stock.status)}</span>
                  <span className={stock.dividendEnabled ? 'admin-stock-dividend active' : 'admin-stock-dividend'}>
                    {stock.dividendEnabled ? '배당 가능' : '배당 미지원'}
                  </span>
                </div>

                <div className="admin-stock-seed-control">
                  <SeedSourceStatus stock={stock} />
                  {stock.seedSource === 'FILE' ? (
                    <span className="seed-file-lock">파일에서 관리</span>
                  ) : (
                    <button className="table-command-button" type="button" onClick={() => onSeedAction(stock)}>
                      <DatabaseZap size={14} />
                      {stock.seedSource === 'ADMIN' ? '기본 설정 수정' : '기본 종목으로 저장'}
                    </button>
                  )}
                </div>
              </article>
            );
          }) : (
            <div className="empty-state">서버에서 종목 목록을 불러오지 못했습니다.</div>
          )}
        </div>
      </section>
    </>
  );
}

function AiSection({
  aiAccounts,
  markets,
  onAction,
}: {
  aiAccounts: AdminAiAccount[];
  markets: Market[];
  onAction: (message: string) => void;
}) {
  const activeCount = aiAccounts.filter((account) => account.isActive).length;
  const averageRisk = aiAccounts.reduce((sum, account) => sum + account.riskLevel, 0) / Math.max(aiAccounts.length, 1);
  return (
    <AdminWorkArea
      summary={[
        ['AI 계정', `${aiAccounts.length}개`],
        ['활성 계정', `${activeCount}개`],
        ['평균 위험도', `${averageRisk.toFixed(1)} / 10`],
      ]}
      actions={['AI 계정 추가', 'AI 계정 수정', 'AI 계정 비활성화', 'AI 투자 성향 리밸런싱']}
      onAction={onAction}
      formTitle="AI 계정 추가"
      fields={['AI 계정 이름', '투자 성향', '선호 장', '위험도 (1~10)', '초기 자금']}
      table={{
        columns: ['AI 계정', '투자 성향', '선호 장', '위험도', '현금', '총 자산', '상태'],
        rows: aiAccounts.map((account) => [
          account.nickname,
          formatAiStrategy(account.strategyType),
          account.preferredMarketIds.length
            ? account.preferredMarketIds.map((id) => markets.find((market) => market.id === id)?.name ?? '삭제된 장').join(', ')
            : '전체 시장',
          `${account.riskLevel} / 10`,
          currency(account.cash),
          currency(account.totalAssetValue),
          account.isActive ? '활성' : '비활성',
        ]),
      }}
    />
  );
}

function ScenarioSection({ scenarioCount, rows, onAction }: { scenarioCount: number; rows: Array<Array<ReactNode>>; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['생성 로그', `${scenarioCount}건`],
        ['BIG 영향도', '82'],
        ['자동 적용', '활성'],
      ]}
      actions={['메인 시나리오 생성 요청', 'BIG 시나리오 생성 요청', '소규모 시나리오 생성 요청', '시나리오 적용']}
      onAction={onAction}
      formTitle="시나리오 생성 조건"
      fields={['시나리오 유형', '영향 장', '영향 종목', '변동 방향', '변동 강도']}
      table={{ columns: ['제목', '유형', '방향', '강도', '발생 시간'], rows }}
    />
  );
}

interface SimulationFormState {
  isEnabled: boolean;
  intervalMinutes: string;
  randomIntervalEnabled: boolean;
  minIntervalMinutes: string;
  maxIntervalMinutes: string;
  minChangeRate: string;
  maxChangeRate: string;
  extremeMinRate: string;
  extremeMaxRate: string;
  extremeChance: string;
  volatilityWeight: string;
  targetStockCount: string;
  nextRunAt: string;
}

function MarketSimulationSection({
  settings,
  listedStockCount,
  isSaving,
  isRunning,
  onSave,
  onRun,
}: {
  settings?: MarketSimulationSettings;
  listedStockCount: number;
  isSaving: boolean;
  isRunning: boolean;
  onSave: (values: AdminMarketSimulationPayload) => void | Promise<void>;
  onRun: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<SimulationFormState>(() => buildSimulationFormState(settings));

  useEffect(() => {
    setForm(buildSimulationFormState(settings));
  }, [settings]);

  const setField = (name: keyof SimulationFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const minInterval = Number(form.minIntervalMinutes);
  const maxInterval = Number(form.maxIntervalMinutes);
  const randomIntervalInvalid = form.randomIntervalEnabled && (
    !Number.isFinite(minInterval)
    || !Number.isFinite(maxInterval)
    || minInterval < 1
    || maxInterval > 1440
    || minInterval > maxInterval
  );

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextRunAt = form.nextRunAt ? new Date(form.nextRunAt).toISOString() : undefined;
    const targetStockCountValue = Number(form.targetStockCount);
    const targetStockCount = form.targetStockCount.trim() && Number.isFinite(targetStockCountValue)
      ? Math.max(1, Math.trunc(targetStockCountValue))
      : undefined;
    void onSave({
      isEnabled: form.isEnabled,
      randomIntervalEnabled: form.randomIntervalEnabled,
      ...(form.randomIntervalEnabled
        ? {
          minIntervalMinutes: clamp(Math.trunc(safeNumber(form.minIntervalMinutes, 5)), 1, 1440),
          maxIntervalMinutes: clamp(Math.trunc(safeNumber(form.maxIntervalMinutes, 15)), 1, 1440),
        }
        : { intervalMinutes: clamp(Math.trunc(safeNumber(form.intervalMinutes, 5)), 1, 1440) }),
      minChangeRate: safeNumber(form.minChangeRate, -7),
      maxChangeRate: safeNumber(form.maxChangeRate, 7),
      extremeMinRate: safeNumber(form.extremeMinRate, -80),
      extremeMaxRate: safeNumber(form.extremeMaxRate, 300),
      extremeChance: clamp(safeNumber(form.extremeChance, 0.04), 0, 1),
      volatilityWeight: Math.max(0, safeNumber(form.volatilityWeight, 1)),
      ...(targetStockCount ? { targetStockCount } : {}),
      ...(nextRunAt ? { nextRunAt } : {}),
    });
  };

  return (
    <section className="simulation-grid">
      <form className="panel simulation-control-panel" onSubmit={submitSettings}>
        <div className="panel-title">
          <Activity size={20} />
          <h2>자동 가격 변동 설정</h2>
        </div>

        <label className={form.isEnabled ? 'simulation-toggle active' : 'simulation-toggle'}>
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(event) => setField('isEnabled', event.target.checked)}
          />
          <span className="simulation-toggle-track"><i /></span>
          <span>
            <strong>{form.isEnabled ? '자동 실행 ON' : '자동 실행 OFF'}</strong>
            <small>설정된 주기마다 시장 가격을 자동으로 변동합니다.</small>
          </span>
        </label>

        <label className={form.randomIntervalEnabled ? 'simulation-toggle active' : 'simulation-toggle'}>
          <input
            type="checkbox"
            checked={form.randomIntervalEnabled}
            onChange={(event) => setField('randomIntervalEnabled', event.target.checked)}
          />
          <span className="simulation-toggle-track"><i /></span>
          <span>
            <strong>{form.randomIntervalEnabled ? '랜덤 주기 ON' : '고정 주기 사용'}</strong>
            <small>최소/최대 범위 안에서 다음 실행 주기를 매번 새로 정합니다.</small>
          </span>
        </label>

        <div className="simulation-form-grid">
          {form.randomIntervalEnabled ? (
            <>
              <SimulationNumberField
                label="최소 실행 주기(분)"
                value={form.minIntervalMinutes}
                min={1}
                max={1440}
                step={1}
                onChange={(value) => setField('minIntervalMinutes', value)}
              />
              <SimulationNumberField
                label="최대 실행 주기(분)"
                value={form.maxIntervalMinutes}
                min={1}
                max={1440}
                step={1}
                onChange={(value) => setField('maxIntervalMinutes', value)}
              />
            </>
          ) : (
            <SimulationNumberField
              label="고정 실행 주기(분)"
              value={form.intervalMinutes}
              min={1}
              max={1440}
              step={1}
              onChange={(value) => setField('intervalMinutes', value)}
            />
          )}
          <SimulationNumberField
            label="변동성 가중치"
            value={form.volatilityWeight}
            min={0}
            step={0.1}
            onChange={(value) => setField('volatilityWeight', value)}
          />
          <SimulationNumberField
            label="일반 변동률 최소(%)"
            value={form.minChangeRate}
            step={0.1}
            onChange={(value) => setField('minChangeRate', value)}
          />
          <SimulationNumberField
            label="일반 변동률 최대(%)"
            value={form.maxChangeRate}
            step={0.1}
            onChange={(value) => setField('maxChangeRate', value)}
          />
          <SimulationNumberField
            label="극단 변동률 최소(%)"
            value={form.extremeMinRate}
            step={1}
            onChange={(value) => setField('extremeMinRate', value)}
          />
          <SimulationNumberField
            label="극단 변동률 최대(%)"
            value={form.extremeMaxRate}
            step={1}
            onChange={(value) => setField('extremeMaxRate', value)}
          />
          <SimulationNumberField
            label="대상 종목 수"
            value={form.targetStockCount}
            min={1}
            step={1}
            placeholder="전체 상장 종목"
            required={false}
            onChange={(value) => setField('targetStockCount', value)}
          />
          <label className="field simulation-field">
            <span>다음 자동 실행 시각</span>
            <input
              type="datetime-local"
              value={form.nextRunAt}
              onChange={(event) => setField('nextRunAt', event.target.value)}
            />
          </label>
        </div>

        <label className="field simulation-field wide">
          <span>극단 변동 확률</span>
          <div className="simulation-slider-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={form.extremeChance}
              onChange={(event) => setField('extremeChance', event.target.value)}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.extremeChance}
              onChange={(event) => setField('extremeChance', event.target.value)}
              aria-label="극단 변동 확률 숫자 입력"
            />
          </div>
        </label>

        {randomIntervalInvalid && (
          <p className="simulation-validation-error">최소 실행 주기는 최대 실행 주기보다 클 수 없습니다.</p>
        )}

        <p className="simulation-note">서버가 깨어 있을 때 자동 실행됩니다. Render Free 환경에서는 sleep 상태일 때 스케줄러가 잠시 멈출 수 있습니다.</p>

        <div className="simulation-actions">
          <button className="secondary-button" type="button" onClick={() => void onRun()} disabled={isRunning || isSaving}>
            <RefreshCw size={17} /> {isRunning ? '실행 중' : '수동 실행'}
          </button>
          <button className="primary-button" type="submit" disabled={isSaving || isRunning || randomIntervalInvalid}>
            <ShieldCheck size={17} /> {isSaving ? '저장 중' : '설정 저장'}
          </button>
        </div>
      </form>

      <article className="panel simulation-status-panel">
        <div className="panel-title">
          <LineChart size={20} />
          <h2>실행 상태</h2>
        </div>
        <div className="admin-summary-list">
          <SummaryItem label="자동 실행" value={settings?.isEnabled ? '활성' : '비활성'} />
          <SummaryItem
            label="실행 주기"
            value={settings?.randomIntervalEnabled
              ? `랜덤 ${settings.minIntervalMinutes}~${settings.maxIntervalMinutes}분`
              : `고정 ${settings?.intervalMinutes ?? 5}분`}
          />
          <SummaryItem label="일반 변동 범위" value={`${settings?.minChangeRate ?? -7}% ~ ${settings?.maxChangeRate ?? 7}%`} />
          <SummaryItem label="극단 변동 범위" value={`${settings?.extremeMinRate ?? -80}% ~ ${settings?.extremeMaxRate ?? 300}%`} />
          <SummaryItem label="극단 확률" value={`${((settings?.extremeChance ?? 0.04) * 100).toFixed(1)}%`} />
          <SummaryItem label="대상 종목" value={settings?.targetStockCount ? `${settings.targetStockCount}개` : `전체 ${listedStockCount}개`} />
          <SummaryItem label="최근 실행" value={settings?.lastRunAt ? dateTime(settings.lastRunAt) : '-'} />
          <SummaryItem label="다음 실행" value={settings?.nextRunAt ? dateTime(settings.nextRunAt) : '-'} />
        </div>
      </article>
    </section>
  );
}

function SimulationNumberField({
  label,
  value,
  min,
  max,
  step,
  placeholder,
  required = true,
  onChange,
}: {
  label: string;
  value: string;
  min?: number;
  max?: number;
  step: number;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field simulation-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface ScenarioAutomationFormState {
  isEnabled: boolean;
  mainEnabled: boolean;
  smallEnabled: boolean;
  autoApply: boolean;
  mainMinIntervalHours: string;
  mainMaxIntervalHours: string;
  smallMinIntervalMinutes: string;
  smallMaxIntervalMinutes: string;
  dailyMainLimit: string;
  dailySmallLimit: string;
  retryDelayMinutes: string;
  nextMainRunAt: string;
  nextSmallRunAt: string;
}

function ScenarioAutomationSection({
  settings,
  isSaving,
  runningMode,
  onSave,
  onRequestRun,
}: {
  settings?: ScenarioAutomationSettings;
  isSaving: boolean;
  runningMode: ScenarioAutomationRunMode | null;
  onSave: (values: AdminScenarioAutomationPayload) => void | Promise<void>;
  onRequestRun: (mode: ScenarioAutomationRunMode) => void;
}) {
  const [form, setForm] = useState<ScenarioAutomationFormState>(() => buildScenarioAutomationFormState(settings));

  useEffect(() => {
    setForm(buildScenarioAutomationFormState(settings));
  }, [settings]);

  const setField = (name: keyof ScenarioAutomationFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [name]: value }));
  };
  const mainRangeInvalid = isInvalidRange(form.mainMinIntervalHours, form.mainMaxIntervalHours, 1, 168);
  const smallRangeInvalid = isInvalidRange(form.smallMinIntervalMinutes, form.smallMaxIntervalMinutes, 5, 10080);
  const formInvalid = mainRangeInvalid || smallRangeInvalid;

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formInvalid) return;
    const nextMainRunAt = form.nextMainRunAt ? new Date(form.nextMainRunAt).toISOString() : undefined;
    const nextSmallRunAt = form.nextSmallRunAt ? new Date(form.nextSmallRunAt).toISOString() : undefined;
    void onSave({
      isEnabled: form.isEnabled,
      mainEnabled: form.mainEnabled,
      smallEnabled: form.smallEnabled,
      autoApply: form.autoApply,
      mainMinIntervalHours: boundedInteger(form.mainMinIntervalHours, 1, 168, 12),
      mainMaxIntervalHours: boundedInteger(form.mainMaxIntervalHours, 1, 168, 24),
      smallMinIntervalMinutes: boundedInteger(form.smallMinIntervalMinutes, 5, 10080, 120),
      smallMaxIntervalMinutes: boundedInteger(form.smallMaxIntervalMinutes, 5, 10080, 240),
      dailyMainLimit: boundedInteger(form.dailyMainLimit, 1, 24, 2),
      dailySmallLimit: boundedInteger(form.dailySmallLimit, 1, 288, 12),
      retryDelayMinutes: boundedInteger(form.retryDelayMinutes, 1, 1440, 15),
      ...(nextMainRunAt ? { nextMainRunAt } : {}),
      ...(nextSmallRunAt ? { nextSmallRunAt } : {}),
    });
  };

  return (
    <section className="simulation-grid automation-grid">
      <form className="panel simulation-control-panel" onSubmit={submitSettings}>
        <div className="panel-title">
          <Workflow size={20} />
          <h2>GPT 시나리오 자동화</h2>
        </div>

        <div className="automation-toggle-grid">
          <AutomationToggle
            checked={form.isEnabled}
            title={form.isEnabled ? '전체 자동화 ON' : '전체 자동화 OFF'}
            description="GPT 시나리오 스케줄러의 전체 동작을 제어합니다."
            onChange={(checked) => setField('isEnabled', checked)}
          />
          <AutomationToggle
            checked={form.autoApply}
            title={form.autoApply ? '생성 후 자동 적용' : '생성만 수행'}
            description="자동 적용 시 가격 변동과 AI 거래가 이어집니다."
            onChange={(checked) => setField('autoApply', checked)}
          />
          <AutomationToggle
            checked={form.mainEnabled}
            title="MAIN 시나리오"
            description="시장 전체 흐름을 만드는 메인 시나리오입니다."
            onChange={(checked) => setField('mainEnabled', checked)}
          />
          <AutomationToggle
            checked={form.smallEnabled}
            title="SMALL 시나리오"
            description="개별 종목 중심의 소규모 시나리오입니다."
            onChange={(checked) => setField('smallEnabled', checked)}
          />
        </div>

        <div className="automation-form-section">
          <div className="automation-section-head">
            <strong>MAIN 실행 정책</strong>
            <span>{settings?.todayMainCount ?? 0} / {form.dailyMainLimit || '-'}회 사용</span>
          </div>
          <div className="simulation-form-grid">
            <SimulationNumberField label="최소 주기(시간)" value={form.mainMinIntervalHours} min={1} max={168} step={1} onChange={(value) => setField('mainMinIntervalHours', value)} />
            <SimulationNumberField label="최대 주기(시간)" value={form.mainMaxIntervalHours} min={1} max={168} step={1} onChange={(value) => setField('mainMaxIntervalHours', value)} />
            <SimulationNumberField label="일일 생성 한도" value={form.dailyMainLimit} min={1} max={24} step={1} onChange={(value) => setField('dailyMainLimit', value)} />
            <label className="field simulation-field">
              <span>다음 MAIN 실행</span>
              <input type="datetime-local" value={form.nextMainRunAt} onChange={(event) => setField('nextMainRunAt', event.target.value)} />
            </label>
          </div>
          {mainRangeInvalid && <p className="simulation-validation-error">MAIN 최소 주기는 최대 주기보다 클 수 없으며 1~168시간이어야 합니다.</p>}
        </div>

        <div className="automation-form-section">
          <div className="automation-section-head">
            <strong>SMALL 실행 정책</strong>
            <span>{settings?.todaySmallCount ?? 0} / {form.dailySmallLimit || '-'}회 사용</span>
          </div>
          <div className="simulation-form-grid">
            <SimulationNumberField label="최소 주기(분)" value={form.smallMinIntervalMinutes} min={5} max={10080} step={1} onChange={(value) => setField('smallMinIntervalMinutes', value)} />
            <SimulationNumberField label="최대 주기(분)" value={form.smallMaxIntervalMinutes} min={5} max={10080} step={1} onChange={(value) => setField('smallMaxIntervalMinutes', value)} />
            <SimulationNumberField label="일일 생성 한도" value={form.dailySmallLimit} min={1} max={288} step={1} onChange={(value) => setField('dailySmallLimit', value)} />
            <label className="field simulation-field">
              <span>다음 SMALL 실행</span>
              <input type="datetime-local" value={form.nextSmallRunAt} onChange={(event) => setField('nextSmallRunAt', event.target.value)} />
            </label>
          </div>
          {smallRangeInvalid && <p className="simulation-validation-error">SMALL 최소 주기는 최대 주기보다 클 수 없으며 5~10,080분이어야 합니다.</p>}
        </div>

        <SimulationNumberField
          label="실패 후 재시도 대기(분)"
          value={form.retryDelayMinutes}
          min={1}
          max={1440}
          step={1}
          onChange={(value) => setField('retryDelayMinutes', value)}
        />

        <p className="simulation-note">자동 실행은 서버가 깨어 있을 때 동작합니다. 자동 적용을 켜면 생성된 시나리오가 즉시 가격과 AI 거래에 반영됩니다.</p>

        <div className="simulation-actions">
          <button className="primary-button" type="submit" disabled={isSaving || Boolean(runningMode) || formInvalid}>
            <ShieldCheck size={17} /> {isSaving ? '저장 중' : '자동화 설정 저장'}
          </button>
        </div>
      </form>

      <article className="panel simulation-status-panel automation-status-panel">
        <div className="panel-title">
          <Activity size={20} />
          <h2>스케줄러 상태</h2>
        </div>
        <div className="admin-summary-list">
          <SummaryItem label="전체 자동화" value={settings?.isEnabled ? '활성' : '비활성'} />
          <SummaryItem label="자동 적용" value={settings?.autoApply ? '활성' : '비활성'} />
          <SummaryItem label="오늘 MAIN" value={`${settings?.todayMainCount ?? 0} / ${settings?.dailyMainLimit ?? 0}`} />
          <SummaryItem label="오늘 SMALL" value={`${settings?.todaySmallCount ?? 0} / ${settings?.dailySmallLimit ?? 0}`} />
          <SummaryItem label="최근 MAIN" value={formatOptionalDate(settings?.lastMainRunAt)} />
          <SummaryItem label="다음 MAIN" value={formatOptionalDate(settings?.nextMainRunAt)} />
          <SummaryItem label="최근 SMALL" value={formatOptionalDate(settings?.lastSmallRunAt)} />
          <SummaryItem label="다음 SMALL" value={formatOptionalDate(settings?.nextSmallRunAt)} />
          <SummaryItem label="서버 시각" value={formatOptionalDate(settings?.serverTime)} />
        </div>

        {(settings?.lastMainError || settings?.lastSmallError) && (
          <div className="automation-error-list">
            {settings.lastMainError && <AutomationError label="MAIN 최근 오류" message={settings.lastMainError} occurredAt={settings.lastMainErrorAt} />}
            {settings.lastSmallError && <AutomationError label="SMALL 최근 오류" message={settings.lastSmallError} occurredAt={settings.lastSmallErrorAt} />}
          </div>
        )}

        <div className="automation-run-actions">
          <button className="secondary-button" type="button" disabled={Boolean(runningMode) || isSaving} onClick={() => onRequestRun('MAIN')}>
            <Sparkles size={17} /> {runningMode === 'MAIN' ? 'MAIN 실행 중' : 'MAIN 즉시 실행'}
          </button>
          <button className="secondary-button" type="button" disabled={Boolean(runningMode) || isSaving} onClick={() => onRequestRun('SMALL')}>
            <Sparkles size={17} /> {runningMode === 'SMALL' ? 'SMALL 실행 중' : 'SMALL 즉시 실행'}
          </button>
          <button className="ghost-button" type="button" disabled={Boolean(runningMode) || isSaving} onClick={() => onRequestRun('DUE')}>
            <RefreshCw size={17} /> {runningMode === 'DUE' ? '도래 작업 확인 중' : '도래 작업 실행'}
          </button>
        </div>
      </article>
    </section>
  );
}

function AutomationToggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={checked ? 'simulation-toggle active' : 'simulation-toggle'}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="simulation-toggle-track"><i /></span>
      <span><strong>{title}</strong><small>{description}</small></span>
    </label>
  );
}

function AutomationError({ label, message, occurredAt }: { label: string; message: string; occurredAt?: string | null }) {
  return (
    <div className="automation-error">
      <strong>{label}</strong>
      <p>{message}</p>
      {occurredAt && <small>{dateTime(occurredAt)}</small>}
    </div>
  );
}

function DividendSection({
  schedule,
  dividendStockCount,
  dividendTotal,
  onAction,
  onRunNow,
  onToggleAuto,
}: {
  schedule?: DividendSchedule;
  dividendStockCount: number;
  dividendTotal: number;
  onAction: (message: string) => void;
  onRunNow: () => void | Promise<void>;
  onToggleAuto: (enabled: boolean) => void | Promise<void>;
}) {
  const enabled = schedule?.enabled ?? false;
  const nextRunAt = schedule?.nextRunAt ?? schedule?.nextPayoutAt;
  return (
    <>
      <section className="admin-dashboard-grid">
        <article className="panel admin-chart-panel wide">
          <div className="panel-title"><WalletCards size={20} /><h2>배당률 단계</h2></div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dividendPolicyData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="tier" tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="rate" name="배당률" fill="#42e3a3" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="panel admin-action-panel">
          <div className="admin-summary-list">
            <SummaryItem label="배당 가능 종목" value={`${dividendStockCount}개`} />
            <SummaryItem label="다음 자동 지급" value={nextRunAt ? dateTime(nextRunAt) : '-'} />
            <SummaryItem label="최근 자동 지급" value={schedule?.lastRunAt ? dateTime(schedule.lastRunAt) : '-'} />
            <SummaryItem label="지급 주기" value={formatDividendFrequency(schedule?.frequency)} />
            <SummaryItem label="스케줄 상태" value={schedule?.status === 'active' ? '활성' : '일시정지'} />
            <SummaryItem label="누적 수령 기록" value={currency(dividendTotal)} />
          </div>
          <div className="admin-dividend-controls">
            <button className={enabled ? 'secondary-button' : 'primary-button'} type="button" onClick={() => void onToggleAuto(!enabled)}>
              {enabled ? '자동 지급 OFF' : '자동 지급 ON'}
            </button>
            <button className="primary-button" type="button" onClick={() => void onRunNow()}>
              <RefreshCw size={17} /> 배당 즉시 실행
            </button>
          </div>
          <ActionGrid actions={['배당금 정책 설정', '배당 지급 스케줄 설정', '다음 지급 시각 변경', '지급 스케줄 일시정지']} onAction={onAction} />
        </article>
      </section>
    </>
  );
}

function UsersSection({ rows, onAction }: { rows: Array<Array<ReactNode>>; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['전체 계정', `${rows.length}명`],
        ['내 순위 강조', '활성'],
        ['랭킹 정책', '총 자산'],
      ]}
      actions={['유저 권한 변경', '유저 거래 제한', '랭킹 초기화']}
      onAction={onAction}
      formTitle="유저 관리"
      fields={['유저명', '권한', '초기 자금', '상태 메모']}
      table={{ columns: ['계정', '권한', '순위', '총 자산', '수익률'], rows }}
    />
  );
}

function AdminWorkArea({
  summary,
  actions,
  onAction,
  formTitle,
  fields,
  table,
}: {
  summary: Array<[string, string]>;
  actions: string[];
  onAction: (message: string) => void;
  formTitle: string;
  fields: string[];
  table?: { columns: string[]; rows: Array<Array<ReactNode>> };
}) {
  return (
    <>
      <section className="admin-work-grid">
        <article className="panel admin-action-panel">
          <div className="admin-summary-list">
            {summary.map(([label, value]) => <SummaryItem key={label} label={label} value={value} />)}
          </div>
          <ActionGrid actions={actions} onAction={onAction} />
        </article>
        <AdminForm title={formTitle} fields={fields} />
      </section>
      {table && <ManagementTable columns={table.columns} rows={table.rows} />}
    </>
  );
}

function ActionGrid({ actions, onAction }: { actions: string[]; onAction: (message: string) => void }) {
  return (
    <div className="admin-action-grid">
      {actions.map((action) => (
        <button key={action} className="secondary-button" onClick={() => onAction(action)}>
          <FilePlus2 size={16} /> {action}
        </button>
      ))}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatDividendFrequency(frequency?: DividendSchedule['frequency']) {
  if (frequency === 'daily') return '매일';
  if (frequency === 'weekly') return '매주';
  if (frequency === 'monthly') return '매월';
  return '-';
}

function formatStockStatus(status?: string) {
  if (status === 'SUSPENDED') return '거래정지';
  if (status === 'UNLISTED') return '상장폐지';
  return '상장';
}

function SeedSourceStatus({ stock }: { stock: Stock }) {
  const sourceClass = stock.seedSource?.toLowerCase() ?? 'seasonal';
  const label = stock.seedSource === 'FILE'
    ? '파일 기본 종목'
    : stock.seedSource === 'ADMIN'
      ? '관리자 저장 종목'
      : '시즌 한정 종목';
  return (
    <span
      className={`seed-source-status ${sourceClass}`}
      title={stock.seededAt ? `마지막 저장 ${dateTime(stock.seededAt)}` : undefined}
    >
      <strong>{label}</strong>
      {stock.seedPrice !== null && <small>{currency(stock.seedPrice)}</small>}
    </span>
  );
}

function buildAdminUserGrowth(dashboard?: AdminDashboard) {
  if (!dashboard?.userGrowthSeries.length) return userGrowthData;
  const maxUsers = Math.max(...dashboard.userGrowthSeries.map((point) => point.count), 1);
  return dashboard.userGrowthSeries.map((point) => {
    const activeRatio = dashboard.totalUsers > 0 ? dashboard.activeUsers / dashboard.totalUsers : 1;
    return {
      day: point.date.slice(5) || point.date,
      users: point.count,
      active: Math.round(Math.min(point.count, maxUsers * activeRatio)),
    };
  });
}

function hasScenarioApplyResult(value: unknown): value is ScenarioApplyResult {
  return Boolean(value && typeof value === 'object' && 'affectedStocks' in value);
}

function hasSeasonResetResult(value: unknown): value is SeasonResetResult {
  return Boolean(value && typeof value === 'object' && 'seedStocksApplied' in value);
}

function hasAdminStockCreationResult(value: unknown): value is AdminStockCreationResult {
  return Boolean(value && typeof value === 'object' && 'stock' in value && 'seedSaved' in value);
}

function upsertStock(stocks: Stock[], stock: Stock) {
  const exists = stocks.some((item) => item.id === stock.id);
  return exists ? stocks.map((item) => (item.id === stock.id ? stock : item)) : [stock, ...stocks];
}

function formatStockSeedError(error: unknown) {
  if (error instanceof ApiError) {
    const backendMessage = getErrorMessage(error.payload, '').trim();
    if (backendMessage) return backendMessage;
    if (error.status === 400) return '저장 가격은 0.0001 이상의 숫자여야 합니다.';
    if (error.status === 401) return '로그인이 만료되었습니다. 다시 로그인해주세요.';
    if (error.status === 403) return '기본 종목 저장은 관리자만 실행할 수 있습니다.';
    if (error.status === 404) return '저장할 종목을 찾을 수 없습니다. 목록을 새로고침했습니다.';
  }
  return error instanceof Error ? error.message : '기본 종목 저장에 실패했습니다.';
}

function buildDividendSchedulePatch(action: string, values: Record<string, string | boolean>): Partial<DividendSchedule> {
  if (action === '배당 지급 스케줄 설정') {
    const enabled = values.enabled === true;
    const payoutTime = String(values.payoutTime || '12:00');
    const timezone = String(values.timezone || 'UTC');
      return {
        enabled,
        status: enabled ? 'active' : 'paused',
        frequency: parseDividendFrequency(String(values.frequency || '매일')),
        payoutTime,
        timezone,
        eligiblePolicy: String(values.eligiblePolicy || '보유자 전체'),
        nextPayoutAt: String(values.nextRunAt || buildPayoutDateTime('', payoutTime, timezone)),
        nextRunAt: String(values.nextRunAt || buildPayoutDateTime('', payoutTime, timezone)),
      };
  }

  if (action === '다음 지급 시각 변경') {
    const payoutTime = String(values.payoutTime || '12:00');
    const timezone = String(values.timezone || 'UTC');
    return {
      payoutTime,
      timezone,
      nextPayoutAt: String(values.nextRunAt || buildPayoutDateTime(String(values.nextPayoutDate || ''), payoutTime, timezone)),
      nextRunAt: String(values.nextRunAt || buildPayoutDateTime(String(values.nextPayoutDate || ''), payoutTime, timezone)),
    };
  }

  if (action === '지급 스케줄 일시정지') {
    const active = values.scheduleStatus === '활성화';
    return {
      enabled: active,
      status: active ? 'active' : 'paused',
    };
  }

  return {};
}

function parseDividendFrequency(value: string): DividendSchedule['frequency'] {
  if (value === '매주') return 'weekly';
  if (value === '매월') return 'monthly';
  return 'daily';
}

function buildPayoutDateTime(dateValue: string, timeValue: string, timezone: string) {
  const date = dateValue || new Date().toISOString().slice(0, 10);
  const time = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : '12:00';
  const offset = timezone === 'Asia/Seoul' ? '+09:00' : 'Z';
  return `${date}T${time}:00${offset}`;
}

function buildSimulationFormState(settings?: MarketSimulationSettings): SimulationFormState {
  return {
    isEnabled: settings?.isEnabled ?? false,
    intervalMinutes: String(settings?.intervalMinutes ?? 5),
    randomIntervalEnabled: settings?.randomIntervalEnabled ?? false,
    minIntervalMinutes: String(settings?.minIntervalMinutes ?? 5),
    maxIntervalMinutes: String(settings?.maxIntervalMinutes ?? 15),
    minChangeRate: String(settings?.minChangeRate ?? -7),
    maxChangeRate: String(settings?.maxChangeRate ?? 7),
    extremeMinRate: String(settings?.extremeMinRate ?? -80),
    extremeMaxRate: String(settings?.extremeMaxRate ?? 300),
    extremeChance: String(settings?.extremeChance ?? 0.04),
    volatilityWeight: String(settings?.volatilityWeight ?? 1),
    targetStockCount: settings?.targetStockCount ? String(settings.targetStockCount) : '',
    nextRunAt: toDateTimeLocal(settings?.nextRunAt),
  };
}

function buildScenarioAutomationFormState(settings?: ScenarioAutomationSettings): ScenarioAutomationFormState {
  return {
    isEnabled: settings?.isEnabled ?? false,
    mainEnabled: settings?.mainEnabled ?? true,
    smallEnabled: settings?.smallEnabled ?? true,
    autoApply: settings?.autoApply ?? false,
    mainMinIntervalHours: String(settings?.mainMinIntervalHours ?? 12),
    mainMaxIntervalHours: String(settings?.mainMaxIntervalHours ?? 24),
    smallMinIntervalMinutes: String(settings?.smallMinIntervalMinutes ?? 120),
    smallMaxIntervalMinutes: String(settings?.smallMaxIntervalMinutes ?? 240),
    dailyMainLimit: String(settings?.dailyMainLimit ?? 2),
    dailySmallLimit: String(settings?.dailySmallLimit ?? 12),
    retryDelayMinutes: String(settings?.retryDelayMinutes ?? 15),
    nextMainRunAt: toDateTimeLocal(settings?.nextMainRunAt),
    nextSmallRunAt: toDateTimeLocal(settings?.nextSmallRunAt),
  };
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedInteger(value: string, min: number, max: number, fallback: number) {
  return clamp(Math.trunc(safeNumber(value, fallback)), min, max);
}

function isInvalidRange(minValue: string, maxValue: string, minimum: number, maximum: number) {
  const min = Number(minValue);
  const max = Number(maxValue);
  return !Number.isFinite(min) || !Number.isFinite(max) || min < minimum || max > maximum || min > max;
}

function formatOptionalDate(value?: string | null) {
  return value ? dateTime(value) : '-';
}

function ManagementTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <section className="panel admin-table-panel">
      <div className="panel-title"><DatabaseZap size={20} /><h2>관리 목록</h2></div>
      <div className="admin-data-table" style={{ '--admin-columns': `repeat(${columns.length}, minmax(120px, 1fr))` } as CSSProperties}>
        <div className="admin-data-row head">
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {rows.map((row, rowIndex) => (
          <div className="admin-data-row" key={`${rowIndex}-${row[0]}`}>
            {row.map((cell, cellIndex) => <span key={`${rowIndex}-${cellIndex}`}>{cell}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}

function OperationLog() {
  return (
    <article className="panel admin-log-panel">
      <div className="panel-title"><ClipboardList size={20} /><h2>운영 로그</h2></div>
      {adminLogs.map((log) => (
        <div className="admin-log-row" key={`${log.label}-${log.time}`}>
          <span className={log.status === '완료' ? 'status-dot success' : 'status-dot pending'} />
          <div>
            <strong>{log.label}</strong>
            <small>{log.owner} · {dateTime(log.time)}</small>
          </div>
          <span className={log.status === '완료' ? 'pill cyan' : 'pill purple'}>{log.status}</span>
        </div>
      ))}
    </article>
  );
}

function wrapScenarioAutomationRunResult(result: ScenarioAutomationRunResult): ScenarioAutomationProcessResult {
  return {
    ok: result.status === 'COMPLETED',
    status: 'PROCESSED',
    checkedAt: result.completedAt ?? new Date().toISOString(),
    results: [result],
  };
}

function ScenarioAutomationConfirmModal({
  mode,
  autoApply,
  onClose,
  onConfirm,
}: {
  mode: ScenarioAutomationRunMode;
  autoApply: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const label = mode === 'DUE' ? '도래한 자동화 작업' : `${mode} 시나리오`;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scenario-automation-confirm-title">
      <section className="modal automation-confirm-modal">
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">GPT Cost Confirmation</span>
            <h3 id="scenario-automation-confirm-title">{label} 실행 확인</h3>
            <p>이 작업은 GPT 호출 비용을 발생시키며 실행 상태와 일일 한도에 반영됩니다.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="실행 취소"><X size={18} /></button>
        </div>
        <div className="danger-zone-note">
          <strong>{autoApply ? '가격 변동 가능' : '시나리오 생성 모드'}</strong>
          <p>
            {autoApply
              ? '자동 적용이 활성화되어 있습니다. 생성 성공 시 종목 가격, 조건 주문, AI 자동 거래와 랭킹이 즉시 변경될 수 있습니다.'
              : '현재 자동 적용은 비활성화되어 있어 시나리오 생성까지만 수행합니다.'}
          </p>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>취소</button>
          <button className="primary-button" type="button" onClick={onConfirm}><Sparkles size={17} /> 실행</button>
        </div>
      </section>
    </div>
  );
}

function ScenarioAutomationResultModal({
  result,
  onClose,
}: {
  result: ScenarioAutomationProcessResult;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scenario-automation-result-title">
      <section className="modal scenario-result-modal automation-result-modal">
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">Automation Result</span>
            <h3 id="scenario-automation-result-title">GPT 자동 운영 실행 결과</h3>
            <p>{formatAutomationProcessStatus(result.status)} · {formatOptionalDate(result.checkedAt)}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="결과 닫기"><X size={18} /></button>
        </div>

        <div className="automation-result-list">
          {result.results.length ? result.results.map((run, index) => (
            <article className="scenario-result-section automation-result-item" key={`${run.type}-${run.completedAt ?? index}`}>
              <div className="automation-result-head">
                <strong>{run.type} 시나리오</strong>
                <span className={`automation-status-pill ${automationStatusClass(run.status)}`}>{formatAutomationStatus(run.status)}</span>
              </div>
              {run.scenario && (
                <div className="automation-result-scenario">
                  <span>생성 시나리오</span>
                  <strong>{run.scenario.title}</strong>
                  <small>{run.scenario.description}</small>
                </div>
              )}
              <div className="automation-result-meta">
                <span>자동 적용 <strong>{run.autoApply ? 'ON' : 'OFF'}</strong></span>
                <span>변동 종목 <strong>{run.application?.affectedStocks.length ?? 0}개</strong></span>
                <span>조건 주문 <strong>{run.application?.conditionalOrderResults.length ?? 0}건</strong></span>
                <span>AI 거래 <strong>{run.application?.aiTradeResults.length ?? 0}건</strong></span>
              </div>
              {run.applyError && <p className="automation-inline-error">적용 오류: {run.applyError}</p>}
              <div className="automation-result-times">
                <span>완료 {formatOptionalDate(run.completedAt)}</span>
                <span>다음 실행 {formatOptionalDate(run.nextRunAt)}</span>
              </div>
            </article>
          )) : (
            <div className="empty-state">현재 실행할 도래 작업이 없습니다.</div>
          )}
        </div>

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function formatAutomationStatus(status: string) {
  const labels: Record<string, string> = {
    COMPLETED: '완료',
    GENERATED_APPLY_FAILED: '생성 완료 · 적용 실패',
    FAILED: '실패',
    SKIPPED_ALREADY_RUNNING: '이미 실행 중',
    SKIPPED_NOT_DUE: '실행 시각 전',
    SKIPPED_LEASED: '다른 작업이 점유 중',
    SKIPPED_DAILY_LIMIT: '일일 한도 도달',
  };
  return labels[status] ?? status;
}

function formatAutomationProcessStatus(status: string) {
  if (status === 'DISABLED') return '자동화 비활성';
  if (status === 'IDLE') return '실행 대상 없음';
  if (status === 'PROCESSED') return '처리 완료';
  return status;
}

function automationStatusClass(status: string) {
  if (status === 'COMPLETED') return 'success';
  if (status.startsWith('SKIPPED')) return 'skipped';
  return 'failed';
}

function ScenarioApplyResultModal({
  result,
  stocks,
  markets,
  onClose,
}: {
  result: ScenarioApplyResult;
  stocks: Stock[];
  markets: Market[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scenario-apply-result-title">
      <section className="modal scenario-result-modal">
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">Scenario Applied</span>
            <h3 id="scenario-apply-result-title">{result.title}</h3>
            <p>가격 변동, 조건 주문 처리, AI 자동 거래 결과입니다.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="결과 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="scenario-result-grid">
          <article className="scenario-result-section">
            <h4>변동된 종목</h4>
            {result.affectedStocks.length ? result.affectedStocks.map((stock) => (
              <div className="scenario-result-row" key={stock.stockId}>
                <strong>{formatScenarioResultStock(stock, stocks, markets)}</strong>
                <span>{currency(stock.beforePrice)} → {currency(stock.afterPrice)}</span>
                <span className={stock.appliedRate >= 0 ? 'positive' : 'negative'}>{stock.appliedRate.toFixed(2)}%</span>
                {stock.impactReason && <small>{stock.impactReason}</small>}
              </div>
            )) : <p className="panel-copy">가격 변동 종목이 없습니다.</p>}
          </article>

          <article className="scenario-result-section">
            <h4>조건 주문 결과</h4>
            {result.conditionalOrderResults.length ? result.conditionalOrderResults.map((order, index) => (
              <div className="scenario-result-row" key={order.orderId ?? `${order.stockId}-${index}`}>
                <strong>{order.type ?? '조건 주문'} · {order.status ?? '-'}</strong>
                <span>{formatScenarioResultStock(order, stocks, markets)}</span>
                <small>{order.reason ?? `${order.quantity ?? 0}주 처리`}</small>
              </div>
            )) : <p className="panel-copy">체결 또는 실패한 조건 주문이 없습니다.</p>}
          </article>

          <article className="scenario-result-section wide">
            <h4>AI 자동 거래</h4>
            {result.aiTradeSummary && <p className="panel-copy">{result.aiTradeSummary}</p>}
            {result.aiTradeResults.length ? result.aiTradeResults.map((trade, index) => (
              <div className="scenario-result-row" key={trade.tradeId ?? `${trade.aiAccountId}-${index}`}>
                <strong>{trade.action}</strong>
                <span>{formatScenarioResultStock(trade, stocks, markets)} · {(trade.quantity ?? 0).toLocaleString('ko-KR')}주</span>
                <small>{trade.reason ?? '자동 거래 결과'}</small>
              </div>
            )) : <p className="panel-copy">AI 자동 거래 결과가 없습니다.</p>}
          </article>
        </div>

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function MarketSimulationResultModal({
  result,
  stocks,
  markets,
  onClose,
}: {
  result: MarketSimulationRunResult;
  stocks: Stock[];
  markets: Market[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="market-simulation-result-title">
      <section className="modal scenario-result-modal">
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">Market Simulation</span>
            <h3 id="market-simulation-result-title">시장 시뮬레이션 실행 결과</h3>
            <p>{result.mode} · {result.affectedCount.toLocaleString('ko-KR')}개 종목 변동</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="결과 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="scenario-result-grid">
          <article className="scenario-result-section wide">
            <h4>변동된 종목</h4>
            {result.affectedStocks.length ? result.affectedStocks.map((stock, index) => (
              <div className="scenario-result-row simulation-result-row" key={`${stock.stockId}-${index}`}>
                <strong>{formatScenarioResultStock(stock, stocks, markets)}</strong>
                <span>{currency(stock.beforePrice)} → {currency(stock.afterPrice)}</span>
                <span className={stock.appliedRate >= 0 ? 'positive' : 'negative'}>{stock.appliedRate.toFixed(2)}%</span>
                <span className={stock.mode === 'EXTREME' ? 'simulation-mode-pill extreme' : 'simulation-mode-pill'}>
                  {formatSimulationMode(stock.mode)}
                </span>
                {stock.reason && <small>{stock.reason}</small>}
              </div>
            )) : <p className="panel-copy">변동된 종목이 없습니다.</p>}
          </article>

          <article className="scenario-result-section wide">
            <h4>조건 주문 처리</h4>
            {result.conditionalOrderResults.length ? result.conditionalOrderResults.map((order, index) => (
              <div className="scenario-result-row" key={order.orderId ?? `${order.stockId}-${index}`}>
                <strong>{order.type ?? '조건 주문'} · {order.status ?? '-'}</strong>
                <span>{formatScenarioResultStock(order, stocks, markets)}</span>
                <small>{order.reason ?? `${order.quantity ?? 0}주 처리`}</small>
              </div>
            )) : <p className="panel-copy">체결 또는 실패한 조건 주문이 없습니다.</p>}
          </article>
        </div>

        {(result.nextRunAt || result.scheduledIntervalMinutes) && (
          <p className="simulation-note">
            {result.nextRunAt ? `다음 자동 실행 예정: ${dateTime(result.nextRunAt)}` : '다음 자동 실행 시각 미정'}
            {result.scheduledIntervalMinutes ? ` · 예약 주기 ${result.scheduledIntervalMinutes}분` : ''}
          </p>
        )}

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function formatScenarioResultStock(
  target: { stockId?: string; stockName?: string; marketId?: string; marketName?: string },
  stocks: Stock[],
  markets: Market[],
) {
  const stock = target.stockId ? stocks.find((item) => item.id === target.stockId) : undefined;
  const stockName = target.stockName ?? stock?.name ?? '종목 정보 없음';
  const marketName =
    target.marketName ??
    stock?.market?.name ??
    markets.find((market) => market.id === (target.marketId ?? stock?.marketId))?.name;
  return marketName && stockName !== '종목 정보 없음' ? `${marketName} · ${stockName}` : stockName;
}

function formatSimulationMode(mode?: string) {
  if (mode === 'EXTREME') return 'EXTREME';
  if (mode === 'NORMAL') return 'NORMAL';
  return mode ?? 'NORMAL';
}

function formatAiStrategy(strategy: AdminAiAccount['strategyType']) {
  if (strategy === 'AGGRESSIVE') return '공격형';
  if (strategy === 'STABLE') return '안정형';
  if (strategy === 'MARKET_FOCUSED') return '특정 장 집중형';
  return '랜덤형';
}

function StockSeedModal({
  stock,
  marketName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  stock: Stock;
  marketName?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (body: SaveStockToSeedPayload) => Promise<string | null>;
}) {
  const savedCustomPrice = stock.seedPrice !== null && Math.abs(stock.seedPrice - stock.initialPrice) > 0.00005;
  const [priceMode, setPriceMode] = useState<'INITIAL' | 'CUSTOM'>(savedCustomPrice ? 'CUSTOM' : 'INITIAL');
  const [seedPrice, setSeedPrice] = useState(String(stock.seedPrice ?? stock.initialPrice));
  const [formError, setFormError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const numericPrice = Number(seedPrice);
    if (priceMode === 'CUSTOM' && (!Number.isFinite(numericPrice) || numericPrice < 0.0001)) {
      setFormError('다음 시즌 시작 가격은 0.0001 이상으로 입력해주세요.');
      return;
    }
    const error = await onSubmit(priceMode === 'CUSTOM' ? { seedPrice: numericPrice } : {});
    if (error) setFormError(error);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="stock-seed-modal-title">
      <form className="modal stock-seed-modal" onSubmit={submit}>
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">Season Catalog</span>
            <h3 id="stock-seed-modal-title">
              {stock.seedSource === 'ADMIN' ? '기본 설정 수정' : '기본 종목으로 저장'}
            </h3>
            <p>{marketName ?? '소속 장'} · {stock.name}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="모달 닫기" disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        <div className="seed-stock-summary">
          <div><span>현재가</span><strong>{currency(stock.price)}</strong></div>
          <div><span>초기 상장 가격</span><strong>{currency(stock.initialPrice)}</strong></div>
          {stock.seedPrice !== null && <div><span>현재 저장 가격</span><strong>{currency(stock.seedPrice)}</strong></div>}
        </div>

        <div className="seed-price-mode" role="group" aria-label="다음 시즌 시작 가격 방식">
          <button
            type="button"
            className={priceMode === 'INITIAL' ? 'active' : ''}
            onClick={() => setPriceMode('INITIAL')}
          >
            초기 상장 가격 사용
          </button>
          <button
            type="button"
            className={priceMode === 'CUSTOM' ? 'active' : ''}
            onClick={() => setPriceMode('CUSTOM')}
          >
            직접 지정
          </button>
        </div>

        {priceMode === 'CUSTOM' && (
          <label className="field seed-price-field">
            <span>다음 시즌 시작 가격</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.0001"
              step="0.0001"
              value={seedPrice}
              onChange={(event) => setSeedPrice(event.target.value)}
              required
              autoFocus
            />
          </label>
        )}

        <div className="seed-catalog-note">
          <DatabaseZap size={18} />
          <p>
            저장하면 이 종목과 소속 시장이 시즌 초기화 후에도 유지됩니다. 현재가는 저장되지 않으며 선택한 가격으로 복원됩니다.
          </p>
        </div>
        {formError && <p className="admin-form-error" role="alert">{formError}</p>}

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={isSubmitting}>취소</button>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            <DatabaseZap size={17} /> {isSubmitting ? '저장 중' : '기본 카탈로그에 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SeasonResetResultModal({ result, onClose }: { result: SeasonResetResult; onClose: () => void }) {
  const clearedRows = [
    ['유저 초기화', result.usersReset],
    ['보유 자산 삭제', result.holdingsCleared],
    ['조건 주문 삭제', result.conditionalOrdersCleared],
    ['관심 종목 삭제', result.watchlistItemsCleared],
    ['거래 내역 삭제', result.tradesCleared],
    ['배당 기록 삭제', result.dividendsCleared],
    ['랭킹 삭제', result.rankingsCleared],
    ['시나리오 영향 삭제', result.scenarioImpactsCleared],
    ['시나리오 삭제', result.scenariosCleared],
    ['가격 히스토리 삭제', result.priceHistoriesCleared],
    ['비 seed 종목 삭제', result.nonSeedStocksDeleted],
    ['비 seed 시장 삭제', result.nonSeedMarketsDeleted],
  ] as const;
  const seedRows = [
    ['파일 기본 시장 적용', result.seedMarketsApplied],
    ['파일 기본 종목 적용', result.seedStocksApplied],
    ['관리자 기본 시장 유지', result.adminSeedMarketsPreserved],
    ['관리자 기본 종목 복원', result.adminSeedStocksRestored],
    ['가격 히스토리 생성', result.seedPriceHistoriesCreated],
  ] as const;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="season-reset-result-title">
      <section className="modal scenario-result-modal">
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">Season Reset Complete</span>
            <h3 id="season-reset-result-title">시즌 초기화 결과</h3>
            <p>{result.resetMode} · {result.seasonId}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="결과 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="scenario-result-grid">
          <article className="scenario-result-section">
            <h4>삭제 / 초기화</h4>
            {clearedRows.map(([label, value]) => (
              <div className="season-reset-row" key={label}>
                <span>{label}</span>
                <strong>{value.toLocaleString('ko-KR')}</strong>
              </div>
            ))}
          </article>
          <article className="scenario-result-section">
            <h4>기본 카탈로그 복원</h4>
            {seedRows.map(([label, value]) => (
              <div className="season-reset-row" key={label}>
                <span>{label}</span>
                <strong>{value.toLocaleString('ko-KR')}</strong>
              </div>
            ))}
          </article>
        </div>

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function AdminForm({ title, fields }: { title: string; fields: string[] }) {
  return (
    <form className="panel admin-form" onSubmit={(event) => event.preventDefault()}>
      <div className="panel-title"><SlidersHorizontal size={20} /><h2>{title}</h2></div>
      <div className="admin-form-fields">
        {fields.map((field) => (
          <label className="field" key={field}>
            <span>{field}</span>
            <input placeholder={field} />
          </label>
        ))}
      </div>
      <label className="check-row">
        <input type="checkbox" defaultChecked /> 활성화 여부
      </label>
      <button className="primary-button">저장</button>
    </form>
  );
}

function AdminActionModal({
  request,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  request: AdminActionRequest;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | boolean>) => void | Promise<void>;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
      <form
        className="modal admin-request-modal"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const values = request.fields.reduce<Record<string, string | boolean>>((acc, field) => {
            acc[field.name] = field.type === 'checkbox' ? formData.get(field.name) === 'on' : String(formData.get(field.name) ?? '');
            return acc;
          }, {});
          onSubmit(values);
        }}
      >
        <div className="admin-request-head">
          <div>
            <span className="eyebrow">{adminNavItems.find((item) => item.id === request.section)?.label}</span>
            <h3 id="admin-action-title">{request.title}</h3>
            <p>{request.description}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="모달 닫기" disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>
        {request.section === 'season' && request.action === '시즌 초기화' && (
          <div className="danger-zone-note">
            <strong>Seed 카탈로그 기준 초기화</strong>
            <p>
              파일 또는 관리자 기본 카탈로그에 없는 시장/종목, 보유 자산, 조건 주문, 관심 종목, 거래 내역, 배당 기록, 랭킹,
              시나리오, 시나리오 영향 기록, 가격 히스토리가 삭제됩니다.
            </p>
            <p>관리자가 기본 종목으로 저장한 종목과 소속 시장은 저장 가격으로 복원됩니다.</p>
            <p>일반 유저, 관리자, AI 계정과 시즌 레코드는 유지되지만 USER/AI 자산은 시즌 초기 자금으로 리셋됩니다.</p>
          </div>
        )}
        <div className="admin-request-fields">
          {request.fields.map((field) => (
            <AdminActionFieldControl key={field.name} field={field} />
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>취소</button>
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            <Send size={17} /> {isSubmitting ? '요청 중' : '요청 보내기'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminActionFieldControl({ field }: { field: AdminActionField }) {
  if (field.type === 'textarea') {
    return (
      <label className="field admin-request-field wide">
        <span>{field.label}</span>
        <textarea
          name={field.name}
          placeholder={field.placeholder}
          defaultValue={field.defaultValue}
          required={field.required}
          maxLength={field.maxLength}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <AdminActionSelect field={field} />
    );
  }

  if (field.type === 'multiselect') {
    return <AdminActionMultiSelect field={field} />;
  }

  if (field.type === 'number') {
    return <AdminNumberInput field={field} />;
  }

  if (field.type === 'checkbox') {
    return (
      <label className="check-row admin-request-check">
        <input name={field.name} type="checkbox" defaultChecked={field.defaultValue === 'true'} />
        {field.label}
      </label>
    );
  }

  return (
    <label className="field admin-request-field">
      <span>{field.label}</span>
      <input
        name={field.name}
        type={field.type ?? 'text'}
        placeholder={field.placeholder}
        defaultValue={field.defaultValue}
        required={field.required}
        maxLength={field.maxLength}
      />
    </label>
  );
}

function AdminNumberInput({ field }: { field: AdminActionField }) {
  const [value, setValue] = useState(field.defaultValue ?? '');
  const step = field.step ?? inferNumberStep(field.name);

  const nudge = (direction: 1 | -1) => {
    const current = Number(value || 0);
    const candidate = Number.isFinite(current) ? current + step * direction : step * direction;
    const next = Math.min(field.max ?? Number.POSITIVE_INFINITY, Math.max(field.min ?? Number.NEGATIVE_INFINITY, candidate));
    setValue(formatNumberStep(next, step));
  };

  return (
    <label className="field admin-request-field">
      <span>{field.label}</span>
      <div className="admin-number-input">
        <button type="button" className="admin-number-button" onClick={() => nudge(-1)} aria-label={`${field.label} 감소`}>
          <Minus size={15} />
        </button>
        <input
          name={field.name}
          type="number"
          inputMode="decimal"
          step={step}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={value}
          required={field.required}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" className="admin-number-button" onClick={() => nudge(1)} aria-label={`${field.label} 증가`}>
          <Plus size={15} />
        </button>
      </div>
    </label>
  );
}

function useAdminSelectPopover(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const [placement, setPlacement] = useState<'above' | 'below'>('below');

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const menuGap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
    const spaceAbove = rect.top - viewportPadding - menuGap;
    const shouldOpenAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableHeight = shouldOpenAbove ? spaceAbove : spaceBelow;
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const maxHeight = Math.max(96, Math.min(280, availableHeight));

    setPlacement(shouldOpenAbove ? 'above' : 'below');
    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight,
      ...(shouldOpenAbove
        ? { bottom: window.innerHeight - rect.top + menuGap }
        : { top: rect.bottom + menuGap }),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuStyle(undefined);
      return undefined;
    }

    updatePosition();
    const animationFrame = window.requestAnimationFrame(updatePosition);
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, setOpen, updatePosition]);

  return { triggerRef, menuRef, menuStyle, placement };
}

function AdminActionSelect({ field }: { field: AdminActionField }) {
  const options = useMemo(() => (field.options ?? []).map(toSelectOption), [field.options]);
  const [selected, setSelected] = useState(field.defaultValue ?? options[0]?.value ?? '');
  const [open, setOpen] = useState(false);
  const { triggerRef, menuRef, menuStyle, placement } = useAdminSelectPopover(open, setOpen);
  const selectedOption = options.find((option) => option.value === selected);

  useEffect(() => {
    setSelected((current) => {
      if (options.some((option) => option.value === current)) return current;
      return field.defaultValue ?? options[0]?.value ?? '';
    });
  }, [field.defaultValue, options]);

  return (
    <label className="field admin-request-field">
      <span>{field.label}</span>
      <input type="hidden" name={field.name} value={selected} />
      <div className={open ? 'admin-select open' : 'admin-select'}>
        <button
          ref={triggerRef}
          type="button"
          className="admin-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{selectedOption?.label || selected || field.placeholder || '선택'}</span>
          <ChevronDown size={17} />
        </button>
        {open && menuStyle && createPortal(
          <div
            ref={menuRef}
            className={`admin-select-menu admin-select-menu-portal ${placement}`}
            role="listbox"
            style={menuStyle}
          >
            {options.map((option) => (
              <button
                key={option.value || option.label}
                type="button"
                className={selected === option.value ? 'selected' : ''}
                role="option"
                aria-selected={selected === option.value}
                onClick={() => {
                  setSelected(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected === option.value && <Check size={16} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
    </label>
  );
}

function AdminActionMultiSelect({ field }: { field: AdminActionField }) {
  const options = useMemo(
    () => (field.options ?? []).map(toSelectOption).filter((option) => option.value),
    [field.options],
  );
  const [selected, setSelected] = useState<string[]>(() => parseSelectedValues(field.defaultValue));
  const [open, setOpen] = useState(false);
  const { triggerRef, menuRef, menuStyle, placement } = useAdminSelectPopover(open, setOpen);
  const selectedLabels = selected
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter(Boolean);

  useEffect(() => {
    setSelected((current) => current.filter((value) => options.some((option) => option.value === value)));
  }, [options]);

  const toggleOption = (value: string) => {
    setSelected((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (field.maxItems && current.length >= field.maxItems) return current;
      return [...current, value];
    });
  };

  return (
    <label className="field admin-request-field">
      <span>{field.label}</span>
      <input type="hidden" name={field.name} value={selected.join(',')} />
      <div className={open ? 'admin-select admin-multiselect open' : 'admin-select admin-multiselect'}>
        <button
          ref={triggerRef}
          type="button"
          className="admin-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{selectedLabels.length ? selectedLabels.join(', ') : field.placeholder || '선택 없음'}</span>
          <ChevronDown size={17} />
        </button>
        {open && menuStyle && createPortal(
          <div
            ref={menuRef}
            className={`admin-select-menu admin-select-menu-portal multiselect ${placement}`}
            role="listbox"
            aria-multiselectable="true"
            style={menuStyle}
          >
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={checked ? 'selected' : ''}
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggleOption(option.value)}
                >
                  <span>{option.label}</span>
                  {checked && <Check size={16} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      </div>
      {field.maxItems && <small className="field-hint">최대 {field.maxItems}개 · 현재 {selected.length}개 선택</small>}
    </label>
  );
}

function inferNumberStep(fieldName: string) {
  if (/rate|multiplier|growth|resetValue/i.test(fieldName)) return 0.1;
  if (/strength|risk|limit|order|count|duration|adjustment/i.test(fieldName)) return 1;
  if (/supply/i.test(fieldName)) return 10000;
  if (/cash|price|payout|amount/i.test(fieldName)) return 1000;
  return 1;
}

function formatNumberStep(value: number, step: number) {
  const decimals = String(step).split('.')[1]?.length ?? 0;
  return value.toFixed(decimals);
}

function createAdminActionRequest(
  section: AdminSection,
  action: string,
  options: AdminActionOptions = defaultActionOptions,
): AdminActionRequest {
  return {
    section,
    action,
    title: action,
    description: getActionDescription(section, action),
    fields: getActionFields(section, action, options),
  };
}

function getActionDescription(section: AdminSection, action: string) {
  const sectionName = adminNavItems.find((item) => item.id === section)?.label ?? '관리자';
  const descriptions: Record<string, string> = {
    '새 시즌 생성': '시즌명, 기간, 초기 자금을 입력해 새 시즌을 생성합니다.',
    '시즌 초기화': '시즌 초기화를 실행하면 seed에 정의되지 않은 시장/종목과 모든 거래, 보유 자산, 조건 주문, 관심 종목, 배당 기록, 랭킹, 시나리오, 가격 히스토리가 삭제됩니다. 유저/AI 계정은 유지되지만 자산은 시즌 초기 자금으로 리셋됩니다.',
    '새 장/시장 추가': '새로운 팬덤 기반 장을 만들고 노출 순서와 활성 상태를 지정합니다.',
    '장/시장 수정': '기존 장의 이름, 설명, 정렬, 활성 상태를 수정합니다.',
    '장/시장 비활성화': '특정 장을 비활성 상태로 전환합니다.',
    '장/시장 삭제': '선택한 장을 삭제하는 위험 작업입니다.',
    '새 종목 상장': '초기 가격, 발행량, 배당 여부를 포함해 새 종목을 상장합니다.',
    '종목 수정': '상장 종목의 가격 정책, 변동성, 배당률, 활성 상태를 조정합니다.',
    '종목 비활성화': '특정 종목을 비상장 상태로 전환합니다.',
    '종목 상장폐지': '선택한 종목을 상장폐지하는 위험 작업입니다.',
    'AI 계정 추가': '랭킹에 참여할 AI 계정과 투자 성향을 생성합니다.',
    'AI 계정 수정': '기존 AI 계정의 이름, 투자 성향, 선호 장, 위험도와 초기 자금을 수정합니다.',
    'AI 계정 비활성화': '계정 데이터는 유지하고 선택한 AI 계정의 운영을 비활성화합니다.',
    'AI 투자 성향 리밸런싱': '선택한 AI 계정의 자동 거래를 실행합니다.',
    '메인 시나리오 생성 요청': '시장 흐름에 영향을 주는 메인 시나리오 생성을 요청합니다.',
    'BIG 시나리오 생성 요청': '강한 가격 충격을 주는 BIG 시나리오 생성을 요청합니다.',
    '소규모 시나리오 생성 요청': '개별 종목 중심의 짧은 시나리오를 생성합니다.',
    '시나리오 적용': '생성된 시나리오를 가격에 반영하고 조건 주문과 AI 자동 거래 결과를 확인합니다.',
    '배당금 정책 설정': '배당률, 쿨타임, 시즌 제한, 자동 지급 여부를 변경합니다.',
    '배당 지급 스케줄 설정': '자동 배당 지급 여부와 다음 실행 시각을 설정합니다.',
    '다음 지급 시각 변경': '다음 1회 지급 예정 시각을 조정합니다.',
    '지급 스케줄 일시정지': '자동 배당 지급을 일시정지하거나 다시 활성화합니다.',
    '유저 권한 변경': '사용자 권한과 관리자 접근 가능 여부를 변경합니다.',
    '유저 거래 제한': '특정 사용자의 계정을 비활성 상태로 전환합니다.',
    '랭킹 초기화': '랭킹 데이터를 재계산합니다.',
  };
  return descriptions[action] ?? `${sectionName}에서 "${action}" 요청을 보내기 전에 적용 값을 확인합니다.`;
}

const fallbackMarketOptions: AdminSelectOption[] = ['버츄얼 & 스트리머장', '가수장', '캐릭터장', '애니메이션장'];
const fallbackStockOptions: AdminSelectOption[] = ['노바 린', '픽셀 민트', '루나 콰이어', '블루 아크 마스코트', '오리온 학원', '네온 아이돌즈'];
const fallbackAiOptions: AdminSelectOption[] = [blankSelectOption('AI 계정 데이터 없음')];
const fallbackUserOptions: AdminSelectOption[] = ['플레이어01', '마루트레이더', '하루차트', '전체 사용자'];
const fallbackScenarioOptions: AdminSelectOption[] = [blankSelectOption('적용 가능한 시나리오 없음')];
const defaultActionOptions: AdminActionOptions = {
  marketOptions: fallbackMarketOptions,
  stockOptions: fallbackStockOptions,
  aiOptions: fallbackAiOptions,
  userOptions: fallbackUserOptions,
  scenarioOptions: fallbackScenarioOptions,
};

function toSelectOption(option: AdminSelectOption) {
  return typeof option === 'string' ? { label: option, value: option } : option;
}

function parseSelectedValues(value?: string) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function blankSelectOption(label: string): AdminSelectOption {
  return { label, value: '' };
}

function buildMarketOptions(markets: Market[]): AdminSelectOption[] {
  if (!markets.length) return fallbackMarketOptions;
  return [...markets]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko-KR'))
    .map((market) => ({
      label: `${market.name}${market.active ? '' : ' (비활성)'}`,
      value: market.id,
    }));
}

function buildStockOptions(stocks: Stock[], markets: Market[] = []): AdminSelectOption[] {
  if (!stocks.length) return fallbackStockOptions;
  return [...stocks]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
    .map((stock) => ({
      label: `${formatStockWithMarket(stock, markets)}${stock.status && stock.status !== 'LISTED' ? ` (${formatStockStatus(stock.status)})` : ''}`,
      value: stock.id,
    }));
}

function buildAiOptions(entries: AdminAiAccount[]): AdminSelectOption[] {
  if (!entries.length) return fallbackAiOptions;
  return [
    blankSelectOption('전체 AI 계정'),
    ...entries.map((entry) => ({
      label: `${entry.nickname}${entry.isActive ? '' : ' (비활성)'}`,
      value: entry.id,
    })),
  ];
}

function buildUserOptions(entries: RankingEntry[]): AdminSelectOption[] {
  const userEntries = entries.filter((entry) => entry.role !== 'ai');
  if (!userEntries.length) return fallbackUserOptions;
  return [
    blankSelectOption('전체 사용자'),
    ...userEntries.map((entry) => ({
      label: entry.name,
      value: entry.id,
    })),
  ];
}

function buildScenarioOptions(entries: ScenarioLog[]): AdminSelectOption[] {
  if (!entries.length) return fallbackScenarioOptions;
  return [...entries]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .map((scenario) => ({
      label: `${scenario.type.toUpperCase()} · ${scenario.title} · ${dateTime(scenario.occurredAt)}`,
      value: scenario.id,
    }));
}

function getActionFields(
  section: AdminSection,
  action: string,
  options: AdminActionOptions = defaultActionOptions,
): AdminActionField[] {
  const { marketOptions, stockOptions, aiOptions, userOptions, scenarioOptions } = options;

  if (section === 'season') {
    if (action === '새 시즌 생성') {
      return [
        { name: 'newSeasonName', label: '시즌명', placeholder: '예: 2026 SUMMER' },
        { name: 'startsAt', label: '시작일', type: 'date' },
        { name: 'endsAt', label: '종료일', type: 'date' },
        { name: 'initialCash', label: '초기 자금', type: 'number', placeholder: '10000000' },
        { name: 'status', label: '시즌 상태', type: 'select', options: ['UPCOMING', 'ACTIVE', 'ENDED'] },
      ];
    }
    if (action === '시즌 초기화') {
      return [
        { name: 'seasonId', label: '시즌 ID', placeholder: '초기화할 시즌 ID' },
        { name: 'understandDeletionScope', label: '삭제 범위를 이해했습니다', type: 'checkbox' },
        { name: 'confirmText', label: 'RESET 입력', placeholder: 'RESET' },
      ];
    }
    return [];
  }

  if (section === 'markets') {
    if (action === '새 장/시장 추가') {
      return [
        { name: 'marketName', label: '장 이름', placeholder: '예: 게임 IP장' },
        { name: 'marketDescription', label: '장 설명', type: 'textarea', placeholder: '장 소개와 가격 변동 기준을 입력하세요.' },
        { name: 'icon', label: '아이콘', type: 'select', options: ['Radio', 'Mic2', 'Sparkles', 'Clapperboard', 'Gamepad2'] },
        { name: 'sortOrder', label: '정렬 순서', type: 'number', placeholder: '5' },
        { name: 'active', label: '생성 즉시 활성화', type: 'checkbox', defaultValue: 'true' },
      ];
    }
    if (action === '장/시장 수정') {
      return [
        { name: 'targetMarket', label: '수정할 장', type: 'select', options: marketOptions },
        { name: 'marketName', label: '변경 이름', placeholder: '변경하지 않으면 비워두기' },
        { name: 'marketDescription', label: '변경 설명', type: 'textarea', placeholder: '변경할 설명을 입력하세요.' },
        { name: 'sortOrder', label: '정렬 순서', type: 'number', placeholder: '1' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['변경 없음', '활성', '비활성'] },
      ];
    }
    if (action === '장/시장 비활성화') {
      return [
        { name: 'targetMarket', label: '비활성화할 장', type: 'select', options: marketOptions },
      ];
    }
    return [
      { name: 'targetMarket', label: '삭제할 장', type: 'select', options: marketOptions },
      { name: 'confirmText', label: '확인 문구', placeholder: '장 삭제' },
    ];
  }

  if (section === 'stocks') {
    if (action === '새 종목 상장') {
      return [
        { name: 'stockName', label: '종목명', placeholder: '예: 신규 종목', required: true },
        { name: 'market', label: '소속 장', type: 'select', options: marketOptions, required: true },
        { name: 'initialPrice', label: '초기 가격', type: 'number', placeholder: '10000', min: 0.0001, step: 0.0001, required: true },
        { name: 'totalSupply', label: '초기 발행량', type: 'number', placeholder: '1000000', min: 1, step: 1, required: true },
        { name: 'circulatingSupply', label: '초기 유통량', type: 'number', placeholder: '1000000', min: 0, step: 1 },
        { name: 'description', label: '설명', type: 'textarea', placeholder: '종목 설명을 입력하세요.' },
        { name: 'imageUrl', label: '이미지 URL', placeholder: 'https://...' },
        { name: 'tags', label: '태그', placeholder: '쉼표로 구분' },
        { name: 'volatility', label: '변동성 등급', type: 'select', options: ['S', 'A', 'B', 'C'] },
        { name: 'dividendEnabled', label: '배당 가능 종목', type: 'checkbox' },
        { name: 'dividendRate', label: '기본 배당률', type: 'number', placeholder: '0.01', min: 0, step: 0.0001 },
        { name: 'persistToSeed', label: '다음 시즌에도 유지', type: 'checkbox' },
      ];
    }
    if (action === '종목 수정') {
      return [
        { name: 'targetStock', label: '수정할 종목', type: 'select', options: stockOptions },
        { name: 'manualPrice', label: '수동 기준가', type: 'number', placeholder: '비워두면 유지' },
        { name: 'volatility', label: '변동성 등급', type: 'select', options: ['변경 없음', 'S', 'A', 'B', 'C'] },
        { name: 'dividendRate', label: '기본 배당률', type: 'number', placeholder: '비워두면 유지' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['변경 없음', '활성', '비활성'] },
      ];
    }
    if (action === '종목 비활성화') {
      return [
        { name: 'targetStock', label: '비활성화할 종목', type: 'select', options: stockOptions },
      ];
    }
    return [
      { name: 'targetStock', label: '상장폐지할 종목', type: 'select', options: stockOptions },
      { name: 'confirmText', label: '확인 문구', placeholder: '상장폐지' },
    ];
  }

  if (section === 'ai') {
    if (action === 'AI 계정 추가') {
      return [
        { name: 'nickname', label: 'AI 계정 이름', placeholder: '예: AI 공격형 1호', required: true, maxLength: 32 },
        {
          name: 'strategyType',
          label: '투자 성향',
          type: 'select',
          options: [
            { label: '공격형', value: 'AGGRESSIVE' },
            { label: '안정형', value: 'STABLE' },
            { label: '랜덤형', value: 'RANDOM' },
            { label: '특정 장 집중형', value: 'MARKET_FOCUSED' },
          ],
          defaultValue: 'AGGRESSIVE',
          required: true,
        },
        {
          name: 'preferredMarketIds',
          label: '선호 장 (복수 선택)',
          type: 'multiselect',
          options: marketOptions,
          defaultValue: '',
          maxItems: 20,
          placeholder: '전체 시장 (선택 없음)',
        },
        { name: 'riskLevel', label: '위험도 (1~10)', type: 'number', defaultValue: '7', min: 1, max: 10, step: 1, required: true },
        { name: 'initialCash', label: '초기 자금', type: 'number', defaultValue: '1000000', min: 0, step: 10000, required: true },
      ];
    }
    if (action === 'AI 계정 수정') {
      return [
        { name: 'targetAi', label: '수정할 AI', type: 'select', options: aiOptions },
        { name: 'nickname', label: '변경 이름', placeholder: '비워두면 유지', maxLength: 32 },
        {
          name: 'strategyType',
          label: '투자 성향',
          type: 'select',
          options: [
            blankSelectOption('변경 없음'),
            { label: '공격형', value: 'AGGRESSIVE' },
            { label: '안정형', value: 'STABLE' },
            { label: '랜덤형', value: 'RANDOM' },
            { label: '특정 장 집중형', value: 'MARKET_FOCUSED' },
          ],
          defaultValue: '',
        },
        {
          name: 'preferredMarketIds',
          label: '변경할 선호 장 (복수 선택)',
          type: 'multiselect',
          options: marketOptions,
          defaultValue: '',
          maxItems: 20,
          placeholder: '선택하지 않으면 유지',
        },
        { name: 'clearPreferredMarkets', label: '선호 장 설정 초기화', type: 'checkbox' },
        { name: 'riskLevel', label: '위험도 (1~10)', type: 'number', placeholder: '비워두면 유지', min: 1, max: 10, step: 1 },
        { name: 'initialCash', label: '초기 자금', type: 'number', placeholder: '비워두면 유지', min: 0, step: 10000 },
      ];
    }
    if (action === 'AI 계정 비활성화') {
      return [
        { name: 'targetAi', label: '비활성화할 AI', type: 'select', options: aiOptions.filter((option) => Boolean(toSelectOption(option).value)) },
        { name: 'confirmText', label: '확인 문구', placeholder: 'AI 비활성화' },
      ];
    }
    return [
      { name: 'targetAi', label: '리밸런싱 대상', type: 'select', options: aiOptions },
    ];
  }

  if (section === 'scenarios') {
    if (action === '메인 시나리오 생성 요청') {
      return [
        { name: 'targetMarket', label: '영향 장', type: 'select', options: [blankSelectOption('전체 시장'), ...marketOptions] },
        { name: 'promptHint', label: '생성 힌트', type: 'textarea', placeholder: 'GPT에 전달할 맥락을 입력하세요.' },
      ];
    }
    if (action === 'BIG 시나리오 생성 요청') {
      return [
        { name: 'targetMarket', label: '영향 장', type: 'select', options: [blankSelectOption('전체'), ...marketOptions] },
        { name: 'targetStock', label: '핵심 종목', type: 'select', options: [blankSelectOption('자동 선택'), ...stockOptions] },
        { name: 'promptHint', label: '생성 힌트', type: 'textarea', placeholder: 'BIG 시나리오에 사용할 맥락을 입력하세요.' },
      ];
    }
    if (action === '소규모 시나리오 생성 요청') {
      return [
        { name: 'targetStock', label: '대상 종목', type: 'select', options: stockOptions },
        { name: 'promptHint', label: '생성 힌트', type: 'textarea', placeholder: '작은 이슈나 커뮤니티 반응을 입력하세요.' },
      ];
    }
    if (action === '시나리오 적용') {
      return [
        { name: 'scenarioId', label: '적용할 시나리오', type: 'select', options: scenarioOptions },
      ];
    }
    return [];
  }

  if (section === 'dividends') {
    if (action === '배당금 정책 설정') {
      return [
        { name: 'baseDividendRate', label: '기본 배당률', type: 'number', placeholder: '0.01' },
        { name: 'claimCountMultiplier', label: '수령 횟수별 증가율', type: 'number', placeholder: '0.1' },
        { name: 'claimCooldownMinutes', label: '수령 쿨타임(분)', type: 'number', placeholder: '1440' },
        { name: 'seasonalClaimLimit', label: '시즌 수령 제한', type: 'number', placeholder: '30' },
        { name: 'isEnabled', label: '자동 지급 활성화', type: 'checkbox', defaultValue: 'true' },
      ];
    }
    if (action === '배당 지급 스케줄 설정') {
      return [
        { name: 'nextRunAt', label: '다음 자동 지급 ISO 시각', placeholder: '2026-07-09T03:00:00.000Z' },
        { name: 'isEnabled', label: '자동 지급 활성화', type: 'checkbox', defaultValue: 'true' },
      ];
    }
    if (action === '다음 지급 시각 변경') {
      return [
        { name: 'nextRunAt', label: '다음 자동 지급 ISO 시각', placeholder: '2026-07-09T03:00:00.000Z' },
      ];
    }
    if (action === '지급 스케줄 일시정지') {
      return [
        { name: 'scheduleStatus', label: '변경 상태', type: 'select', options: ['일시정지', '활성화'] },
      ];
    }
    return [];
  }

  if (section === 'users') {
    if (action === '유저 권한 변경') {
      return [
        { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions.filter((option) => toSelectOption(option).label !== '전체 사용자') },
        { name: 'role', label: '변경 권한', type: 'select', options: ['일반 사용자', '관리자'] },
      ];
    }
    if (action === '유저 거래 제한') {
      return [
        { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions.filter((option) => toSelectOption(option).label !== '전체 사용자') },
      ];
    }
    if (action === '랭킹 초기화') {
      return [
        { name: 'confirmText', label: '확인 문구', placeholder: '랭킹 초기화' },
      ];
    }
    return [];
  }

  return [];
}

const tooltipStyle = {
  background: '#101b2d',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#eef7ff',
};
