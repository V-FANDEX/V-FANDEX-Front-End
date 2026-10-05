import { useEffect, useState } from 'react';
import { useRemote, useAction } from '../hooks/useRemote';
import { write } from '../services/contractApi';
import { useFandexStore } from '../store/useFandexStore';
import type { Row } from '../types/contracts';
import { DataView, ErrorNotice, Field, Table } from '../components/admin/Shared';
export function DividendsPage() {
  const user = useFandexStore((s) => s.user);
  return (
    <div className="page contract-workspace">
      <header className="page-header">
        <h1>배당</h1>
        <p>실제 지급 기록을 표시합니다. 청구 가능 여부와 지급 금액은 서버 정책으로 결정됩니다.</p>
      </header>
      {user ? <Dividends key={user.id} /> : <p>로그인 후 조회할 수 있습니다.</p>}
    </div>
  );
}
function Dividends() {
  const rows = useRemote<Row[]>('/dividends/me'),
    action = useAction();
  const stocks = useFandexStore((s) => s.stocks);
  const [stockId, setStock] = useState('');
  const refresh = rows.refresh;
  useEffect(() => {
    window.addEventListener('vfandex:invalidate', refresh);
    return () => window.removeEventListener('vfandex:invalidate', refresh);
  }, [refresh]);
  return (
    <section className="panel">
      <Field label="청구 대상">
        <select value={stockId} onChange={(e) => setStock(e.target.value)}>
          <option value="">시스템 배당</option>
          {stocks
            .filter((s) => s.dividendEnabled)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </Field>
      <button
        disabled={action.busy}
        onClick={() =>
          void action.execute(async () => {
            const result = await write('/dividends/claim', 'POST', stockId ? { stockId } : {});
            refresh();
            window.dispatchEvent(new Event('vfandex:invalidate'));
            return result;
          })
        }
      >
        배당 청구
      </button>
      <button onClick={refresh}>새로고침</button>
      <ErrorNotice error={rows.error ?? action.error} />
      <Table rows={rows.data ?? []} columns={['id', 'stockId', 'amount', 'createdAt']} />
      {action.result !== undefined && <DataView value={action.result} />}
    </section>
  );
}
