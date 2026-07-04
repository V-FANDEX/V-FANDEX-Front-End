import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { EmptyState, StockRow } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import type { Stock } from '../types';

type SortKey = 'price' | 'gain' | 'loss' | 'volume' | 'marketCap';
type FilterKey = 'all' | 'up' | 'down' | 'owned' | 'favorite';

export function StockListPage() {
  const { marketId } = useParams();
  const { markets, stocks, user, toggleFavorite } = useFandexStore();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('volume');
  const [filter, setFilter] = useState<FilterKey>('all');
  const market = markets.find((item) => item.id === marketId);

  const visibleStocks = useMemo(() => {
    return stocks
      .filter((stock) => stock.marketId === marketId)
      .filter((stock) => stock.name.includes(query) || stock.symbol.toLowerCase().includes(query.toLowerCase()))
      .filter((stock) => {
        if (filter === 'up') return stock.changeRate > 0;
        if (filter === 'down') return stock.changeRate < 0;
        if (filter === 'owned') return Boolean(user?.holdings.some((holding) => holding.stockId === stock.id));
        if (filter === 'favorite') return Boolean(user?.favoriteStockIds.includes(stock.id));
        return true;
      })
      .sort((a, b) => compareStock(a, b, sort));
  }, [filter, marketId, query, sort, stocks, user]);

  if (!market) return <Navigate to="/markets" replace />;

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Market Board</span>
        <h1>{market.name}</h1>
        <p>{market.description}</p>
      </header>
      <section className="panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input placeholder="종목명 또는 심볼 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="price">가격순</option>
            <option value="gain">상승률순</option>
            <option value="loss">하락률순</option>
            <option value="volume">거래량순</option>
            <option value="marketCap">시가총액순</option>
          </select>
        </div>
        <div className="segmented">
          {[
            ['all', '전체'],
            ['up', '상승'],
            ['down', '하락'],
            ['owned', '보유 중'],
            ['favorite', '즐겨찾기'],
          ].map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key as FilterKey)}>
              {label}
            </button>
          ))}
        </div>
        <div className="stock-table">
          <div className="stock-row table-head">
            <span>종목</span><span>현재가</span><span>등락률</span><span>거래량</span><span>시가총액</span><span>배당</span><span />
          </div>
          {visibleStocks.length ? visibleStocks.map((stock) => (
            <StockRow
              key={stock.id}
              stock={stock}
              favorite={Boolean(user?.favoriteStockIds.includes(stock.id))}
              onFavorite={() => toggleFavorite(stock.id)}
            />
          )) : <EmptyState text="조건에 맞는 종목이 없습니다." />}
        </div>
      </section>
    </div>
  );
}

function compareStock(a: Stock, b: Stock, sort: SortKey) {
  if (sort === 'price') return b.price - a.price;
  if (sort === 'gain') return b.changeRate - a.changeRate;
  if (sort === 'loss') return a.changeRate - b.changeRate;
  if (sort === 'marketCap') return b.marketCap - a.marketCap;
  return b.volume - a.volume;
}
