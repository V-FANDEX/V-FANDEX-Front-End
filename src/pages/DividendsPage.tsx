import { Gift, RotateCcw } from 'lucide-react';
import { useFandexStore } from '../store/useFandexStore';
import { currency, dateTime } from '../utils/format';

export function DividendsPage() {
  const { user, stocks, transactions, claimDividend } = useFandexStore();
  const dividendStocks = user?.holdings
    .map((holding) => ({ holding, stock: stocks.find((stock) => stock.id === holding.stockId) }))
    .filter((row) => row.stock?.dividendEnabled) ?? [];
  const dividendTx = transactions.filter((tx) => tx.type === 'dividend');

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Recovery System</span>
        <h1>배당금 센터</h1>
        <p>수령 횟수가 늘어날수록 배당률이 강화되어 손실 회복을 돕는 보조 시스템입니다.</p>
      </header>
      <section className="dividend-grid">
        {dividendStocks.map(({ holding, stock }) => {
          if (!stock) return null;
          const expected = Math.round(holding.quantity * stock.price * (stock.dividendRate / 100) * 0.1);
          return (
            <article className="dividend-card" key={stock.id}>
              <div className="panel-title"><Gift size={20} /><h2>{stock.name}</h2></div>
              <p>기본 배당률 {stock.dividendRate}% · 예상 수령액 {currency(expected)}</p>
              <button className="primary-button" onClick={() => claimDividend(stock.id)}>배당금 수령</button>
            </article>
          );
        })}
      </section>
      <section className="panel">
        <div className="panel-title"><RotateCcw size={20} /><h2>배당 수령 기록</h2></div>
        {dividendTx.map((tx, index) => {
          const stock = stocks.find((item) => item.id === tx.stockId);
          return (
            <div className="history-row" key={tx.id}>
              <span>{stock?.name}</span>
              <strong>{currency(tx.total)}</strong>
              <small>{index + 1}회차 · {dateTime(tx.createdAt)}</small>
            </div>
          );
        })}
      </section>
    </div>
  );
}
