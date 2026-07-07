import { Activity, CalendarDays, Clock3, Heart, Info, ReceiptText, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Change, ScenarioCard, StatCard } from '../components/Cards';
import { TradePanel } from '../components/TradePanel';
import { useFandexStore } from '../store/useFandexStore';
import type { Stock } from '../types';
import { compact, currency, dateTime } from '../utils/format';

type ChartRange = 'day' | 'hour' | 'minute';

const chartRanges: Array<{ key: ChartRange; label: string; caption: string; icon: typeof CalendarDays }> = [
  { key: 'day', label: '일', caption: '14일', icon: CalendarDays },
  { key: 'hour', label: '시간', caption: '24시간', icon: Clock3 },
  { key: 'minute', label: '분', caption: '60분', icon: Timer },
];

export function StockDetailPage() {
  const { stockId } = useParams();
  const { stocks, markets, user, scenarios, dividendSchedule, toggleFavorite, placeOrder, notify } = useFandexStore();
  const [chartRange, setChartRange] = useState<ChartRange>('day');
  const stock = stocks.find((item) => item.id === stockId);
  const chart = useMemo(() => (stock ? createPriceSeries(stock, chartRange) : []), [stock, chartRange]);
  if (!stock) return <Navigate to="/markets" replace />;
  const market = markets.find((item) => item.id === stock.marketId);
  const holding = user?.holdings.find((item) => item.stockId === stock.id);
  const pnl = holding ? (stock.price - holding.averagePrice) * holding.quantity : 0;
  const chartStart = chart[0]?.price ?? stock.previousClose;
  const chartEnd = chart[chart.length - 1]?.price ?? stock.price;
  const chartHigh = Math.max(...chart.map((point) => point.price));
  const chartLow = Math.min(...chart.map((point) => point.price));
  const chartMoveRate = chartStart > 0 ? ((chartEnd - chartStart) / chartStart) * 100 : 0;
  const chartVolume = chart.reduce((sum, point) => sum + point.volume, 0);
  const chartPadding = Math.max(250, stock.price * 0.04);
  const activeRange = chartRanges.find((item) => item.key === chartRange) ?? chartRanges[0];
  const gradientId = `price-${stock.id}-${chartRange}`;

  return (
    <div className="page">
      <section className="detail-hero">
        <img src={stock.imageUrl} alt="" />
        <div>
          <span className="eyebrow">{market?.name}</span>
          <h1>{stock.name}</h1>
          <p>{stock.description}</p>
          <div className="tag-list">{stock.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </div>
        <button className="secondary-button" onClick={() => toggleFavorite(stock.id)}>
          <Heart size={18} fill={user?.favoriteStockIds.includes(stock.id) ? 'currentColor' : 'none'} /> 즐겨찾기
        </button>
      </section>
      <section className="stat-grid">
        <StatCard label="현재 가격" value={currency(stock.price)} hint={stock.symbol} />
        <StatCard label="전일 대비" value={`${stock.price - stock.previousClose > 0 ? '+' : ''}${currency(stock.price - stock.previousClose)}`} hint={`${stock.changeRate.toFixed(2)}%`} />
        <StatCard label="최근 거래량" value={compact(stock.volume)} />
        <StatCard label="평가 손익" value={currency(pnl)} hint={holding ? `${holding.quantity}주 보유` : '미보유'} />
      </section>
      <section className="detail-grid">
        <article className="panel wide stock-chart-panel">
          <div className="stock-chart-head">
            <div>
              <div className="panel-title"><ReceiptText size={20} /><h2>가격 차트</h2><Change value={chartMoveRate} /></div>
              <p className="panel-copy">{stock.symbol} 가격 흐름 · {activeRange.caption} 단위</p>
            </div>
            <div className="chart-range-toggle" aria-label="차트 기간 선택">
              {chartRanges.map(({ key, label, icon: Icon }) => (
                <button key={key} className={chartRange === key ? 'active' : ''} onClick={() => setChartRange(key)} type="button">
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="stock-chart-kpis">
            <span>고가 <strong>{currency(chartHigh)}</strong></span>
            <span>저가 <strong>{currency(chartLow)}</strong></span>
            <span>거래 강도 <strong>{compact(chartVolume)}</strong></span>
            <span>변동폭 <strong>{currency(Math.abs(chartEnd - chartStart))}</strong></span>
          </div>

          <div className="chart-box stock-chart-box">
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={chart} margin={{ top: 18, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cff" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="#38d5ff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 8" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: '#7890ad', fontSize: 12 }} />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  domain={[chartLow - chartPadding, chartHigh + chartPadding]}
                  tick={{ fill: '#7890ad', fontSize: 12 }}
                  tickFormatter={(value) => `₩${compact(Number(value))}`}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(56, 213, 255, 0.36)', strokeWidth: 1 }}
                  contentStyle={{
                    border: '1px solid rgba(56, 213, 255, 0.22)',
                    borderRadius: 8,
                    background: '#101b2d',
                    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.32)',
                  }}
                  labelStyle={{ color: '#98abc5' }}
                  formatter={(value) => [currency(Number(value)), '가격']}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#38d5ff"
                  fill={`url(#${gradientId})`}
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: '#dff8ff', fill: '#38d5ff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="stock-chart-status">
            <span><Activity size={15} /> {chartMoveRate >= 0 ? '매수세 우위' : '매도세 우위'}</span>
            <span>{activeRange.caption} 기준</span>
          </div>
          <div className="metadata">
            <h3>관리자 메타데이터</h3>
            {Object.entries(stock.metadata).map(([key, value]) => (
              <span key={key}>{key}: {value}</span>
            ))}
          </div>
        </article>
        <TradePanel
          stock={stock}
          ownedQuantity={holding?.quantity ?? 0}
          cash={user?.cash ?? 0}
          onOrder={(type, quantity) => {
            if (quantity === 0) {
              notify('조건 주문이 등록되었습니다.');
              return;
            }
            placeOrder(stock.id, type, quantity);
          }}
        />
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-title"><Info size={20} /><h2>배당금 정보</h2></div>
          <p className="panel-copy">
            {stock.dividendEnabled
              ? `기본 배당률 ${stock.dividendRate}%가 적용됩니다. 관리자 설정 스케줄에 따라 자동 지급됩니다.`
              : '이 종목은 현재 배당을 지원하지 않습니다.'}
          </p>
          <div className="schedule-summary compact">
            <span>상태 <strong>{stock.dividendEnabled ? '자동 지급' : '미지원'}</strong></span>
            <span>다음 지급 <strong>{stock.dividendEnabled && dividendSchedule ? dateTime(dividendSchedule.nextPayoutAt) : '-'}</strong></span>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><ReceiptText size={20} /><h2>최근 시나리오 로그</h2></div>
          {scenarios.filter((scenario) => scenario.affectedStockIds.includes(stock.id)).map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} stockNames={[stock.name]} />
          ))}
        </article>
      </section>
    </div>
  );
}

function createPriceSeries(stock: Stock, range: ChartRange) {
  const config = {
    day: {
      points: 14,
      start: stock.previousClose,
      amplitude: 0.024,
      label: (index: number) => `${index + 1}일`,
    },
    hour: {
      points: 24,
      start: stock.price * (1 - stock.changeRate / 100 * 0.36),
      amplitude: 0.012,
      label: (index: number) => `${String(index).padStart(2, '0')}시`,
    },
    minute: {
      points: 30,
      start: stock.price * (1 - stock.changeRate / 100 * 0.08),
      amplitude: 0.0055,
      label: (index: number) => `${index * 2}분`,
    },
  }[range];

  return Array.from({ length: config.points }, (_, index) => {
    const progress = index / (config.points - 1);
    const trend = config.start + (stock.price - config.start) * progress;
    const wave = Math.sin(index * 0.82 + stock.symbol.length) * stock.price * config.amplitude;
    const pulse = Math.cos(index * 1.37 + stock.name.length) * stock.price * config.amplitude * 0.42;
    const price = index === config.points - 1 ? stock.price : Math.max(1, Math.round(trend + wave + pulse));
    const volume = Math.round((stock.volume / config.points) * (0.72 + Math.abs(Math.sin(index * 1.18)) * 0.74 + progress * 0.22));

    return {
      label: config.label(index),
      price,
      volume,
    };
  });
}
