import { ArrowRight, Clapperboard, Mic2, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Change } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { compact, currency } from '../utils/format';

const icons = { Radio, Mic2, Sparkles, Clapperboard };

export function MarketListPage() {
  const markets = useFandexStore((state) => state.markets);

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Markets</span>
        <h1>장 목록</h1>
        <p>코스피/코스닥처럼 분리된 팬덤 기반 시장을 탐색하세요.</p>
      </header>
      <section className="market-grid">
        {markets.map((market) => {
          const Icon = icons[market.icon as keyof typeof icons] ?? Sparkles;
          return (
            <Link className="market-card" key={market.id} to={`/markets/${market.id}`}>
              <div className="market-icon"><Icon size={24} /></div>
              <div>
                <h2>{market.name}</h2>
                <p>{market.description}</p>
              </div>
              <dl>
                <div><dt>종목 수</dt><dd>{market.stockCount}</dd></div>
                <div><dt>시가총액</dt><dd>{currency(market.marketCap)}</dd></div>
                <div><dt>거래량</dt><dd>{compact(market.volume)}</dd></div>
                <div><dt>오늘</dt><dd><Change value={market.changeRate} /></dd></div>
              </dl>
              <ArrowRight className="card-arrow" size={20} />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
