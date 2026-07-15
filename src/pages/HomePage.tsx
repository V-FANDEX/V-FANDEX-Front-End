import { Activity, ArrowRight, BarChart3, Flame, Gem, LineChart, Star, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Change, RankingCard, ScenarioCard, StatCard, StockRow } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import type { Market, Stock } from '../types';
import { compact, currency } from '../utils/format';
import { getScenarioTargetLabels } from '../utils/scenarioLabels';

export function HomePage() {
  const { markets, stocks, user, season, scenarios, rankings, toggleFavorite } = useFandexStore();
  const totalMarketCap = markets.reduce((sum, market) => sum + market.marketCap, 0);
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);
  const assetValue =
    user?.totalAssetValue ??
    user?.holdings.reduce((sum, holding) => {
      const stock = holding.stock ?? stocks.find((item) => item.id === holding.stockId);
      return sum + (stock?.price ?? 0) * holding.quantity;
    }, user.cash) ?? 0;
  const gainers = [...stocks].sort((a, b) => b.changeRate - a.changeRate).slice(0, 3);
  const losers = [...stocks].sort((a, b) => a.changeRate - b.changeRate).slice(0, 3);
  const volumeLeaders = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const favorites = stocks.filter((stock) => user?.favoriteStockIds.includes(stock.id));
  const chartData = markets.map((market) => ({
    name: market.name.replace('장', ''),
    volume: market.volume,
    marketCap: market.marketCap,
  }));

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">Fandom Market Simulator</span>
          <h1>V-FANDEX</h1>
          <p>팬덤 이슈, GPT 시나리오, 배당 회복 시스템이 함께 움직이는 가상 거래소입니다.</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/markets"><LineChart size={18} /> 시장 탐색</Link>
            <Link className="secondary-button" to="/rankings"><Trophy size={18} /> 랭킹 보기</Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>현재 시즌</span>
          <strong>{season?.name}</strong>
          <small>DAY {season?.day} · {season?.startsAt} ~ {season?.endsAt}</small>
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="전체 시가총액" value={currency(totalMarketCap)} hint={`${markets.length}개 장 활성`} />
        <StatCard label="오늘 거래량" value={compact(totalVolume)} hint="AI 계정 포함" />
        <StatCard label="내 총 자산" value={currency(assetValue)} hint={`가상 현금 ${currency(user?.cash ?? 0)}`} />
        <StatCard label="급등 종목" value={gainers[0]?.name ?? '-'} hint={gainers[0] ? `${gainers[0].changeRate.toFixed(2)}%` : undefined} />
      </section>

      <div className="section-heading">
        <div>
          <span className="eyebrow">Market Pulse</span>
          <h2>장별 그래프</h2>
        </div>
        <Link to="/markets" className="text-link">전체 장 보기 <ArrowRight size={16} /></Link>
      </div>
      <section className="market-trend-grid">
        {markets.map((market, index) => (
          <MarketGraphCard
            key={market.id}
            market={market}
            index={index}
            leader={stocks.filter((stock) => stock.marketId === market.id).sort((a, b) => b.volume - a.volume)[0]}
          />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel wide">
          <div className="panel-title"><BarChart3 size={20} /><h2>장별 거래량 비교</h2></div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value, name) => [name === 'marketCap' ? currency(Number(value)) : compact(Number(value)), name === 'marketCap' ? '시가총액' : '거래량']}
                  contentStyle={{ background: '#101b2d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
                  cursor={false}
                />
                <Bar
                  dataKey="volume"
                  radius={[8, 8, 0, 0]}
                  fill="#38d5ff"
                />
                <Bar
                  dataKey="marketCap"
                  radius={[8, 8, 0, 0]}
                  fill="#7c5cff"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><Flame size={20} /><h2>오늘의 주요 변동</h2></div>
          {scenarios.slice(0, 2).map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} stockNames={getScenarioTargetLabels(scenario, stocks, markets)} />
          ))}
        </article>
      </section>

      <section className="dashboard-grid three">
        <StockMini title="급등 종목" icon={<Flame size={18} />} stocks={gainers} />
        <StockMini title="급락 종목" icon={<Activity size={18} />} stocks={losers} />
        <StockMini title="거래량 상위" icon={<Gem size={18} />} stocks={volumeLeaders.slice(0, 3)} />
      </section>

      <section className="panel">
        <div className="panel-title"><Star size={20} /><h2>즐겨찾기 종목</h2></div>
        <div className="stock-table">
          {favorites.map((stock) => (
            <StockRow
              key={stock.id}
              stock={stock}
              favorite
              onFavorite={() => void toggleFavorite(stock.id)}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-title"><Trophy size={20} /><h2>AI 계정 랭킹</h2></div>
          {rankings.filter((entry) => entry.role === 'ai').map((entry) => (
            <RankingCard key={entry.id} entry={entry} />
          ))}
        </article>
        <article className="panel">
          <div className="panel-title"><Trophy size={20} /><h2>사용자 랭킹</h2></div>
          {rankings.filter((entry) => entry.role !== 'ai').slice(0, 3).map((entry) => (
            <RankingCard key={entry.id} entry={entry} highlight={entry.id === user?.id} />
          ))}
        </article>
      </section>
    </div>
  );
}

function MarketGraphCard({ market, index, leader }: { market: Market; index: number; leader?: Stock }) {
  const trendData = buildMarketTrend(market, index);
  const gradientId = `marketTrend-${market.id}`;
  const stroke = market.changeRate >= 0 ? '#42e3a3' : '#ff647c';

  return (
    <Link to={`/markets/${market.id}`} className="market-graph-card">
      <div className="market-card-top">
        <div>
          <span className="eyebrow">{market.stockCount} Stocks</span>
          <h3>{market.name}</h3>
        </div>
        <Change value={market.changeRate} />
      </div>
      <div className="market-chart" aria-label={`${market.name} 추세 그래프`}>
        <ResponsiveContainer width="100%" height={132}>
          <AreaChart data={trendData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.36} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip
              formatter={(value) => currency(Number(value) * 1_000_000)}
              labelFormatter={(label) => `${label}일차`}
              contentStyle={{ background: '#101b2d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="value" stroke={stroke} fill={`url(#${gradientId})`} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="market-graph-meta">
        <span>시가총액 <strong>{currency(market.marketCap)}</strong></span>
        <span>거래량 <strong>{compact(market.volume)}</strong></span>
        <span>거래 주도 <strong>{leader?.name ?? '-'}</strong></span>
      </div>
    </Link>
  );
}

function buildMarketTrend(market: Market, index: number) {
  const base = market.marketCap / 1_000_000;
  const direction = market.changeRate >= 0 ? 1 : -1;
  const amplitude = Math.max(1.2, Math.abs(market.changeRate));

  return Array.from({ length: 12 }, (_, day) => {
    const wave = Math.sin((day + index) * 0.82) * amplitude * 0.34;
    const drift = direction * day * amplitude * 0.2;
    return {
      day: `${day + 1}`,
      value: Math.max(1, Math.round((base + wave + drift) * 10) / 10),
    };
  });
}

function StockMini({ title, icon, stocks }: { title: string; icon: React.ReactNode; stocks: { id: string; name: string; price: number; changeRate: number }[] }) {
  return (
    <article className="panel mini-list">
      <div className="panel-title">{icon}<h2>{title}</h2></div>
      {stocks.map((stock) => (
        <Link key={stock.id} to={`/stocks/${stock.id}`} className="mini-row">
          <span>{stock.name}</span>
          <strong>{currency(stock.price)}</strong>
          <small className={stock.changeRate >= 0 ? 'positive' : 'negative'}>{stock.changeRate.toFixed(2)}%</small>
        </Link>
      ))}
    </article>
  );
}
