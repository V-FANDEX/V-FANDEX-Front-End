import { useState } from 'react';
import Decimal from 'decimal.js';
import { newOperation, operationRequest, useAction } from '../hooks/useRemote';
import { useFandexStore } from '../store/useFandexStore';
import { Confirm, DataView, ErrorNotice, Field } from './admin/Shared';
import type { EngineOrder, NewOrder } from '../types/contracts';
import { numeric } from '../utils/contracts';
export function EngineTradePanel({ stockId, tickSize }: { stockId: string; tickSize?: string }) {
  const user = useFandexStore((s) => s.user);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY'),
    [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET'),
    [quantity, setQuantity] = useState('1'),
    [price, setPrice] = useState(''),
    [pending, setPending] = useState<NewOrder>();
  const action = useAction();
  const scope = `${user?.id}:order:${stockId}`;
  const [received, setReceived] = useState<EngineOrder>();
  return (
    <section className="trade-panel contract-workspace">
      <h2>주문 접수</h2>
      <Field label="방향">
        <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
          <option value="BUY">매수</option>
          <option value="SELL">매도</option>
        </select>
      </Field>
      <Field label="종류">
        <select value={type} onChange={(e) => setType(e.target.value as 'MARKET' | 'LIMIT')}>
          <option value="MARKET">시장가</option>
          <option value="LIMIT">지정가</option>
        </select>
      </Field>
      <Field label="수량 (정수)">
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
      </Field>
      {type === 'LIMIT' && (
        <Field label={`지정 가격 (최대 소수 4자리${tickSize ? `, 호가 단위 ${tickSize}` : ''})`}>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        </Field>
      )}
      <p>
        202는 예약/접수입니다. 체결 완료가 아니며 CANCELED도 일부 체결량이 있을 수 있습니다. 처리 정지 종목도
        대기열에 접수됩니다.
      </p>
      <button
        className="primary-button"
        disabled={!user || action.busy || Boolean(received)}
        onClick={() =>
          void action.execute(async () => {
            const body: NewOrder = { stockId, side, type, quantity: numeric(quantity, '수량', 1, 1e9, 0) };
            if (type === 'LIMIT') {
              if (!/^\d{1,12}(\.\d{1,4})?$/.test(price) || new Decimal(price).lte(0))
                throw new Error('가격은 양수, 정수 12자리 / 소수 4자리까지입니다.');
              if (tickSize && !new Decimal(price).mod(tickSize).eq(0))
                throw new Error('가격은 호가 단위의 배수여야 합니다.');
              body.price = new Decimal(price).toFixed();
            }
            setPending(body);
          })
        }
      >
        {user ? '주문 검토 / 동일 요청 재시도' : '로그인이 필요합니다'}
      </button>
      <button
        disabled={action.busy}
        onClick={() => {
          if (
            window.confirm(
              '이전 요청 결과를 주문 내역에서 확인했습니까? 새 키로 제출하면 별도 주문이 됩니다.',
            )
          ) {
            newOperation(scope);
            setReceived(undefined);
          }
        }}
      >
        새 주문 시작
      </button>
      <ErrorNotice error={action.error} />
      {received && (
        <>
          <strong>주문 접수 · {received.status} (체결 여부는 내역 확인)</strong>
          <DataView value={received} />
        </>
      )}
      {pending && (
        <Confirm
          title="주문 접수 확인"
          busy={action.busy}
          onClose={() => setPending(undefined)}
          onConfirm={() =>
            void action.execute(async () => {
              const result = await operationRequest<EngineOrder>(scope, '/orders', pending);
              setReceived(result);
              setPending(undefined);
              window.dispatchEvent(new Event('vfandex:invalidate'));
              return result;
            })
          }
        >
          <DataView value={pending} />
          <p>응답을 받지 못하면 같은 키와 body로 재시도합니다.</p>
        </Confirm>
      )}
    </section>
  );
}
