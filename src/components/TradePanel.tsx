import { ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Stock } from '../types';
import { currency } from '../utils/format';

export interface TradePanelOrder {
  type: 'buy' | 'sell';
  quantity: number;
  orderType: 'MARKET' | 'CONDITION';
  triggerPrice?: number;
}

export function TradePanel({
  stock,
  ownedQuantity,
  cash,
  onOrder,
}: {
  stock: Stock;
  ownedQuantity: number;
  cash: number;
  onOrder: (order: TradePanelOrder) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'buy' | 'sell' | 'limitBuy' | 'limitSell'>('buy');
  const [quantity, setQuantity] = useState(1);
  const [triggerPrice, setTriggerPrice] = useState(stock.price);
  const [confirming, setConfirming] = useState(false);
  const total = useMemo(() => stock.price * quantity, [quantity, stock.price]);
  const fee = Math.round(total * 0.001);
  const isConditionOrder = mode === 'limitBuy' || mode === 'limitSell';
  const orderDirection = mode === 'buy' || mode === 'limitBuy' ? 'buy' : 'sell';

  return (
    <section className="trade-panel">
      <div className="panel-title">
        <ShoppingCart size={20} />
        <h2>주문</h2>
      </div>
      <div className="segmented four">
        <button className={mode === 'buy' ? 'active' : ''} onClick={() => setMode('buy')}>시장가 매수</button>
        <button className={mode === 'sell' ? 'active' : ''} onClick={() => setMode('sell')}>시장가 매도</button>
        <button className={mode === 'limitBuy' ? 'active' : ''} onClick={() => setMode('limitBuy')}>조건 매수</button>
        <button className={mode === 'limitSell' ? 'active' : ''} onClick={() => setMode('limitSell')}>조건 매도</button>
      </div>
      <label className="field">
        <span>주문 수량</span>
        <input min={1} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
      </label>
      {isConditionOrder && (
        <label className="field">
          <span>{mode === 'limitBuy' ? '매수 조건 가격 이하' : '매도 조건 가격 이상'}</span>
          <input
            min={1}
            type="number"
            value={triggerPrice}
            onChange={(event) => setTriggerPrice(Number(event.target.value))}
          />
        </label>
      )}
      <div className="order-summary">
        <span>예상 체결 금액</span>
        <strong>{currency(total)}</strong>
        {isConditionOrder && (
          <>
            <span>조건 가격</span>
            <strong>{currency(triggerPrice)}</strong>
          </>
        )}
        <span>예상 수수료</span>
        <strong>{currency(fee)}</strong>
        <span>가상 현금</span>
        <strong>{currency(cash)}</strong>
        <span>보유 수량</span>
        <strong>{ownedQuantity.toLocaleString('ko-KR')}주</strong>
      </div>
      <button className="primary-button" onClick={() => setConfirming(true)}>
        {mode.includes('Buy') || mode === 'buy' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        {mode === 'buy' ? '매수하기' : mode === 'sell' ? '매도하기' : '조건 주문 등록'}
      </button>
      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>주문 확인</h3>
            <p>
              {stock.name} {quantity.toLocaleString('ko-KR')}주를 {currency(total)}에{' '}
              {orderDirection === 'buy' ? '매수' : '매도'}하시겠습니까?
              {isConditionOrder ? ` 조건 가격은 ${currency(triggerPrice)}입니다.` : ''}
            </p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setConfirming(false)}>취소</button>
              <button
                className="primary-button"
                onClick={() => {
                  setConfirming(false);
                  onOrder({
                    type: orderDirection,
                    quantity,
                    orderType: isConditionOrder ? 'CONDITION' : 'MARKET',
                    triggerPrice: isConditionOrder ? triggerPrice : undefined,
                  });
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
