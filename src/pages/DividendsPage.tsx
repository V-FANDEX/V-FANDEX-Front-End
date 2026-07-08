import { CalendarClock, Gift, RotateCcw } from 'lucide-react';
import { useFandexStore } from '../store/useFandexStore';
import { currency, dateTime } from '../utils/format';

export function DividendsPage() {
  const { user, stocks, transactions, dividendSchedule, claimDividend } = useFandexStore();
  const dividendStocks = user?.holdings
    .map((holding) => ({ holding, stock: holding.stock ?? stocks.find((stock) => stock.id === holding.stockId) }))
    .filter((row) => row.stock?.dividendEnabled) ?? [];
  const dividendTx = transactions.filter((tx) => tx.type === 'dividend');

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Recovery System</span>
        <h1>배당금 센터</h1>
        <p>관리자가 설정한 지급 스케줄에 따라 배당금이 자동 지급됩니다.</p>
      </header>
      <section className="panel dividend-schedule-panel">
        <div className="panel-title"><CalendarClock size={20} /><h2>자동 지급 스케줄</h2></div>
        <div className="schedule-summary">
          <span>상태 <strong>{dividendSchedule?.status === 'active' ? '활성' : '일시정지'}</strong></span>
          <span>지급 주기 <strong>{formatFrequency(dividendSchedule?.frequency)}</strong></span>
          <span>지급 시각 <strong>{dividendSchedule?.payoutTime} {dividendSchedule?.timezone}</strong></span>
          <span>다음 지급 <strong>{dividendSchedule ? dateTime(dividendSchedule.nextRunAt ?? dividendSchedule.nextPayoutAt) : '-'}</strong></span>
          <span>최근 지급 <strong>{dividendSchedule?.lastRunAt ? dateTime(dividendSchedule.lastRunAt) : '-'}</strong></span>
        </div>
        <button className="secondary-button" type="button" onClick={() => void claimDividend()}>
          시스템 배당 수령 요청
        </button>
      </section>
      <section className="dividend-grid">
        {dividendStocks.map(({ holding, stock }) => {
          if (!stock) return null;
          const expected = Math.round(holding.quantity * stock.price * (stock.dividendRate / 100) * 0.1);
          return (
            <article className="dividend-card" key={stock.id}>
              <div className="panel-title"><Gift size={20} /><h2>{stock.name}</h2></div>
              <p>기본 배당률 {stock.dividendRate}% · 다음 자동 지급 예상액 {currency(expected)}</p>
              <div className="dividend-card-actions">
                <span className="pill cyan">자동 지급 예정</span>
                <button className="ghost-button" type="button" onClick={() => void claimDividend(stock.id)}>
                  종목 배당 수령
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <section className="panel">
        <div className="panel-title"><RotateCcw size={20} /><h2>배당 수령 기록</h2></div>
        {dividendTx.map((tx, index) => {
          const stock = tx.stock ?? stocks.find((item) => item.id === tx.stockId);
          return (
            <div className="history-row" key={tx.id}>
              <span>{stock?.name ?? '시스템 배당'}</span>
              <strong>{currency(tx.total)}</strong>
              <small>{index + 1}회차 · {dateTime(tx.createdAt)}</small>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function formatFrequency(frequency?: string) {
  if (frequency === 'daily') return '매일';
  if (frequency === 'weekly') return '매주';
  if (frequency === 'monthly') return '매월';
  return '-';
}
