import { useState } from 'react';
import { useAction, usePage, useRemote } from '../../hooks/useRemote';
import { withQuery } from '../../services/apiClient';
import { segment, write } from '../../services/contractApi';
import type { Identified, Row } from '../../types/contracts';
import { DataView, ErrorNotice, Field, PageButtons, Table } from './Shared';
export function OperationsPanel() {
  const [tab, setTab] = useState('market');
  return (
    <div className="contract-workspace">
      <section className="panel">
        <div className="segmented">
          {[
            ['market', '시장 / 주문 진단'],
            ['workers', '워커'],
            ['alerts', '현재 경보'],
            ['incidents', '경보 이력'],
          ].map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <p>
          처리 정지 종목의 신규 주문도 대기열에 접수됩니다. 주문 재개는 체결 보장이 아닙니다. 경보 확인은
          해결·억제·주문 재개와 다릅니다.
        </p>
      </section>
      {tab === 'incidents' ? <Incidents /> : <Snapshot key={tab} kind={tab} />}
    </div>
  );
}
function Snapshot({ kind }: { kind: string }) {
  const data = useRemote<Row>(`/admin/operations/${kind}`),
    paused = useRemote<Identified[]>(kind === 'market' ? '/admin/operations/orders/paused' : undefined);
  const [orderId, setOrderId] = useState('');
  const order = useRemote<Row>(orderId ? `/admin/operations/orders/${segment(orderId)}` : undefined);
  const action = useAction(order.refresh);
  return (
    <section className="panel">
      <button
        onClick={() => {
          data.refresh();
          paused.refresh();
        }}
      >
        새로고침
      </button>
      <ErrorNotice error={data.error ?? paused.error ?? order.error ?? action.error} />
      <DataView value={data.data} />
      {kind === 'market' && (
        <>
          <h3>처리 정지 주문</h3>
          <Table
            rows={paused.data ?? []}
            columns={[
              'id',
              'stockId',
              'status',
              'filledQuantity',
              'failureCount',
              'lastFailureCode',
              'nextAttemptAt',
            ]}
            onSelect={(row) => setOrderId(String(row.id))}
          />
          <Field label="진단할 주문 ID">
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </Field>
          {order.data && (
            <>
              <DataView value={order.data} />
              <div className="toolbar">
                {['retry', 'cancel'].map((command) => (
                  <button
                    key={command}
                    disabled={action.busy || (command === 'retry' && order.data?.status !== 'PENDING')}
                    onClick={() => {
                      if (
                        window.confirm(
                          command === 'retry'
                            ? '주문 처리를 재개하시겠습니까? 체결은 보장되지 않습니다.'
                            : '남은 주문을 취소하시겠습니까?',
                        )
                      )
                        void action.execute(async () => {
                          const result = await write(
                            `/admin/operations/orders/${segment(orderId)}/${command}`,
                            'POST',
                          );
                          order.refresh();
                          paused.refresh();
                          data.refresh();
                          return result;
                        });
                    }}
                  >
                    {command === 'retry' ? '주문 처리 재개' : '남은 주문 취소'}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {action.result !== undefined && <DataView value={action.result} />}
    </section>
  );
}
function Incidents() {
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [id, setId] = useState(''),
    [note, setNote] = useState('');
  const page = usePage<Identified>(
    withQuery('/admin/operations/alerts/incidents', { ...filters, limit: 50 }),
  );
  const detail = useRemote<Row>(id ? `/admin/operations/alerts/incidents/${segment(id)}` : undefined);
  const action = useAction(detail.refresh);
  return (
    <section className="panel">
      <h2>내부 경보 이력</h2>
      <div className="form-grid">
        {[
          ['status', ['OPEN', 'RESOLVED']],
          ['acknowledged', ['true', 'false']],
          ['severity', ['WARNING', 'CRITICAL']],
          ['code', []],
          ['role', []],
        ].map(([key, options]) => (
          <Field key={String(key)} label={String(key)}>
            {(options as string[]).length ? (
              <select
                value={filters[String(key)] ?? ''}
                onChange={(e) => {
                  setFilters({ ...filters, [String(key)]: e.target.value });
                  setId('');
                }}
              >
                <option value="">전체</option>
                {(options as string[]).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            ) : (
              <input
                value={filters[String(key)] ?? ''}
                onChange={(e) => {
                  setFilters({ ...filters, [String(key)]: e.target.value });
                  setId('');
                }}
              />
            )}
          </Field>
        ))}
      </div>
      <button
        disabled={action.busy}
        onClick={() =>
          void action.execute(async () => {
            const result = await write('/admin/operations/alerts/sample', 'POST');
            page.refresh();
            return result;
          })
        }
      >
        현재 관측 갱신
      </button>
      <ErrorNotice error={page.error ?? detail.error ?? action.error} />
      <h3>관측기 최신성</h3>
      <DataView value={(page.data as { sampler?: Row } | undefined)?.sampler} />
      <Table
        rows={page.items}
        columns={[
          'id',
          'code',
          'role',
          'severity',
          'status',
          'openedAt',
          'lastObservedAt',
          'resolvedAt',
          'durationMs',
          'durationAsOf',
          'acknowledgedAt',
        ]}
        onSelect={(row) => {
          setId(String(row.id));
          setNote('');
        }}
      />
      <PageButtons {...page} />
      {id && (
        <article className="result-card">
          <h3>경보 상세</h3>
          <p>
            openedAt~lastObservedAt은 관측 지속 구간입니다. sampler.stale은 관측기의 최신성으로, 해결 여부와
            별개입니다. 최초 확인 관리자·시각·메모는 재확인으로 덮어쓰지 않습니다.
          </p>
          <DataView value={detail.data} />
          <Field label="확인 메모 (선택, 최대 1000자)">
            <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button
            disabled={action.busy || !detail.data}
            onClick={() =>
              void action.execute(async () => {
                await write(
                  `/admin/operations/alerts/incidents/${segment(id)}/acknowledge`,
                  'POST',
                  note.trim() ? { note: note.trim() } : {},
                );
                detail.refresh();
                page.refresh();
                return { status: 'ACKNOWLEDGED' };
              })
            }
          >
            경보 확인
          </button>
        </article>
      )}
      {action.result !== undefined && <DataView value={action.result} />}
    </section>
  );
}
