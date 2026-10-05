import { useEffect, useState } from 'react';
import Decimal from 'decimal.js';
import { useRemote } from '../hooks/useRemote';
import { segment } from '../services/contractApi';
import { useFandexStore } from '../store/useFandexStore';
import type { Row } from '../types/contracts';
import { DataView, ErrorNotice, Field, Table } from '../components/admin/Shared';
import { money } from '../utils/contracts';
export function PortfolioPage() {
  const user = useFandexStore((s) => s.user);
  return (
    <div className="page contract-workspace">
      <header className="page-header">
        <h1>내 포트폴리오</h1>
      </header>
      {user ? <Portfolio key={user.id} /> : <p>로그인 후 조회할 수 있습니다.</p>}
    </div>
  );
}
function Portfolio() {
  const portfolio = useRemote<Row>('/portfolio/me'),
    trades = useRemote<Row[]>('/trades/me'),
    dividends = useRemote<Row[]>('/dividends/me'),
    seasons = useRemote<Row[]>('/seasons');
  const [seasonId, setSeason] = useState('');
  const snapshot = useRemote<Row>(seasonId ? `/seasons/${segment(seasonId)}/me` : undefined);
  const { refresh } = portfolio;
  const refreshTrades = trades.refresh,
    refreshDividends = dividends.refresh;
  useEffect(() => {
    const update = () => {
      refresh();
      refreshTrades();
      refreshDividends();
    };
    window.addEventListener('vfandex:invalidate', update);
    return () => window.removeEventListener('vfandex:invalidate', update);
  }, [refresh, refreshTrades, refreshDividends]);
  const holdings = (portfolio.data?.holdings as Row[] | undefined) ?? [];
  return (
    <>
      <ErrorNotice
        error={portfolio.error ?? trades.error ?? dividends.error ?? seasons.error ?? snapshot.error}
      />
      <section className="panel">
        <h2>현재 자산</h2>
        <button onClick={refresh}>현재 자산 새로고침</button>
        <dl className="data-grid">
          {[
            'cash',
            'reservedCash',
            'availableCash',
            'stockValue',
            'totalAssetValue',
            'realizedPnl',
            'unrealizedPnl',
          ].map((key) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{money(portfolio.data?.[key] as string | undefined)}</dd>
            </div>
          ))}
        </dl>
        <Table
          rows={holdings.map((h) => {
            const stock = h.stock as Row;
            const quantity = String(h.quantity);
            const value = new Decimal(String(stock.currentPrice)).mul(quantity);
            const basis = new Decimal(String(h.averageBuyPrice)).mul(quantity);
            return {
              ...h,
              name: stock.name,
              currentPrice: stock.currentPrice,
              value: value.toFixed(),
              pnl: value.minus(basis).toFixed(),
              returnPct: basis.gt(0) ? value.minus(basis).div(basis).mul(100).toFixed(4) : null,
            };
          })}
          columns={[
            'name',
            'quantity',
            'reservedQuantity',
            'averageBuyPrice',
            'currentPrice',
            'value',
            'pnl',
            'returnPct',
          ]}
        />
      </section>
      <section className="panel">
        <h2>실제 거래 / 배당</h2>
        <Table
          rows={trades.data ?? []}
          columns={['id', 'stockId', 'type', 'quantity', 'price', 'totalAmount', 'createdAt']}
        />
        <Table rows={dividends.data ?? []} columns={['id', 'amount', 'createdAt']} />
      </section>
      <section className="panel">
        <h2>시즌 자산 스냅샷</h2>
        <Field label="시즌">
          <select value={seasonId} onChange={(e) => setSeason(e.target.value)}>
            <option value="">시즌 선택</option>
            {seasons.data?.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name)} · {String(s.status)}
              </option>
            ))}
          </select>
        </Field>
        <p>
          종료 시즌은 서버의 동결 기록을 표시합니다. 현재 자산으로 다시 계산하지 않습니다. 기록이 없으면
          사용할 수 없음으로 표시됩니다.
        </p>
        <DataView value={snapshot.data} />
      </section>
    </>
  );
}
