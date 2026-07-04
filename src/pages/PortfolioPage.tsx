import { History, PieChart } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '../components/Cards';
import { useFandexStore } from '../store/useFandexStore';
import { currency, dateTime } from '../utils/format';

export function PortfolioPage() {
  const { user, stocks, transactions } = useFandexStore();
  const holdingRows = user?.holdings.map((holding) => {
    const stock = stocks.find((item) => item.id === holding.stockId)!;
    const value = stock.price * holding.quantity;
    const pnl = (stock.price - holding.averagePrice) * holding.quantity;
    const returnRate = ((stock.price - holding.averagePrice) / holding.averagePrice) * 100;
    return { ...holding, stock, value, pnl, returnRate };
  }) ?? [];
  const stockValue = holdingRows.reduce((sum, item) => sum + item.value, 0);
  const assetHistory = Array.from({ length: 10 }, (_, index) => ({
    day: `${index + 1}일`,
    value: Math.round((user?.cash ?? 0) + stockValue * (0.88 + index * 0.018 + Math.sin(index) * 0.02)),
  }));

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Portfolio</span>
        <h1>내 포트폴리오</h1>
        <p>보유 종목, 현금, 손익, 배당 기록을 한 화면에서 확인합니다.</p>
      </header>
      <section className="stat-grid">
        <StatCard label="가상 현금" value={currency(user?.cash ?? 0)} />
        <StatCard label="총 평가 자산" value={currency((user?.cash ?? 0) + stockValue)} />
        <StatCard label="총 배당 수령액" value={currency(user?.totalDividend ?? 0)} />
        <StatCard label="보유 종목 수" value={`${holdingRows.length}개`} />
      </section>
      <section className="dashboard-grid">
        <article className="panel wide">
          <div className="panel-title"><PieChart size={20} /><h2>자산 변화 그래프</h2></div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={assetHistory}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Area dataKey="value" stroke="#7c5cff" fill="#7c5cff33" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><History size={20} /><h2>거래 내역</h2></div>
          {transactions.map((tx) => {
            const stock = stocks.find((item) => item.id === tx.stockId);
            return (
              <div className="history-row" key={tx.id}>
                <span>{stock?.name}</span>
                <strong>{tx.type === 'buy' ? '매수' : tx.type === 'sell' ? '매도' : '배당'}</strong>
                <small>{currency(tx.total)} · {dateTime(tx.createdAt)}</small>
              </div>
            );
          })}
        </article>
      </section>
      <section className="panel">
        <div className="stock-table portfolio-table">
          <div className="stock-row table-head">
            <span>종목</span><span>보유 수량</span><span>평균 매수가</span><span>현재가</span><span>평가 손익</span><span>수익률</span>
          </div>
          {holdingRows.map((row) => (
            <div className="stock-row" key={row.stockId}>
              <strong>{row.stock.name}</strong>
              <span>{row.quantity.toLocaleString('ko-KR')}주</span>
              <span>{currency(row.averagePrice)}</span>
              <span>{currency(row.stock.price)}</span>
              <strong className={row.pnl >= 0 ? 'positive' : 'negative'}>{currency(row.pnl)}</strong>
              <span className={row.returnRate >= 0 ? 'positive' : 'negative'}>{row.returnRate.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
