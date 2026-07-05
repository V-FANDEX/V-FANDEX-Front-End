import { Heart, Info, ReceiptText } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Change, ScenarioCard, StatCard } from '../components/Cards';
import { TradePanel } from '../components/TradePanel';
import { useFandexStore } from '../store/useFandexStore';
import { compact, currency, dateTime } from '../utils/format';

export function StockDetailPage() {
  const { stockId } = useParams();
  const { stocks, markets, user, scenarios, dividendSchedule, toggleFavorite, placeOrder, notify } = useFandexStore();
  const stock = stocks.find((item) => item.id === stockId);
  if (!stock) return <Navigate to="/markets" replace />;
  const market = markets.find((item) => item.id === stock.marketId);
  const holding = user?.holdings.find((item) => item.stockId === stock.id);
  const pnl = holding ? (stock.price - holding.averagePrice) * holding.quantity : 0;
  const chart = Array.from({ length: 14 }, (_, index) => ({
    day: `${index + 1}일`,
    price: Math.round(stock.previousClose + (stock.price - stock.previousClose) * (index / 13) + Math.sin(index) * stock.price * 0.025),
  }));

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
        <article className="panel wide">
          <div className="panel-title"><ReceiptText size={20} /><h2>가격 차트</h2><Change value={stock.changeRate} /></div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="price" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cff" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="#38d5ff" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide domain={['dataMin - 600', 'dataMax + 600']} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Area dataKey="price" stroke="#38d5ff" fill="url(#price)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
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
