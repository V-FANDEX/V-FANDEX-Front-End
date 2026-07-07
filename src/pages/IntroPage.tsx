import { Activity, ArrowRight, Bot, CalendarClock, ChevronRight, Coins, Gauge, LineChart, Play, Sparkles, Trophy, WalletCards, Zap, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MarketUniverse } from '../components/MarketUniverse';
import { useFandexStore } from '../store/useFandexStore';
import { compact, currency } from '../utils/format';

const introMarkets = [
  { name: '버츄얼 & 스트리머장', tone: '라이브 이슈와 팬덤 화력이 가격을 움직입니다.' },
  { name: '가수장', tone: '컴백, 콘서트, 차트 흐름이 종목의 분위기를 만듭니다.' },
  { name: '캐릭터장', tone: '굿즈, 콜라보, 밈 확산이 빠르게 반영됩니다.' },
  { name: '애니메이션장', tone: '방영 소식과 극장판 루머가 시장을 흔듭니다.' },
];

const flowSteps: Array<[string, string, LucideIcon]> = [
  ['이슈 발생', 'GPT 시나리오가 장과 종목에 영향을 줍니다.', Sparkles],
  ['가격 반응', '가상 가격과 거래량이 팬덤 분위기에 따라 변합니다.', Coins],
  ['랭킹 경쟁', '사용자와 AI 계정이 같은 시즌 랭킹에서 경쟁합니다.', Trophy],
  ['자동 배당', '관리자가 지정한 시간에 회복형 배당이 지급됩니다.', CalendarClock],
];

export function IntroPage() {
  const { markets, stocks, rankings } = useFandexStore();
  const [activeMarket, setActiveMarket] = useState(0);
  const [sentiment, setSentiment] = useState(72);
  const [volatility, setVolatility] = useState(44);
  const totalCap = markets.reduce((sum, market) => sum + market.marketCap, 0);
  const projectedMoveValue = useMemo(() => (sentiment - 50) * 0.08 + volatility * 0.035, [sentiment, volatility]);
  const projectedMove = `${projectedMoveValue >= 0 ? '+' : ''}${projectedMoveValue.toFixed(2)}%`;
  const marketPulse = Math.min(100, Math.round(sentiment * 0.62 + volatility * 0.38));
  const tradePulse = Math.round((markets[activeMarket]?.volume ?? 0) * (0.72 + marketPulse / 100));
  const riskLabel = volatility >= 72 ? '급변' : volatility >= 46 ? '활성' : '안정';
  const heatLabel = sentiment >= 72 ? '과열' : sentiment >= 46 ? '관심' : '냉각';
  const active = introMarkets[activeMarket];
  const activeMarketSummary = markets[activeMarket];

  return (
    <div className="intro-page">
      <section className="intro-hero">
        <MarketUniverse activeMarket={activeMarket} sentiment={sentiment} volatility={volatility} />
        <div className="intro-hero-shade" />
        <div className="intro-hero-content">
          <span className="eyebrow">Virtual Fandom Exchange</span>
          <h1>V-FANDEX</h1>
          <p>팬덤 이슈, 가상 자산, AI 트레이더, 자동 배당 정책이 하나의 시즌 안에서 경쟁하는 가상 거래소입니다.</p>
          <div className="intro-hero-actions">
            <Link className="primary-button" to="/dashboard"><Play size={18} /> 거래소 입장</Link>
            <a className="secondary-button" href="#intro-simulator"><Gauge size={18} /> 시장 시뮬레이션</a>
          </div>
        </div>
        <div className="intro-hero-stats">
          <span>총 시가총액 <strong>{currency(totalCap)}</strong></span>
          <span>상장 종목 <strong>{stocks.length}개</strong></span>
          <span>랭킹 계정 <strong>{rankings.length}명</strong></span>
        </div>
      </section>

      <section className="intro-market-strip" aria-label="장 선택">
        {introMarkets.map((market, index) => (
          <button key={market.name} className={activeMarket === index ? 'active' : ''} onClick={() => setActiveMarket(index)}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{market.name}</strong>
            <small>{market.tone}</small>
          </button>
        ))}
      </section>

      <section className="intro-dashboard" id="intro-simulator">
        <article className="intro-sim-panel">
          <div className="intro-sim-header">
            <div className="panel-title"><LineChart size={20} /><h2>시장 시뮬레이션</h2></div>
            <span className="intro-live-pill">LIVE MODEL</span>
          </div>

          <div className="intro-sim-market">
            <span>{String(activeMarket + 1).padStart(2, '0')}</span>
            <div>
              <strong>{active.name}</strong>
              <small>{active.tone}</small>
            </div>
            <em>{activeMarketSummary ? compact(activeMarketSummary.volume) : '0'} VOL</em>
          </div>

          <div className="intro-control-stack">
            <label className="intro-slider">
              <span><em>팬덤 열기</em><strong>{sentiment}</strong></span>
              <input
                type="range"
                min="0"
                max="100"
                value={sentiment}
                style={{ background: `linear-gradient(90deg, var(--cyan) ${sentiment}%, rgba(255, 255, 255, 0.12) ${sentiment}%)` }}
                onChange={(event) => setSentiment(Number(event.target.value))}
              />
            </label>
            <label className="intro-slider">
              <span><em>변동성</em><strong>{volatility}</strong></span>
              <input
                type="range"
                min="0"
                max="100"
                value={volatility}
                style={{ background: `linear-gradient(90deg, var(--purple) ${volatility}%, rgba(255, 255, 255, 0.12) ${volatility}%)` }}
                onChange={(event) => setVolatility(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="intro-sim-meters">
            <span>
              <small>시장 온도</small>
              <strong>{heatLabel}</strong>
              <i><b style={{ width: `${sentiment}%` }} /></i>
            </span>
            <span>
              <small>체결 압력</small>
              <strong>{compact(tradePulse)}</strong>
              <i><b style={{ width: `${marketPulse}%` }} /></i>
            </span>
            <span>
              <small>리스크</small>
              <strong>{riskLabel}</strong>
              <i><b style={{ width: `${volatility}%` }} /></i>
            </span>
          </div>

          <div className="intro-sim-result">
            <div>
              <span>예상 변동률</span>
              <strong className={projectedMoveValue >= 0 ? 'positive' : 'negative'}>{projectedMove}</strong>
            </div>
            <div className="intro-result-score" style={{ background: `conic-gradient(var(--cyan) ${marketPulse * 3.6}deg, rgba(255, 255, 255, 0.08) 0deg)` }}>
              <span>{marketPulse}</span>
            </div>
            <small>시나리오 강도, 유저 주문, AI 계정의 거래 성향이 함께 반영됩니다.</small>
          </div>

          <div className="intro-sim-tags" aria-label="예상 시장 신호">
            <span><Zap size={14} /> {heatLabel} 신호</span>
            <span><Activity size={14} /> {riskLabel} 장세</span>
            <span><Gauge size={14} /> {projectedMoveValue >= 0 ? '매수 우위' : '매도 우위'}</span>
          </div>
        </article>

        <article className="intro-flow-panel">
          <div className="panel-title"><Sparkles size={20} /><h2>시즌이 움직이는 방식</h2></div>
          {flowSteps.map(([title, body, Icon], index) => (
            <div className="intro-flow-row" key={String(title)}>
              <span>{index + 1}</span>
              <Icon size={18} />
              <div>
                <strong>{title}</strong>
                <small>{body}</small>
              </div>
              <ChevronRight size={18} />
            </div>
          ))}
        </article>
      </section>

      <section className="intro-feature-grid">
        <Feature icon={<WalletCards size={22} />} title="가상 자산 포트폴리오" copy="현금, 보유 수량, 평균 매수가, 평가 손익을 시즌 단위로 추적합니다." />
        <Feature icon={<Bot size={22} />} title="AI 계정 관전" copy="AI 트레이더가 랭킹에 참여하고, 보유 종목과 수익률을 비교할 수 있습니다." />
        <Feature icon={<CalendarClock size={22} />} title="자동 배당 시스템" copy="관리자가 지급 주기와 시각을 설정하면 배당이 자동으로 처리됩니다." />
      </section>

      <section className="intro-cta">
        <div>
          <span className="eyebrow">Start Season</span>
          <h2>팬덤이 움직이는 시장을 직접 운영하고 경쟁하세요.</h2>
        </div>
        <Link className="primary-button" to="/dashboard">대시보드로 이동 <ArrowRight size={18} /></Link>
      </section>

      <div className="intro-ticker" aria-hidden="true">
        <span>VIRTUAL MARKET CAP {currency(totalCap)}</span>
        <span>TOP VOLUME {compact(Math.max(...markets.map((market) => market.volume), 0))}</span>
        <span>AI RANKING LIVE</span>
        <span>AUTO DIVIDEND SCHEDULED</span>
      </div>
    </div>
  );
}

function Feature({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <article className="intro-feature">
      {icon}
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}
