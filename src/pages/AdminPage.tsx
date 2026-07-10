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
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
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
import { adminApi, type AdminMarketSimulationPayload } from '../services/adminApi';
import { useFandexStore } from '../store/useFandexStore';
import type { AdminSection } from '../types/admin';
import type {
  AdminDashboard,
  DividendSchedule,
  Market,
  MarketSimulationRunResult,
  MarketSimulationSettings,
  RankingEntry,
  ScenarioApplyResult,
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
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  options?: AdminSelectOption[];
  defaultValue?: string;
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

const adminNavItems: AdminNavItem[] = [
  { id: 'overview', label: '대시보드', description: '서비스 지표', icon: <BarChart3 size={18} /> },
  { id: 'season', label: '시즌 운영', description: '초기화/자금', icon: <CalendarClock size={18} /> },
  { id: 'markets', label: '장 관리', description: '시장 추가/수정', icon: <Building2 size={18} /> },
  { id: 'stocks', label: '종목 관리', description: '상장/비활성화', icon: <Coins size={18} /> },
  { id: 'ai', label: 'AI 계정', description: '성향/선호 장', icon: <Bot size={18} /> },
  { id: 'scenarios', label: '시나리오', description: 'GPT 생성/적용', icon: <Sparkles size={18} /> },
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
  const [marketSimulationSettings, setMarketSimulationSettings] = useState<MarketSimulationSettings>();
  const [marketSimulationResult, setMarketSimulationResult] = useState<MarketSimulationRunResult | null>(null);
  const [scenarioApplyResult, setScenarioApplyResult] = useState<ScenarioApplyResult | null>(null);
  const [seasonResetResult, setSeasonResetResult] = useState<SeasonResetResult | null>(null);
  const [isSimulationSaving, setIsSimulationSaving] = useState(false);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [isAdminDataLoading, setIsAdminDataLoading] = useState(false);
  const adminMarketsForView = adminMarkets.length ? adminMarkets : markets;
  const adminStocksForView = adminStocks.length ? adminStocks : stocks;
  const totalCap = adminDashboard?.totalMarketCap ?? adminMarketsForView.reduce((sum, market) => sum + market.marketCap, 0);
  const totalVolume = adminDashboard?.dailyTradeVolume ?? adminMarketsForView.reduce((sum, market) => sum + market.volume, 0);
  const users = useMemo(() => rankings.filter((entry) => entry.role !== 'ai'), [rankings]);
  const aiAccounts = useMemo(() => rankings.filter((entry) => entry.role === 'ai'), [rankings]);
  const activeDividendStocks = adminStocksForView.filter((stock) => stock.dividendEnabled);

  const refreshAdminData = useCallback(async (silent = false) => {
    setIsAdminDataLoading(true);
    try {
      const [dashboard, marketsData, stocksData, settingsData, simulationData] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getMarkets({ includeInactive: true }),
        adminApi.getStocks({ includeUnlisted: true }),
        adminApi.getDividendSettings(),
        adminApi.getMarketSimulationSettings(),
      ]);
      setAdminDashboard(dashboard);
      setAdminMarkets(marketsData);
      setAdminStocks(stocksData);
      setMarketSimulationSettings(simulationData);
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
        notify(`시즌 초기화 완료 · seed 종목 ${result.data.seedStocksApplied}개 적용`);
        const refreshResults = await Promise.allSettled([load(), refreshAdminData(true), adminApi.getSeasons()]);
        if (refreshResults.some((item) => item.status === 'rejected')) {
          notify('초기화는 완료됐지만 일부 데이터 새로고침에 실패했습니다. 새로고침을 눌러주세요.');
        }
        setActionRequest(null);
        return;
      } else {
        notify(`${actionRequest.action} 요청이 접수되었습니다. (${result.requestId})`);
        await Promise.all([load(), refreshAdminData(true)]);
      }
      setActionRequest(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : '관리자 요청 처리에 실패했습니다.');
    } finally {
      setIsSubmittingAction(false);
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
            rows={adminStocksForView.map((stock) => [
              stock.name,
              stock.market?.name ?? adminMarketsForView.find((market) => market.id === stock.marketId)?.name ?? '-',
              stock.symbol,
              currency(stock.price),
              compact(stock.volume),
              currency(stock.tradeValue),
              formatStockStatus(stock.status),
              stock.dividendEnabled ? '배당 가능' : '미지원',
            ])}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'ai' && (
          <AiSection
            aiAccounts={aiAccounts}
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
              <Bar dataKey="marketCap" fill="#7c5cff" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar purple' }} />
              <Bar dataKey="volume" fill="#38d5ff" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar cyan' }} />
              <Bar dataKey="tradeCount" fill="#42e3a3" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar cyan' }} />
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

function StocksSection({ rows, onAction }: { rows: Array<Array<ReactNode>>; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['상장 종목', `${rows.length}개`],
        ['배당 종목', `${rows.filter((row) => row[7] === '배당 가능').length}개`],
        ['관리 범위', '비상장 포함'],
      ]}
      actions={['새 종목 상장', '종목 수정', '종목 비활성화', '종목 상장폐지']}
      onAction={onAction}
      formTitle="종목 상장 폼"
      fields={['종목명', '소속 장', '초기 가격', '초기 발행량', '설명', '이미지 URL', '태그', '기본 배당률', '변동성 등급']}
      table={{ columns: ['종목', '소속 장', '심볼', '현재가', '거래량', '거래대금', '상태', '배당'], rows }}
    />
  );
}

function AiSection({ aiAccounts, onAction }: { aiAccounts: RankingEntry[]; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['AI 계정', `${aiAccounts.length}개`],
        ['평균 수익률', `${(aiAccounts.reduce((sum, entry) => sum + entry.returnRate, 0) / Math.max(aiAccounts.length, 1)).toFixed(1)}%`],
        ['리밸런싱', '대기 1건'],
      ]}
      actions={['AI 계정 추가', 'AI 계정 수정', 'AI 계정 삭제', 'AI 투자 성향 리밸런싱']}
      onAction={onAction}
      formTitle="AI 계정 추가"
      fields={['AI 계정 이름', '초기 자금', '투자 성향', '선호 장']}
      table={{ columns: ['AI 계정', '선호 장', '총 자산', '수익률', '거래량'], rows: aiAccounts.map((entry) => [entry.name, entry.favoriteMarket ?? '랜덤', currency(entry.totalAssets), `${entry.returnRate.toFixed(1)}%`, compact(entry.tradeVolume)]) }}
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

  const submitSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextRunAt = form.nextRunAt ? new Date(form.nextRunAt).toISOString() : undefined;
    const targetStockCountValue = Number(form.targetStockCount);
    const targetStockCount = form.targetStockCount.trim() && Number.isFinite(targetStockCountValue)
      ? Math.max(1, Math.trunc(targetStockCountValue))
      : null;
    void onSave({
      isEnabled: form.isEnabled,
      intervalMinutes: Math.max(1, Math.trunc(safeNumber(form.intervalMinutes, 5))),
      minChangeRate: safeNumber(form.minChangeRate, -7),
      maxChangeRate: safeNumber(form.maxChangeRate, 7),
      extremeMinRate: safeNumber(form.extremeMinRate, -80),
      extremeMaxRate: safeNumber(form.extremeMaxRate, 300),
      extremeChance: clamp(safeNumber(form.extremeChance, 0.04), 0, 1),
      volatilityWeight: Math.max(0, safeNumber(form.volatilityWeight, 1)),
      targetStockCount,
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

        <div className="simulation-form-grid">
          <SimulationNumberField
            label="실행 주기(분)"
            value={form.intervalMinutes}
            min={1}
            step={1}
            onChange={(value) => setField('intervalMinutes', value)}
          />
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

        <p className="simulation-note">서버가 깨어 있을 때 자동 실행됩니다. Render Free 환경에서는 sleep 상태일 때 스케줄러가 잠시 멈출 수 있습니다.</p>

        <div className="simulation-actions">
          <button className="secondary-button" type="button" onClick={() => void onRun()} disabled={isRunning || isSaving}>
            <RefreshCw size={17} /> {isRunning ? '실행 중' : '수동 실행'}
          </button>
          <button className="primary-button" type="submit" disabled={isSaving || isRunning}>
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
          <SummaryItem label="실행 주기" value={`${settings?.intervalMinutes ?? 5}분`} />
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
  onChange,
}: {
  label: string;
  value: string;
  min?: number;
  max?: number;
  step: number;
  placeholder?: string;
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
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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
              <Bar dataKey="rate" name="배당률" fill="#42e3a3" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar cyan' }} />
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

        {result.nextRunAt && <p className="simulation-note">다음 자동 실행 예정: {dateTime(result.nextRunAt)}</p>}

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
    ['seed 시장 적용', result.seedMarketsApplied],
    ['seed 종목 적용', result.seedStocksApplied],
    ['seed 가격 히스토리 생성', result.seedPriceHistoriesCreated],
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
            <h4>Seed 재적용</h4>
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
              seed에 없는 시장/종목, 보유 자산, 조건 주문, 관심 종목, 거래 내역, 배당 기록, 랭킹,
              시나리오, 시나리오 영향 기록, 가격 히스토리가 삭제됩니다.
            </p>
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
        <textarea name={field.name} placeholder={field.placeholder} defaultValue={field.defaultValue} />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <AdminActionSelect field={field} />
    );
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
      />
    </label>
  );
}

function AdminNumberInput({ field }: { field: AdminActionField }) {
  const [value, setValue] = useState(field.defaultValue ?? '');
  const step = inferNumberStep(field.name);

  const nudge = (direction: 1 | -1) => {
    const current = Number(value || 0);
    const next = Number.isFinite(current) ? current + step * direction : step * direction;
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
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" className="admin-number-button" onClick={() => nudge(1)} aria-label={`${field.label} 증가`}>
          <Plus size={15} />
        </button>
      </div>
    </label>
  );
}

function AdminActionSelect({ field }: { field: AdminActionField }) {
  const options = useMemo(() => (field.options ?? []).map(toSelectOption), [field.options]);
  const [selected, setSelected] = useState(field.defaultValue ?? options[0]?.value ?? '');
  const [open, setOpen] = useState(false);
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
          type="button"
          className="admin-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{selectedOption?.label || selected || field.placeholder || '선택'}</span>
          <ChevronDown size={17} />
        </button>
        {open && (
          <div className="admin-select-menu" role="listbox">
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
          </div>
        )}
      </div>
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
    'AI 계정 수정': '기존 AI 계정의 투자 성향, 위험도, 활성 상태를 조정합니다.',
    'AI 계정 삭제': 'AI 계정을 삭제하는 위험 작업입니다.',
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
const fallbackAiOptions: AdminSelectOption[] = ['ALPHA-팬덤퀀트', 'BETA-안정배당', '전체 AI 계정'];
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

function buildAiOptions(entries: RankingEntry[]): AdminSelectOption[] {
  if (!entries.length) return fallbackAiOptions;
  return [
    blankSelectOption('전체 AI 계정'),
    ...entries.map((entry) => ({
      label: entry.name,
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
        { name: 'stockName', label: '종목명', placeholder: '예: 신규 종목' },
        { name: 'market', label: '소속 장', type: 'select', options: marketOptions },
        { name: 'initialPrice', label: '초기 가격', type: 'number', placeholder: '10000' },
        { name: 'totalSupply', label: '초기 발행량', type: 'number', placeholder: '1000000' },
        { name: 'circulatingSupply', label: '초기 유통량', type: 'number', placeholder: '1000000' },
        { name: 'description', label: '설명', type: 'textarea', placeholder: '종목 설명을 입력하세요.' },
        { name: 'imageUrl', label: '이미지 URL', placeholder: 'https://...' },
        { name: 'tags', label: '태그', placeholder: '쉼표로 구분' },
        { name: 'volatility', label: '변동성 등급', type: 'select', options: ['S', 'A', 'B', 'C'] },
        { name: 'dividendEnabled', label: '배당 가능 종목', type: 'checkbox' },
        { name: 'dividendRate', label: '기본 배당률', type: 'number', placeholder: '0.01' },
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
        { name: 'aiName', label: 'AI 계정 이름', placeholder: '예: GAMMA-모멘텀' },
        { name: 'initialCash', label: '초기 자금', type: 'number', placeholder: '10000000' },
        { name: 'profile', label: '투자 성향', type: 'select', options: ['공격형', '안정형', '랜덤형', '특정 장 집중형'] },
        { name: 'favoriteMarket', label: '선호 장', type: 'select', options: marketOptions },
        { name: 'riskLevel', label: '위험도', type: 'number', placeholder: '50', defaultValue: '50' },
        { name: 'active', label: '생성 즉시 랭킹 참여', type: 'checkbox', defaultValue: 'true' },
      ];
    }
    if (action === 'AI 계정 수정') {
      return [
        { name: 'targetAi', label: '수정할 AI', type: 'select', options: aiOptions },
        { name: 'profile', label: '투자 성향', type: 'select', options: ['변경 없음', '공격형', '안정형', '랜덤형', '특정 장 집중형'] },
        { name: 'riskLevel', label: '위험도', type: 'number', placeholder: '비워두면 유지' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['변경 없음', '활성', '비활성'] },
      ];
    }
    if (action === 'AI 계정 삭제') {
      return [
        { name: 'targetAi', label: '삭제할 AI', type: 'select', options: aiOptions.filter((option) => toSelectOption(option).label !== '전체 AI 계정') },
        { name: 'confirmText', label: '확인 문구', placeholder: 'AI 삭제' },
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
