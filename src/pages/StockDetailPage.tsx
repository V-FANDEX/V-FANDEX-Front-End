import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRemote } from '../hooks/useRemote';
import { useMarketSnapshot } from '../hooks/useMarketSnapshot';
import { segment } from '../services/contractApi';
import type { Row } from '../types/contracts';
import { EngineTradePanel } from '../components/EngineTradePanel';
import { ErrorNotice, Field, Table } from '../components/admin/Shared';
import { localDate, money } from '../utils/contracts';
import { useFandexStore } from '../store/useFandexStore';
export function StockDetailPage() {
  const { stockId } = useParams();
  const [interval, setInterval] = useState('1h');
  const stock = useRemote<Row>(stockId ? `/stocks/${segment(stockId)}` : undefined);
  const snapshot = useMarketSnapshot(stockId, interval);
  const { data } = snapshot;
  const { user, toggleFavorite } = useFandexStore();
  return (
    <div className="page contract-workspace">
      <header className="page-header">
        <h1>{String(stock.data?.name ?? '종목')}</h1>
        <p>{String(stock.data?.description ?? '')}</p>
        <p>
          실시간 {snapshot.status} · 마지막 체결 {localDate(data?.quote.lastTradeAt as string | undefined)}
        </p>
        <button onClick={() => window.dispatchEvent(new Event('vfandex:invalidate'))}>
          REST 스냅샷 새로고침
        </button>
        {stockId && (
          <button onClick={() => void toggleFavorite(stockId)}>
            {user?.favoriteStockIds.includes(stockId) ? '즐겨찾기 해제' : '즐겨찾기'}
          </button>
        )}
      </header>
      <ErrorNotice error={stock.error ?? snapshot.error} />
      <section className="stat-grid">
        <article className="stat-card">
          <span>실제 마지막 체결가</span>
          <strong>{money(data?.quote.lastPrice as string | null | undefined)}</strong>
        </article>
        <article className="stat-card">
          <span>초기 참고 가격</span>
          <strong>{money(data?.quote.initialReferencePrice as string | undefined)}</strong>
        </article>
      </section>
      <section className="detail-grid">
        <article className="panel wide">
          <h2>실제 체결 가격</h2>
          <Field label="봉 간격">
            <select value={interval} onChange={(e) => setInterval(e.target.value)}>
              {['1m', '5m', '15m', '1h', '1d'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          {data?.candles.length ? (
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={data.candles.map((c) => ({ ...c, chartClose: Number(c.close) }))}>
                <XAxis dataKey="openTime" tickFormatter={(x) => localDate(x)} />
                <YAxis />
                <Tooltip
                  formatter={(_, __, props) => [money(props.payload.close), '종가']}
                  labelFormatter={(value) => localDate(String(value))}
                />
                <Line dataKey="chartClose" stroke="#38d5ff" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>해당 구간에 실제 체결 봉이 없습니다.</p>
          )}
          <p>체결이 없는 구간의 봉을 생성하지 않습니다. volume은 정수 문자열로 보존합니다.</p>
          <details>
            <summary>봉 원본</summary>
            <Table
              rows={data?.candles ?? []}
              columns={['openTime', 'open', 'high', 'low', 'close', 'volume']}
            />
          </details>
        </article>
        {stockId && (
          <EngineTradePanel
            key={`${user?.id}:${stockId}`}
            stockId={stockId}
            tickSize={stock.data?.tickSize as string | undefined}
          />
        )}
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <h2>호가창</h2>
          <h3>매도</h3>
          <Table rows={data?.orderbook.asks ?? []} columns={['price', 'quantity', 'orderCount']} />
          <h3>매수</h3>
          <Table rows={data?.orderbook.bids ?? []} columns={['price', 'quantity', 'orderCount']} />
        </article>
        <article className="panel">
          <h2>최근 실제 체결</h2>
          <Table
            rows={data?.trades ?? []}
            columns={['sequence', 'price', 'quantity', 'aggressorSide', 'executedAt']}
          />
        </article>
      </section>
    </div>
  );
}
