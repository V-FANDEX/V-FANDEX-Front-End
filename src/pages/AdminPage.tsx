import {
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
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
import { Change, StatCard } from '../components/Cards';
import { adminApi } from '../services/adminApi';
import { useFandexStore } from '../store/useFandexStore';
import type { AdminSection } from '../types/admin';
import type { DividendSchedule, RankingEntry } from '../types';
import { compact, currency, dateTime } from '../utils/format';

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
  options?: string[];
  defaultValue?: string;
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
  const { markets, stocks, rankings, scenarios, transactions, season, dividendSchedule, updateDividendSchedule, notify } = useFandexStore();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [actionRequest, setActionRequest] = useState<AdminActionRequest | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const totalCap = markets.reduce((sum, market) => sum + market.marketCap, 0);
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);
  const users = rankings.filter((entry) => entry.role !== 'ai');
  const aiAccounts = rankings.filter((entry) => entry.role === 'ai');
  const activeDividendStocks = stocks.filter((stock) => stock.dividendEnabled);

  const accountTypeData = useMemo(
    () => [
      { name: '사용자', value: users.length, color: '#38d5ff' },
      { name: 'AI', value: aiAccounts.length, color: '#7c5cff' },
      { name: '관리자', value: rankings.filter((entry) => entry.role === 'admin').length, color: '#42e3a3' },
    ],
    [aiAccounts.length, rankings, users.length],
  );

  const marketCapData = markets.map((market) => ({
    name: market.name.replace('장', ''),
    marketCap: market.marketCap,
    volume: market.volume,
  }));
  const openActionRequest = (action: string) => setActionRequest(createAdminActionRequest(activeSection, action));
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
      notify(`${actionRequest.action} 요청이 접수되었습니다. (${result.requestId})`);
      setActionRequest(null);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <span className="eyebrow">Admin Console</span>
          <h1>운영 센터</h1>
          <p>{season?.name} · DAY {season?.day}</p>
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
            <button className="secondary-button" onClick={() => notify('관리자 데이터가 새로고침되었습니다.')}>
              <RefreshCw size={17} /> 새로고침
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
            userCount={users.length}
            aiCount={aiAccounts.length}
            stockCount={stocks.length}
            activeMarketCount={markets.filter((market) => market.active).length}
            accountTypeData={accountTypeData}
            marketCapData={marketCapData}
          />
        )}
        {activeSection === 'season' && (
          <SeasonSection
            totalUsers={users.length}
            totalVolume={totalVolume}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'markets' && (
          <MarketsSection
            rows={markets.map((market) => [
              market.name,
              `${market.stockCount}개`,
              currency(market.marketCap),
              compact(market.volume),
              <Change key={market.id} value={market.changeRate} />,
            ])}
            onAction={openActionRequest}
          />
        )}
        {activeSection === 'stocks' && (
          <StocksSection
            rows={stocks.map((stock) => [
              stock.name,
              stock.symbol,
              currency(stock.price),
              <Change key={stock.id} value={stock.changeRate} />,
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
        {activeSection === 'dividends' && (
          <DividendSection
            schedule={dividendSchedule}
            dividendStockCount={activeDividendStocks.length}
            dividendTotal={transactions.filter((tx) => tx.type === 'dividend').reduce((sum, tx) => sum + tx.total, 0)}
            onAction={openActionRequest}
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
    </div>
  );
}

function OverviewSection({
  totalCap,
  totalVolume,
  userCount,
  aiCount,
  stockCount,
  activeMarketCount,
  accountTypeData,
  marketCapData,
}: {
  totalCap: number;
  totalVolume: number;
  userCount: number;
  aiCount: number;
  stockCount: number;
  activeMarketCount: number;
  accountTypeData: Array<{ name: string; value: number; color: string }>;
  marketCapData: Array<{ name: string; marketCap: number; volume: number }>;
}) {
  return (
    <>
      <section className="admin-kpi-grid">
        <StatCard label="전체 유저" value={`${userCount}명`} hint={`AI ${aiCount}개 별도 운영`} />
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
              <Tooltip formatter={(value, name) => [name === 'marketCap' ? currency(Number(value)) : compact(Number(value)), name === 'marketCap' ? '시가총액' : '거래량']} contentStyle={tooltipStyle} cursor={false} />
              <Bar dataKey="marketCap" fill="#7c5cff" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar purple' }} />
              <Bar dataKey="volume" fill="#38d5ff" radius={[8, 8, 0, 0]} activeBar={{ className: 'active-chart-bar cyan' }} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <OperationLog />
      </section>
    </>
  );
}

function SeasonSection({ totalUsers, totalVolume, onAction }: { totalUsers: number; totalVolume: number; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['시즌 상태', '진행 중'],
        ['지급 대상', `${totalUsers}명`],
        ['오늘 거래량', compact(totalVolume)],
      ]}
      actions={['시즌 초기화', '사용자 초기 자금 설정', '전체 사용자 초기 자금 지급', '전체 사용자 자금 리셋']}
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
      table={{ columns: ['장 이름', '종목 수', '시가총액', '거래량', '오늘'], rows }}
    />
  );
}

function StocksSection({ rows, onAction }: { rows: Array<Array<ReactNode>>; onAction: (message: string) => void }) {
  return (
    <AdminWorkArea
      summary={[
        ['상장 종목', `${rows.length}개`],
        ['배당 종목', `${rows.filter((row) => row[4] === '배당 가능').length}개`],
        ['검토 대기', '2건'],
      ]}
      actions={['새 종목 상장', '종목 수정', '종목 비활성화', '종목 상장폐지']}
      onAction={onAction}
      formTitle="종목 상장 폼"
      fields={['종목명', '소속 장', '초기 가격', '초기 발행량', '설명', '이미지 URL', '태그', '기본 배당률', '변동성 등급']}
      table={{ columns: ['종목', '심볼', '현재가', '등락률', '배당'], rows }}
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
      actions={['메인 시나리오 생성 요청', 'BIG 시나리오 생성 요청', '소규모 시나리오 생성 요청', '시나리오 적용 내역 확인']}
      onAction={onAction}
      formTitle="시나리오 생성 조건"
      fields={['시나리오 유형', '영향 장', '영향 종목', '변동 방향', '변동 강도']}
      table={{ columns: ['제목', '유형', '방향', '강도', '발생 시간'], rows }}
    />
  );
}

function DividendSection({
  schedule,
  dividendStockCount,
  dividendTotal,
  onAction,
}: {
  schedule?: DividendSchedule;
  dividendStockCount: number;
  dividendTotal: number;
  onAction: (message: string) => void;
}) {
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
            <SummaryItem label="다음 지급 시각" value={schedule ? dateTime(schedule.nextPayoutAt) : '-'} />
            <SummaryItem label="지급 주기" value={formatDividendFrequency(schedule?.frequency)} />
            <SummaryItem label="스케줄 상태" value={schedule?.status === 'active' ? '활성' : '일시정지'} />
            <SummaryItem label="최근 자동 지급" value={currency(dividendTotal)} />
          </div>
          <ActionGrid actions={['배당금 정책 설정', '배당 지급 스케줄 설정', '다음 지급 시각 변경', '지급 스케줄 일시정지', '수령 횟수 보정', '회복 계수 초기화']} onAction={onAction} />
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
      actions={['유저 권한 변경', '유저 거래 제한', '랭킹 초기화', '계정 활동 기록 확인']}
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
      nextPayoutAt: buildPayoutDateTime('', payoutTime, timezone),
    };
  }

  if (action === '다음 지급 시각 변경') {
    const payoutTime = String(values.payoutTime || '12:00');
    const timezone = String(values.timezone || 'UTC');
    return {
      payoutTime,
      timezone,
      nextPayoutAt: buildPayoutDateTime(String(values.nextPayoutDate || ''), payoutTime, timezone),
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
  const options = field.options ?? [];
  const [selected, setSelected] = useState(field.defaultValue ?? options[0] ?? '');
  const [open, setOpen] = useState(false);

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
          <span>{selected || field.placeholder || '선택'}</span>
          <ChevronDown size={17} />
        </button>
        {open && (
          <div className="admin-select-menu" role="listbox">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={selected === option ? 'selected' : ''}
                role="option"
                aria-selected={selected === option}
                onClick={() => {
                  setSelected(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {selected === option && <Check size={16} />}
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

function createAdminActionRequest(section: AdminSection, action: string): AdminActionRequest {
  return {
    section,
    action,
    title: action,
    description: getActionDescription(section, action),
    fields: getActionFields(section, action),
  };
}

function getActionDescription(section: AdminSection, action: string) {
  const sectionName = adminNavItems.find((item) => item.id === section)?.label ?? '관리자';
  const descriptions: Record<string, string> = {
    '시즌 초기화': '시즌 데이터, 랭킹, 주문 상태를 재시작하기 전에 보존 범위와 확인 문구를 검증합니다.',
    '사용자 초기 자금 설정': '신규/기존 사용자에게 적용할 초기 자금 정책을 변경합니다.',
    '전체 사용자 초기 자금 지급': '대상 사용자 그룹에 일괄 가상 자금을 지급합니다.',
    '전체 사용자 자금 리셋': '보유 현금과 미체결 주문을 기준값으로 되돌리는 위험 작업입니다.',
    '새 장/시장 추가': '새로운 팬덤 기반 장을 만들고 노출 순서와 활성 상태를 지정합니다.',
    '장/시장 수정': '기존 장의 이름, 설명, 정렬, 활성 상태를 수정합니다.',
    '장/시장 비활성화': '특정 장의 신규 거래를 막고 기존 주문 처리 방식을 정합니다.',
    '장/시장 삭제': '장을 아카이브하거나 다른 장으로 종목을 이관하는 위험 작업입니다.',
    '새 종목 상장': '초기 가격, 발행량, 배당 여부를 포함해 새 종목을 상장합니다.',
    '종목 수정': '상장 종목의 가격 정책, 변동성, 배당률, 활성 상태를 조정합니다.',
    '종목 비활성화': '특정 종목의 매수/매도 가능 여부를 제한합니다.',
    '종목 상장폐지': '최종 정산 방식과 가격을 지정해 종목을 상장폐지합니다.',
    'AI 계정 추가': '랭킹에 참여할 AI 계정과 투자 성향을 생성합니다.',
    'AI 계정 수정': '기존 AI 계정의 투자 성향, 선호 장, 운용 한도를 조정합니다.',
    'AI 계정 삭제': 'AI 계정 포트폴리오 정산과 활동 기록 보존 방식을 정합니다.',
    'AI 투자 성향 리밸런싱': 'AI 계정의 리스크 한도와 선호 장을 다시 배분합니다.',
    '메인 시나리오 생성 요청': '시장 흐름에 영향을 주는 메인 시나리오 생성을 요청합니다.',
    'BIG 시나리오 생성 요청': '강한 가격 충격을 주는 BIG 시나리오를 생성하고 즉시 적용 여부를 정합니다.',
    '소규모 시나리오 생성 요청': '개별 종목 중심의 짧은 시나리오를 생성합니다.',
    '시나리오 적용 내역 확인': '기간과 장 기준으로 적용된 시나리오 로그를 조회합니다.',
    '배당금 정책 설정': '배당률 상승 단계와 지급 대상 정책을 변경합니다.',
    '배당 지급 스케줄 설정': '사용자가 버튼을 누르지 않아도 지정된 시각에 배당금이 자동 지급되도록 설정합니다.',
    '다음 지급 시각 변경': '현재 스케줄은 유지하고 다음 1회 지급 예정 시각만 조정합니다.',
    '지급 스케줄 일시정지': '자동 배당 지급을 일시정지하거나 다시 활성화합니다.',
    '수령 횟수 보정': '특정 사용자/종목의 배당 수령 횟수를 수동 보정합니다.',
    '회복 계수 초기화': '손실 회복 보조 계수를 기본값으로 되돌립니다.',
    '유저 권한 변경': '사용자 권한과 관리자 접근 가능 여부를 변경합니다.',
    '유저 거래 제한': '특정 사용자의 거래 제한 범위와 시간을 설정합니다.',
    '랭킹 초기화': '랭킹 데이터를 초기화하고 시즌 기록 보존 여부를 선택합니다.',
    '계정 활동 기록 확인': '사용자 활동 로그를 기간과 거래 유형 기준으로 조회합니다.',
  };
  return descriptions[action] ?? `${sectionName}에서 "${action}" 요청을 보내기 전에 적용 값을 확인합니다.`;
}

const marketOptions = ['버츄얼 & 스트리머장', '가수장', '캐릭터장', '애니메이션장'];
const stockOptions = ['노바 린', '픽셀 민트', '루나 콰이어', '블루 아크 마스코트', '오리온 학원', '네온 아이돌즈'];
const aiOptions = ['ALPHA-팬덤퀀트', 'BETA-안정배당', '전체 AI 계정'];
const userOptions = ['플레이어01', '마루트레이더', '하루차트', '전체 사용자'];

function getActionFields(section: AdminSection, action: string): AdminActionField[] {
  const baseFields: AdminActionField[] = [
    { name: 'executeAt', label: '실행 시점', type: 'select', options: ['즉시 실행', '다음 정산 배치', '예약 실행'] },
    { name: 'requestReason', label: '요청 사유', type: 'textarea', placeholder: '운영 로그에 남길 사유를 입력하세요.' },
    { name: 'notifyUsers', label: '관련 사용자에게 알림 발송', type: 'checkbox', defaultValue: 'true' },
  ];
  const withBase = (fields: AdminActionField[]) => [...fields, ...baseFields];

  if (section === 'season') {
    if (action === '시즌 초기화') {
      return withBase([
        { name: 'newSeasonName', label: '새 시즌명', placeholder: '시즌 4: 신규 랠리' },
        { name: 'resetScope', label: '초기화 범위', type: 'select', options: ['랭킹+포트폴리오+주문', '랭킹만', '포트폴리오만'] },
        { name: 'initialCash', label: '초기 현금', type: 'number', placeholder: '10000000' },
        { name: 'preserveMarkets', label: '장/종목 데이터 보존', type: 'checkbox', defaultValue: 'true' },
        { name: 'confirmText', label: '확인 문구', placeholder: '시즌 초기화' },
      ]);
    }
    if (action === '사용자 초기 자금 설정') {
      return withBase([
        { name: 'targetGroup', label: '적용 대상', type: 'select', options: ['신규 가입자', '현재 시즌 전체 사용자', '손실 사용자'] },
        { name: 'initialCash', label: '초기 자금', type: 'number', placeholder: '10000000' },
        { name: 'applyMode', label: '적용 방식', type: 'select', options: ['기준값 변경', '현재 현금 덮어쓰기', '부족분만 보정'] },
        { name: 'minCashOnly', label: '현재 현금이 기준보다 낮은 사용자만 적용', type: 'checkbox' },
      ]);
    }
    if (action === '전체 사용자 초기 자금 지급') {
      return withBase([
        { name: 'payoutAmount', label: '지급 금액', type: 'number', placeholder: '1000000' },
        { name: 'targetGroup', label: '지급 대상', type: 'select', options: ['전체 사용자', '일반 사용자만', '손실 사용자만'] },
        { name: 'idempotencyKey', label: '중복 지급 방지 키', placeholder: 'season3-bonus-001' },
        { name: 'includeAdmins', label: '관리자 계정 포함', type: 'checkbox' },
      ]);
    }
    return withBase([
      { name: 'resetCash', label: '리셋 후 현금', type: 'number', placeholder: '10000000' },
      { name: 'targetGroup', label: '리셋 대상', type: 'select', options: ['전체 사용자', '일반 사용자만', '선택 사용자'] },
      { name: 'liquidateHoldings', label: '보유 종목도 청산', type: 'checkbox', defaultValue: 'true' },
      { name: 'cancelOrders', label: '미체결 조건 주문 취소', type: 'checkbox', defaultValue: 'true' },
      { name: 'confirmText', label: '확인 문구', placeholder: '자금 리셋' },
    ]);
  }

  if (section === 'markets') {
    if (action === '새 장/시장 추가') {
      return withBase([
        { name: 'marketName', label: '장 이름', placeholder: '예: 게임 IP장' },
        { name: 'marketDescription', label: '장 설명', type: 'textarea', placeholder: '장 소개와 가격 변동 기준을 입력하세요.' },
        { name: 'icon', label: '아이콘', type: 'select', options: ['Radio', 'Mic2', 'Sparkles', 'Clapperboard', 'Gamepad2'] },
        { name: 'sortOrder', label: '정렬 순서', type: 'number', placeholder: '5' },
        { name: 'active', label: '생성 즉시 활성화', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === '장/시장 수정') {
      return withBase([
        { name: 'targetMarket', label: '수정할 장', type: 'select', options: marketOptions },
        { name: 'marketName', label: '변경 이름', placeholder: '변경하지 않으면 비워두기' },
        { name: 'marketDescription', label: '변경 설명', type: 'textarea', placeholder: '변경할 설명을 입력하세요.' },
        { name: 'sortOrder', label: '정렬 순서', type: 'number', placeholder: '1' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['활성', '비활성', '변경 없음'] },
      ]);
    }
    if (action === '장/시장 비활성화') {
      return withBase([
        { name: 'targetMarket', label: '비활성화할 장', type: 'select', options: marketOptions },
        { name: 'haltMode', label: '거래 제한 방식', type: 'select', options: ['신규 주문 차단', '매수만 차단', '전체 거래 정지'] },
        { name: 'cancelOpenOrders', label: '미체결 주문 취소', type: 'checkbox', defaultValue: 'true' },
        { name: 'marketNotice', label: '공지 내용', type: 'textarea', placeholder: '사용자에게 표시할 운영 공지를 입력하세요.' },
      ]);
    }
    return withBase([
      { name: 'targetMarket', label: '삭제할 장', type: 'select', options: marketOptions },
      { name: 'migrationMarket', label: '종목 이관 장', type: 'select', options: ['아카이브만 수행', ...marketOptions] },
      { name: 'archiveSnapshot', label: '삭제 전 스냅샷 저장', type: 'checkbox', defaultValue: 'true' },
      { name: 'confirmText', label: '확인 문구', placeholder: '장 삭제' },
    ]);
  }

  if (section === 'stocks') {
    if (action === '새 종목 상장') {
      return withBase([
        { name: 'stockName', label: '종목명', placeholder: '예: 신규 종목' },
        { name: 'market', label: '소속 장', type: 'select', options: marketOptions },
        { name: 'initialPrice', label: '초기 가격', type: 'number', placeholder: '10000' },
        { name: 'initialSupply', label: '초기 발행량', type: 'number', placeholder: '1000000' },
        { name: 'volatility', label: '변동성 등급', type: 'select', options: ['S', 'A', 'B', 'C'] },
        { name: 'imageUrl', label: '이미지 URL', placeholder: 'https://...' },
        { name: 'dividendEnabled', label: '배당 가능 종목', type: 'checkbox' },
      ]);
    }
    if (action === '종목 수정') {
      return withBase([
        { name: 'targetStock', label: '수정할 종목', type: 'select', options: stockOptions },
        { name: 'manualPrice', label: '수동 기준가', type: 'number', placeholder: '비워두면 유지' },
        { name: 'volatility', label: '변동성 등급', type: 'select', options: ['변경 없음', 'S', 'A', 'B', 'C'] },
        { name: 'dividendRate', label: '기본 배당률', type: 'number', placeholder: '1.5' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['활성', '비활성', '변경 없음'] },
      ]);
    }
    if (action === '종목 비활성화') {
      return withBase([
        { name: 'targetStock', label: '비활성화할 종목', type: 'select', options: stockOptions },
        { name: 'haltMode', label: '제한 방식', type: 'select', options: ['매수만 차단', '매도만 차단', '전체 거래 정지'] },
        { name: 'cancelOpenOrders', label: '미체결 주문 취소', type: 'checkbox', defaultValue: 'true' },
        { name: 'haltReason', label: '비활성화 사유', type: 'textarea', placeholder: '운영상 비활성화 사유를 입력하세요.' },
      ]);
    }
    return withBase([
      { name: 'targetStock', label: '상장폐지할 종목', type: 'select', options: stockOptions },
      { name: 'settlementMethod', label: '정산 방식', type: 'select', options: ['현재가 현금 정산', '평균가 현금 정산', '보상 없이 아카이브'] },
      { name: 'finalPrice', label: '최종 정산가', type: 'number', placeholder: '비워두면 현재가' },
      { name: 'archiveHistory', label: '거래/시나리오 기록 보존', type: 'checkbox', defaultValue: 'true' },
      { name: 'confirmText', label: '확인 문구', placeholder: '상장폐지' },
    ]);
  }

  if (section === 'ai') {
    if (action === 'AI 계정 추가') {
      return withBase([
        { name: 'aiName', label: 'AI 계정 이름', placeholder: '예: GAMMA-모멘텀' },
        { name: 'initialCash', label: '초기 자금', type: 'number', placeholder: '10000000' },
        { name: 'profile', label: '투자 성향', type: 'select', options: ['공격형', '안정형', '랜덤형', '특정 장 집중형'] },
        { name: 'favoriteMarket', label: '선호 장', type: 'select', options: marketOptions },
        { name: 'active', label: '생성 즉시 랭킹 참여', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === 'AI 계정 수정') {
      return withBase([
        { name: 'targetAi', label: '수정할 AI', type: 'select', options: aiOptions },
        { name: 'profile', label: '투자 성향', type: 'select', options: ['공격형', '안정형', '랜덤형', '특정 장 집중형', '변경 없음'] },
        { name: 'favoriteMarket', label: '선호 장', type: 'select', options: ['변경 없음', ...marketOptions] },
        { name: 'cashLimit', label: '1일 운용 한도', type: 'number', placeholder: '3000000' },
        { name: 'activeState', label: '활성 상태', type: 'select', options: ['활성', '비활성', '변경 없음'] },
      ]);
    }
    if (action === 'AI 계정 삭제') {
      return withBase([
        { name: 'targetAi', label: '삭제할 AI', type: 'select', options: aiOptions.filter((option) => option !== '전체 AI 계정') },
        { name: 'settlementMethod', label: '포트폴리오 처리', type: 'select', options: ['전량 매도 후 삭제', '기록만 아카이브', '보유 종목 유지 후 비활성'] },
        { name: 'archiveHistory', label: '거래 기록 보존', type: 'checkbox', defaultValue: 'true' },
        { name: 'confirmText', label: '확인 문구', placeholder: 'AI 삭제' },
      ]);
    }
    return withBase([
      { name: 'targetAi', label: '리밸런싱 대상', type: 'select', options: aiOptions },
      { name: 'rebalanceMode', label: '리밸런싱 방식', type: 'select', options: ['시장 비중 재조정', '손실 종목 축소', '수익 종목 추세 추종', '랜덤 재분배'] },
      { name: 'riskLimit', label: '위험 한도', type: 'number', placeholder: '30' },
      { name: 'targetMarket', label: '집중 장', type: 'select', options: ['자동 선택', ...marketOptions] },
    ]);
  }

  if (section === 'scenarios') {
    if (action === '메인 시나리오 생성 요청') {
      return withBase([
        { name: 'targetMarket', label: '중심 장', type: 'select', options: ['전체 시장', ...marketOptions] },
        { name: 'theme', label: '시장 테마', placeholder: '예: 여름 이벤트, 콜라보 발표' },
        { name: 'direction', label: '시장 방향', type: 'select', options: ['상승', '하락', '혼합'] },
        { name: 'strength', label: '영향 강도', type: 'number', placeholder: '1~100' },
        { name: 'promptHint', label: '생성 힌트', type: 'textarea', placeholder: 'GPT에 전달할 맥락을 입력하세요.' },
      ]);
    }
    if (action === 'BIG 시나리오 생성 요청') {
      return withBase([
        { name: 'impactScope', label: '충격 범위', type: 'select', options: ['시장 전체', '특정 장', '특정 종목'] },
        { name: 'targetMarket', label: '영향 장', type: 'select', options: ['전체', ...marketOptions] },
        { name: 'targetStock', label: '핵심 종목', type: 'select', options: ['자동 선택', ...stockOptions] },
        { name: 'direction', label: '변동 방향', type: 'select', options: ['상승', '하락'] },
        { name: 'strength', label: '변동 강도', type: 'number', placeholder: '70~100' },
        { name: 'applyImmediately', label: '생성 즉시 가격에 반영', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === '소규모 시나리오 생성 요청') {
      return withBase([
        { name: 'targetStock', label: '대상 종목', type: 'select', options: stockOptions },
        { name: 'direction', label: '변동 방향', type: 'select', options: ['상승', '하락', '보합'] },
        { name: 'strength', label: '변동 강도', type: 'number', placeholder: '1~40' },
        { name: 'duration', label: '지속 시간', type: 'select', options: ['1시간', '3시간', '6시간', '하루'] },
        { name: 'promptHint', label: '생성 힌트', type: 'textarea', placeholder: '작은 이슈나 커뮤니티 반응을 입력하세요.' },
      ]);
    }
    return withBase([
      { name: 'fromDate', label: '조회 시작일', type: 'date' },
      { name: 'toDate', label: '조회 종료일', type: 'date' },
      { name: 'targetMarket', label: '조회 장', type: 'select', options: ['전체', ...marketOptions] },
      { name: 'scenarioType', label: '시나리오 유형', type: 'select', options: ['전체', 'MAIN', 'BIG', 'SMALL'] },
      { name: 'includePriceImpact', label: '가격 반영 결과 포함', type: 'checkbox', defaultValue: 'true' },
    ]);
  }

  if (section === 'dividends') {
    if (action === '배당금 정책 설정') {
      return withBase([
        { name: 'baseRate', label: '기본 배당률', type: 'number', placeholder: '1.2' },
        { name: 'growthStep', label: '수령 횟수별 증가율', type: 'number', placeholder: '0.15' },
        { name: 'maxRate', label: '최대 배당률', type: 'number', placeholder: '3.0' },
        { name: 'eligiblePolicy', label: '수령 대상', type: 'select', options: ['보유자 전체', '손실 보유자 우선', '배당 가능 종목 보유자'] },
      ]);
    }
    if (action === '배당 지급 스케줄 설정') {
      return withBase([
        { name: 'frequency', label: '지급 주기', type: 'select', options: ['매일', '매주', '매월'] },
        { name: 'payoutTime', label: '지급 시각', placeholder: '12:00' },
        { name: 'timezone', label: '기준 시간대', type: 'select', options: ['UTC', 'Asia/Seoul'] },
        { name: 'eligiblePolicy', label: '지급 대상', type: 'select', options: ['보유자 전체', '손실 보유자 우선', '배당 가능 종목 보유자'] },
        { name: 'enabled', label: '스케줄 즉시 활성화', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === '다음 지급 시각 변경') {
      return withBase([
        { name: 'nextPayoutDate', label: '다음 지급일', type: 'date' },
        { name: 'payoutTime', label: '다음 지급 시각', placeholder: '12:00' },
        { name: 'timezone', label: '기준 시간대', type: 'select', options: ['UTC', 'Asia/Seoul'] },
        { name: 'keepRecurringSchedule', label: '반복 스케줄은 유지', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === '지급 스케줄 일시정지') {
      return withBase([
        { name: 'scheduleStatus', label: '변경 상태', type: 'select', options: ['일시정지', '활성화'] },
        { name: 'pauseReason', label: '상태 변경 사유', type: 'textarea', placeholder: '자동 지급을 중단하거나 재개하는 사유를 입력하세요.' },
      ]);
    }
    if (action === '수령 횟수 보정') {
      return withBase([
        { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions },
        { name: 'targetStock', label: '대상 종목', type: 'select', options: ['전체 배당 종목', ...stockOptions] },
        { name: 'adjustment', label: '보정 횟수', type: 'number', placeholder: '1' },
        { name: 'adjustmentMode', label: '보정 방식', type: 'select', options: ['증가', '감소', '지정값으로 변경'] },
      ]);
    }
    return withBase([
      { name: 'resetScope', label: '초기화 범위', type: 'select', options: ['전체 사용자', '손실 사용자', '선택 사용자'] },
      { name: 'resetValue', label: '초기화 값', type: 'number', placeholder: '1.0' },
      { name: 'preserveClaimCount', label: '수령 횟수는 보존', type: 'checkbox', defaultValue: 'true' },
      { name: 'confirmText', label: '확인 문구', placeholder: '회복 계수 초기화' },
    ]);
  }

  if (section === 'users') {
    if (action === '유저 권한 변경') {
      return withBase([
        { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions.filter((option) => option !== '전체 사용자') },
        { name: 'role', label: '변경 권한', type: 'select', options: ['일반 사용자', '관리자', '거래 제한 계정'] },
        { name: 'expireAt', label: '권한 만료일', type: 'date' },
        { name: 'requireRelogin', label: '재로그인 요구', type: 'checkbox', defaultValue: 'true' },
      ]);
    }
    if (action === '유저 거래 제한') {
      return withBase([
        { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions.filter((option) => option !== '전체 사용자') },
        { name: 'restriction', label: '제한 범위', type: 'select', options: ['매수 제한', '매도 제한', '전체 거래 제한', '조건 주문 제한'] },
        { name: 'durationHours', label: '제한 시간', type: 'number', placeholder: '24' },
        { name: 'restrictionReason', label: '제한 사유', type: 'textarea', placeholder: '제한 사유와 해제 조건을 입력하세요.' },
      ]);
    }
    if (action === '랭킹 초기화') {
      return withBase([
        { name: 'rankingScope', label: '초기화 범위', type: 'select', options: ['전체 랭킹', '사용자 랭킹', 'AI 랭킹', '시즌별 랭킹'] },
        { name: 'preserveHistory', label: '시즌 히스토리 보존', type: 'checkbox', defaultValue: 'true' },
        { name: 'resetBadges', label: '최고 순위 기록도 초기화', type: 'checkbox' },
        { name: 'confirmText', label: '확인 문구', placeholder: '랭킹 초기화' },
      ]);
    }
    return withBase([
      { name: 'targetUser', label: '대상 유저', type: 'select', options: userOptions },
      { name: 'fromDate', label: '조회 시작일', type: 'date' },
      { name: 'toDate', label: '조회 종료일', type: 'date' },
      { name: 'activityType', label: '활동 유형', type: 'select', options: ['전체', '거래', '배당', '로그인', '관리자 조치'] },
      { name: 'includeRawLog', label: '원본 로그 포함', type: 'checkbox' },
    ]);
  }

  return baseFields;
}

const tooltipStyle = {
  background: '#101b2d',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#eef7ff',
};
