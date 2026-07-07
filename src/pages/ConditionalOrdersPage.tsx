import { BellRing, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFandexStore } from '../store/useFandexStore';
import { currency, dateTime } from '../utils/format';

export function ConditionalOrdersPage() {
  const { conditionalOrders, stocks, cancelConditionalOrder } = useFandexStore();

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Smart Orders</span>
        <h1>조건 매수/매도</h1>
        <p>가격 조건을 만족하면 자동 체결되는 주문을 관리합니다.</p>
      </header>
      <section className="panel">
        <div className="stock-table order-table">
          <div className="stock-row table-head">
            <span>종목</span><span>조건</span><span>수량</span><span>상태</span><span>기록</span><span />
          </div>
          {conditionalOrders.map((order) => {
            const stock = stocks.find((item) => item.id === order.stockId);
            return (
              <div className="stock-row conditional-order-row" key={order.id}>
                <Link to={`/stocks/${order.stockId}`} className="stock-title">
                  <span>
                    <strong>{stock?.name}</strong>
                    <small>{stock?.symbol}</small>
                  </span>
                </Link>
                <span className="order-metric" data-label="조건">{order.direction === 'buyBelow' ? '이하 매수' : '이상 매도'} {currency(order.targetPrice)}</span>
                <strong className="order-metric" data-label="수량">{order.quantity.toLocaleString('ko-KR')}주</strong>
                <span className="order-metric" data-label="상태"><span className={order.active ? 'pill cyan' : 'pill'}>{order.active ? '활성' : '비활성'}</span></span>
                <small className="order-metric" data-label="기록">{order.executedAt ? `체결 ${dateTime(order.executedAt)}` : `등록 ${dateTime(order.createdAt)}`}</small>
                <button className="icon-button order-cancel-button" disabled={!order.active} onClick={() => cancelConditionalOrder(order.id)} aria-label="조건 주문 취소">
                  <X size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><BellRing size={20} /><h2>자동 체결 알림</h2></div>
        <p className="panel-copy">조건 주문 체결 시 토스트와 거래 내역에 기록됩니다. 가격 변동 알림 구조는 백엔드 웹소켓 또는 푸시 API로 확장할 수 있습니다.</p>
      </section>
    </div>
  );
}
