import Decimal from 'decimal.js';
import { money } from '../utils/contracts';
import { Activity, ArrowRight, BarChart3, Flame, Gem, LineChart, Star, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Change, EmptyState, RankingCard, ScenarioCard, StatCard, StockRow } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import type { Market, Stock } from '../types';
import { compact, currency } from '../utils/format';
import { getScenarioTargetLabels } from '../utils/scenarioLabels';

export function HomePage() {
  const { marketIndices, markets, stocks, user, season, scenarios, rankings, toggleFavorite } = useFandexStore();
  const metricMarkets = markets.filter((market) => market.metricsAvailable);
  const totalMarketCap = metricMarkets.reduce((sum, market) => sum.plus(market.marketCapExact ?? 0), new Decimal(0)).toFixed();
  const totalVolume = metricMarkets.reduce((sum, market) => sum + market.volume, 0);
  const assetValue = user?.totalAssetValueExact ?? user?.cashExact;
  const gainers = [...stocks].sort((a, b) => b.changeRate - a.changeRate).slice(0, 3);
  const losers = [...stocks].sort((a, b) => a.changeRate - b.changeRate).slice(0, 3);
  const volumeLeaders = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const favorites = stocks.filter((stock) => user?.favoriteStockIds.includes(stock.id));
  const chartData = metricMarkets.map((market) => ({
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
          <p>팬덤, 금융시장, 게임 경험을 AI Agent 기반 자율 거래 시뮬레이션으로 연결합니다.</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/markets"><LineChart size={18} /> 시장 탐색</Link>
            <Link className="secondary-button" to="/ranking"><Trophy size={18} /> 랭킹 보기</Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>현재 시즌</span>
          <strong>{season?.name}</strong>
          <small>DAY {season?.day} · {season?.startsAt} ~ {season?.endsAt}</small>
        </div>
      </section>

      {marketIndices.length > 0 && <section className="stat-grid">{marketIndices.map(index => <StatCard key={String(index.marketId)} label={`${index.name} 지수`} value={index.value == null ? '—' : String(index.value)} hint={String(index.method)} />)}</section>}
      <section className="stat-grid">
        <StatCard label="전체 시가총액" value={metricMarkets.length ? currency(totalMarketCap) : '-'} hint={`${markets.length}개 장`} />
        <StatCard label="오늘 거래량" value={metricMarkets.length ? compact(totalVolume) : '-'} hint={metricMarkets.length ? 'Backend 시장 집계' : '시장 지수 API 연동 대기'} />
        <StatCard label="내 총 자산" value={money(assetValue)} hint={`가상 현금 ${money(user?.cashExact)}`} />
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
        {markets.map((market) => (
          <MarketGraphCard
            key={market.id}
            market={market}
            leader={stocks.filter((stock) => stock.marketId === market.id).sort((a, b) => b.volume - a.volume)[0]}
          />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel wide">
          <div className="panel-title"><BarChart3 size={20} /><h2>장별 거래량 비교</h2></div>
          {chartData.length ? <div className="chart-box">
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
          </div> : <EmptyState text="Backend 시장 집계 API가 아직 제공되지 않습니다." />}
        </article>
        <article className="panel">
          <div className="panel-title"><Flame size={20} /><h2>최근 시장 이벤트</h2></div>
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

function MarketGraphCard({ market, leader }: { market: Market; leader?: Stock }) {
  return (
    <Link to={`/markets/${market.id}`} className="market-graph-card">
      <div className="market-card-top">
        <div>
          <span className="eyebrow">{market.stockCount} Stocks</span>
          <h3>{market.name}</h3>
        </div>
        {market.metricsAvailable ? <Change value={market.changeRate} /> : <span className="pill">지수 대기</span>}
      </div>
      <div className="market-chart market-chart-unavailable" aria-label={`${market.name} 시장 요약`}>
        <LineChart size={28} />
        <span>시장 지수 시계열 API 연동 대기</span>
      </div>
      <div className="market-graph-meta">
        <span>시가총액 <strong>{market.metricsAvailable ? currency(market.marketCap) : '-'}</strong></span>
        <span>거래량 <strong>{market.metricsAvailable ? compact(market.volume) : '-'}</strong></span>
        <span>거래 주도 <strong>{leader?.name ?? '-'}</strong></span>
      </div>
    </Link>
  );
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
