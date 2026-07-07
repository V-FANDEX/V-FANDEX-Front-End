import { ArrowDownRight, ArrowUpRight, BadgeCheck, Heart, HeartOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RankingEntry, ScenarioLog, Stock } from '../types';
import { compact, currency, dateTime, percent } from '../utils/format';

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export function StockRow({
  stock,
  favorite,
  onFavorite,
}: {
  stock: Stock;
  favorite: boolean;
  onFavorite: () => void;
}) {
  return (
    <div className="stock-row stock-list-row">
      <Link to={`/stocks/${stock.id}`} className="stock-title">
        <img src={stock.imageUrl} alt="" />
        <span>
          <strong>{stock.name}</strong>
          <small>{stock.symbol} · {stock.tags.join(' / ')}</small>
        </span>
      </Link>
      <strong className="stock-list-metric" data-label="현재가">{currency(stock.price)}</strong>
      <span className="stock-list-metric" data-label="등락률"><Change value={stock.changeRate} /></span>
      <span className="stock-list-metric" data-label="거래량">{compact(stock.volume)}</span>
      <span className="stock-list-metric" data-label="시가총액">{compact(stock.marketCap)}</span>
      <span className="stock-list-metric" data-label="배당"><span className={stock.dividendEnabled ? 'pill cyan' : 'pill'}>{stock.dividendEnabled ? '배당' : '미지원'}</span></span>
      <button className="icon-button stock-favorite-button" onClick={onFavorite} aria-label="즐겨찾기">
        {favorite ? <Heart size={18} fill="currentColor" /> : <HeartOff size={18} />}
      </button>
    </div>
  );
}

export function RankingCard({ entry, highlight }: { entry: RankingEntry; highlight?: boolean }) {
  return (
    <article className={highlight ? 'ranking-card highlight' : 'ranking-card'}>
      <span className="rank">#{entry.rank}</span>
      <div className="ranking-identity">
        <strong>{entry.name}</strong>
        <small>{entry.role === 'ai' ? 'AI 계정' : entry.role === 'admin' ? '관리자' : '사용자'}</small>
      </div>
      {entry.role === 'ai' && <span className="pill purple">AI</span>}
      <span className="ranking-assets">{currency(entry.totalAssets)}</span>
      <span className="ranking-return"><Change value={entry.returnRate} /></span>
    </article>
  );
}

export function ScenarioCard({ scenario, stockNames }: { scenario: ScenarioLog; stockNames: string[] }) {
  return (
    <article className="scenario-card">
      <div className="scenario-top">
        <span className={`pill ${scenario.type === 'big' ? 'purple' : 'cyan'}`}>{scenario.type.toUpperCase()}</span>
        <small>{dateTime(scenario.occurredAt)}</small>
      </div>
      <h3>{scenario.title}</h3>
      <p>{scenario.description}</p>
      <div className="scenario-meta">
        <Change value={scenario.direction === 'up' ? scenario.strength / 10 : -scenario.strength / 10} />
        <span>영향 종목 {stockNames.join(', ')}</span>
      </div>
    </article>
  );
}

export function Change({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={up ? 'change up' : 'change down'}>
      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {percent(value)}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <BadgeCheck size={22} />
      <span>{text}</span>
    </div>
  );
}
