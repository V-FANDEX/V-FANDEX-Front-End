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
  disabledReason,
}: {
  stock: Stock;
  ownedQuantity: number;
  cash: number;
  onOrder: (order: TradePanelOrder) => void | Promise<void>;
  disabledReason?: string;
}) {
  const [mode, setMode] = useState<'buy' | 'sell' | 'limitBuy' | 'limitSell'>('buy');
  const [quantity, setQuantity] = useState(1);
  const [triggerPrice, setTriggerPrice] = useState(stock.price);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const total = useMemo(() => stock.price * quantity, [quantity, stock.price]);
  const isConditionOrder = mode === 'limitBuy' || mode === 'limitSell';
  const orderDirection = mode === 'buy' || mode === 'limitBuy' ? 'buy' : 'sell';
  const invalidInput = !Number.isInteger(quantity) || quantity < 1 || (isConditionOrder && (!Number.isFinite(triggerPrice) || triggerPrice <= 0));

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
        <span>현재가 기준 예상 금액</span>
        <strong>{currency(total)}</strong>
        {isConditionOrder && (
          <>
            <span>조건 가격</span>
            <strong>{currency(triggerPrice)}</strong>
          </>
        )}
        <span>가상 현금</span>
        <strong>{currency(cash)}</strong>
        <span>보유 수량</span>
        <strong>{ownedQuantity.toLocaleString('ko-KR')}주</strong>
      </div>
      <p className="panel-copy order-notice">
        시장가 주문의 실제 처리 가격은 현재 표시 가격과 다를 수 있으며 최종 검증과 처리는 백엔드가 담당합니다.
      </p>
      {disabledReason && <p className="form-error">{disabledReason}</p>}
      <button
        className="primary-button"
        disabled={Boolean(disabledReason) || submitting || invalidInput}
        onClick={() => setConfirming(true)}
      >
        {mode.includes('Buy') || mode === 'buy' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        {submitting ? '요청 중…' : mode === 'buy' ? '매수하기' : mode === 'sell' ? '매도하기' : '조건 주문 등록'}
      </button>
      {confirming && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>주문 확인</h3>
            <p>
              {stock.name} {quantity.toLocaleString('ko-KR')}주를 현재가 기준 예상 {currency(total)} 규모로{' '}
              {orderDirection === 'buy' ? '매수' : '매도'}하시겠습니까?
              {isConditionOrder ? ` 조건 가격은 ${currency(triggerPrice)}입니다.` : ''}
            </p>
            <div className="modal-actions">
              <button className="ghost-button" disabled={submitting} onClick={() => setConfirming(false)}>취소</button>
              <button
                className="primary-button"
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return;
                  setSubmitting(true);
                  try {
                    await onOrder({
                      type: orderDirection,
                      quantity,
                      orderType: isConditionOrder ? 'CONDITION' : 'MARKET',
                      triggerPrice: isConditionOrder ? triggerPrice : undefined,
                    });
                    setConfirming(false);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? '요청 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
