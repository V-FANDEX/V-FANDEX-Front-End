import { useState } from 'react';
import { useAction, usePage, useRemote } from '../../hooks/useRemote';
import { withQuery } from '../../services/apiClient';
import { segment, write } from '../../services/contractApi';
import type { Identified, Sector } from '../../types/contracts';
import { DataView, ErrorNotice, Field, PageButtons, SettingsForm, Table } from './Shared';
export function SectorsPanel() {
  const sectors = useRemote<Sector[]>('/sectors');
  const [filter, setFilter] = useState(''),
    [sector, setSector] = useState<Sector>(),
    [stock, setStock] = useState<Identified>(),
    [assignment, setAssignment] = useState('');
  const page = usePage<Identified>(withQuery('/admin/stocks/page', { sectorId: filter, limit: 50 }));
  const action = useAction(() => {
    sectors.refresh();
    page.refresh();
  });
  return (
    <section className="panel">
      <h2>섹터 / 종목 배정</h2>
      <p>
        미분류는 sectorId=null입니다. 태그나 시장 이름으로 분류를 추정하지 않습니다. 분류 변경은 주문
        취소·강제 매도·가격 변경을 뜻하지 않습니다.
      </p>
      <SettingsForm
        key={sector?.id ?? 'new'}
        fields={[
          ...(!sector ? [{ key: 'code', label: '코드 (수정 불가)', required: true, maxLength: 32 }] : []),
          { key: 'name', label: '섹터 이름', required: true, maxLength: 64 },
        ]}
        initial={sector ?? {}}
        busy={action.busy}
        onSubmit={(body) =>
          void action.execute(async () => {
            if (!sector && !/^[A-Z][A-Z0-9_]{0,31}$/.test(String(body.code)))
              throw new Error('code 형식: [A-Z][A-Z0-9_]{0,31}');
            await write(
              '/admin/sectors' + (sector ? '/' + segment(sector.id) : ''),
              sector ? 'PATCH' : 'POST',
              sector ? { name: body.name, expectedRevision: sector.revision } : body,
            );
            setSector(undefined);
            sectors.refresh();
            return { status: 'SAVED' };
          })
        }
        label={sector ? `이름 수정 (revision ${sector.revision})` : '섹터 생성'}
      />
      {sector && <button onClick={() => setSector(undefined)}>새 섹터</button>}
      <ErrorNotice error={action.error ?? sectors.error ?? page.error} />
      <Table
        rows={sectors.data ?? []}
        columns={['code', 'name', 'revision']}
        onSelect={(row) => setSector(row as Sector)}
      />
      <Field label="종목 sectorId 필터">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setStock(undefined);
          }}
        >
          <option value="">전체</option>
          {sectors.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Table
        rows={page.items}
        columns={['id', 'name', 'sectorId', 'sectorRevision']}
        onSelect={(row) => {
          setStock(row as Identified);
          setAssignment(String(row.sectorId ?? ''));
        }}
      />
      <PageButtons {...page} />
      {stock && (
        <article className="result-card">
          <h3>{String(stock.name)} 배정</h3>
          <p>기준 stock.sectorRevision: {String(stock.sectorRevision)}</p>
          <Field label="배정 섹터">
            <select value={assignment} onChange={(e) => setAssignment(e.target.value)}>
              <option value="">미분류 (null)</option>
              {sectors.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <button
            disabled={action.busy || typeof stock.sectorRevision !== 'number'}
            onClick={() =>
              void action.execute(async () => {
                await write(`/admin/stocks/${segment(stock.id)}/sector`, 'PATCH', {
                  sectorId: assignment || null,
                  expectedRevision: stock.sectorRevision,
                });
                page.refresh();
                setStock(undefined);
                return { status: 'SAVED' };
              })
            }
          >
            종목 배정 저장
          </button>
        </article>
      )}
      {action.result !== undefined && <DataView value={action.result} />}
    </section>
  );
}
