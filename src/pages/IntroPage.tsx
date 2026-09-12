import { ArrowRight, Bot, CalendarClock, ChevronRight, Coins, Gauge, LineChart, Play, Sparkles, WalletCards, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketUniverse } from '../components/MarketUniverse';
import { useFandexStore } from '../store/useFandexStore';
import { compact } from '../utils/format';

const flowSteps: Array<[string, string, LucideIcon]> = [
  ['이벤트 공개', '시장 이벤트가 사용자와 AI 투자자에게 전달됩니다.', Sparkles],
  ['주문 판단', '각 참여자가 독립적으로 매수 또는 매도 주문을 제출합니다.', Bot],
  ['Backend 체결', 'Market Engine이 주문을 검증하고 거래를 체결합니다.', Coins],
  ['시세 반영', '체결 가격과 거래량이 시장 데이터로 다시 제공됩니다.', LineChart],
];

export function IntroPage() {
  const { markets, stocks, rankings } = useFandexStore();
  const [activeMarket, setActiveMarket] = useState(0);
  const active = markets[activeMarket];
  const marketStocks = active ? stocks.filter((stock) => stock.marketId === active.id) : [];
  const volumeLeader = [...marketStocks].sort((a, b) => b.volume - a.volume)[0];

  useEffect(() => {
    if (activeMarket >= markets.length) setActiveMarket(0);
  }, [activeMarket, markets.length]);

  return (
    <div className="intro-page">
      <section className="intro-hero">
        <MarketUniverse activeMarket={activeMarket} />
        <div className="intro-hero-shade" />
        <div className="intro-hero-content">
          <span className="eyebrow">Virtual Fandom Exchange</span>
          <h1>V-FANDEX</h1>
          <p>TRADE FANDOM. GROW TOGETHER.</p>
          <p>사용자와 AI Agent가 같은 Backend Market Engine에서 거래하는 실시간 팬덤 시장 시뮬레이션입니다.</p>
          <div className="intro-hero-actions">
            <Link className="primary-button" to="/dashboard"><Play size={18} /> 거래소 입장</Link>
            <Link className="secondary-button" to="/markets"><Gauge size={18} /> 시장 탐색</Link>
          </div>
        </div>
        <div className="intro-hero-stats">
          <span>운영 Market <strong>{markets.length}개</strong></span>
          <span>상장 종목 <strong>{stocks.length}개</strong></span>
          <span>랭킹 참여자 <strong>{rankings.length}명</strong></span>
        </div>
      </section>

      <section className="intro-market-strip" aria-label="Market 선택">
        {markets.length ? markets.map((market, index) => (
          <button key={market.id} className={activeMarket === index ? 'active' : ''} onClick={() => setActiveMarket(index)}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{market.name}</strong>
            <small>{market.description}</small>
          </button>
        )) : <p className="panel-copy">Backend에서 활성 Market을 불러오면 이곳에 표시됩니다.</p>}
      </section>

      <section className="intro-dashboard">
        <article className="intro-sim-panel">
          <div className="intro-sim-header">
            <div className="panel-title"><LineChart size={20} /><h2>Backend Market Snapshot</h2></div>
            <span className="intro-live-pill">API DATA</span>
          </div>
          {active ? (
            <>
              <div className="intro-sim-market">
                <span>{String(activeMarket + 1).padStart(2, '0')}</span>
                <div><strong>{active.name}</strong><small>{active.description}</small></div>
                <em>{active.active ? 'ACTIVE' : 'INACTIVE'}</em>
              </div>
              <div className="intro-sim-meters">
                <span><small>상장 종목</small><strong>{active.stockCount}개</strong></span>
                <span><small>거래량 상위</small><strong>{volumeLeader?.name ?? '-'}</strong></span>
                <span><small>시장 지수</small><strong>{active.metricsAvailable ? `${active.changeRate.toFixed(2)}%` : 'API 대기'}</strong></span>
              </div>
              <p className="panel-copy">Market 종류는 프론트엔드에 고정하지 않고 Backend 응답으로 구성됩니다.</p>
            </>
          ) : <p className="panel-copy">표시할 Market 데이터가 없습니다.</p>}
        </article>

        <article className="intro-flow-panel">
          <div className="panel-title"><Sparkles size={20} /><h2>가격이 형성되는 방식</h2></div>
          {flowSteps.map(([title, body, Icon], index) => (
            <div className="intro-flow-row" key={title}>
              <span>{index + 1}</span><Icon size={18} />
              <div><strong>{title}</strong><small>{body}</small></div>
              <ChevronRight size={18} />
            </div>
          ))}
        </article>
      </section>

      <section className="intro-feature-grid">
        <Feature icon={<WalletCards size={22} />} title="실제 포트폴리오 응답" copy="현금, 보유 수량, 평균 매수가와 Backend가 제공한 현재가를 기준으로 현황을 표시합니다." />
        <Feature icon={<Bot size={22} />} title="AI 투자자와 경쟁" copy="AI 내부 판단은 Backend에 두고 공개된 자산, 수익률, 순위만 확인합니다." />
        <Feature icon={<CalendarClock size={22} />} title="실시간 확장 준비" copy="WebSocket 계약이 제공되면 종목 단위 구독과 안전한 재연결을 추가할 수 있습니다." />
      </section>

      <section className="intro-cta">
        <div><span className="eyebrow">Enter Market</span><h2>팬덤의 선택이 주문과 체결을 통해 시장이 됩니다.</h2></div>
        <Link className="primary-button" to="/markets">Market 보기 <ArrowRight size={18} /></Link>
      </section>

      <div className="intro-ticker" aria-hidden="true">
        <span>MARKETS {markets.length}</span>
        <span>LISTED STOCKS {stocks.length}</span>
        <span>TOP STOCK VOLUME {compact(Math.max(...stocks.map((stock) => stock.volume), 0))}</span>
        <span>AI & USER RANKING</span>
      </div>
    </div>
  );
}

function Feature({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <article className="intro-feature">{icon}<h3>{title}</h3><p>{copy}</p></article>;
}
