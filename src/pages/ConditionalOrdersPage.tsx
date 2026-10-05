import { useEffect } from 'react';
import { useAction, usePage } from '../hooks/useRemote';
import { segment, write } from '../services/contractApi';
import { useFandexStore } from '../store/useFandexStore';
import type { EngineOrder } from '../types/contracts';
import { DataView, ErrorNotice, PageButtons, Table } from '../components/admin/Shared';
export function ConditionalOrdersPage() {
  const user = useFandexStore((s) => s.user);
  return (
    <div className="page">
      <header className="page-header">
        <h1>주문 내역</h1>
        <p>접수와 체결을 구분합니다. 취소된 주문도 일부 체결량이 있을 수 있습니다.</p>
      </header>
      {user ? <Orders key={user.id} /> : <p>로그인 후 조회할 수 있습니다.</p>}
    </div>
  );
}
function Orders() {
  const page = usePage<EngineOrder>('/orders/me/page?limit=50', 'before');
  const action = useAction(page.refresh);
  const refresh = page.refresh;
  useEffect(() => {
    window.addEventListener('vfandex:invalidate', refresh);
    return () => window.removeEventListener('vfandex:invalidate', refresh);
  }, [refresh]);
  return (
    <section className="panel">
      <ErrorNotice error={page.error ?? action.error} />
      <Table
        rows={page.items}
        columns={[
          'id',
          'stockId',
          'side',
          'type',
          'price',
          'quantity',
          'status',
          'filledQuantity',
          'remainingQuantity',
          'updatedAt',
        ]}
        onSelect={(row) => {
          if (!['PENDING', 'OPEN', 'PARTIALLY_FILLED'].includes(String(row.status))) return;
          if (window.confirm(`주문 ${row.id}의 남은 수량을 취소하시겠습니까?`))
            void action.execute(async () => {
              const result = await write(`/orders/${segment(String(row.id))}`, 'DELETE');
              page.refresh();
              window.dispatchEvent(new Event('vfandex:invalidate'));
              return result;
            });
        }}
      />
      <p>열기 버튼에서 처리 중인 주문의 잔여 수량 취소를 검토할 수 있습니다.</p>
      <PageButtons {...page} />
      {action.result !== undefined && <DataView value={action.result} />}
    </section>
  );
}
