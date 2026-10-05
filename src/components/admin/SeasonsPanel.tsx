import { useState } from 'react';
import { useAction, useRemote } from '../../hooks/useRemote';
import { segment, write } from '../../services/contractApi';
import type { Identified, Row } from '../../types/contracts';
import { Confirm, DataView, ErrorNotice, Field, SettingsForm, Table } from './Shared';
export function SeasonsPanel() {
  const seasons = useRemote<Identified[]>('/seasons'),
    action = useAction(seasons.refresh);
  const [id, setId] = useState(''),
    [mode, setMode] = useState('RESET'),
    [confirm, setConfirm] = useState(false);
  return (
    <section className="panel">
      <h2>시즌 생성 / 전환</h2>
      <p>
        새 시즌 기본 정책은 RESET입니다. 현금·보유를 초기화하고 열린 주문을 취소합니다. CARRY는 자산을
        이월하며 열린 주문은 취소합니다. 이전 시즌 자산과 순위는 종료 스냅샷으로 보존됩니다.
      </p>
      <SettingsForm
        fields={[
          { key: 'name', required: true, maxLength: 100 },
          { key: 'startsAt', label: '시작 (현지 시각)', kind: 'datetime-local', required: true },
          { key: 'endsAt', label: '종료 (현지 시각)', kind: 'datetime-local', required: true },
          { key: 'initialCash', kind: 'number', required: true, min: 0 },
        ]}
        busy={action.busy}
        label="UPCOMING 시즌 생성"
        onSubmit={(body) =>
          void action.execute(async () => {
            if (Date.parse(String(body.startsAt)) >= Date.parse(String(body.endsAt)))
              throw new Error('종료는 시작보다 늦어야 합니다.');
            const result = await write('/admin/seasons', 'POST', body);
            seasons.refresh();
            return result;
          })
        }
      />
      <button onClick={seasons.refresh}>새로고침</button>
      <ErrorNotice error={seasons.error ?? action.error} />
      <Table
        rows={seasons.data ?? []}
        columns={['id', 'name', 'status', 'startsAt', 'endsAt']}
        onSelect={(row) => setId(String(row.id))}
      />
      {id && (
        <>
          <p>선택 시즌 {id}</p>
          <Field label="시작 방식">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>RESET</option>
              <option>CARRY</option>
            </select>
          </Field>
          <button
            disabled={action.busy || seasons.data?.find((s) => s.id === id)?.status !== 'UPCOMING'}
            onClick={() => setConfirm(true)}
          >
            새 시즌 시작 검토
          </button>
          <button
            disabled={action.busy || seasons.data?.find((s) => s.id === id)?.status !== 'ACTIVE'}
            onClick={() => {
              if (
                window.confirm(
                  '현재 시즌을 종료하고 자산·순위를 동결하시겠습니까? 새 시즌 전까지 주문·배당 청구가 닫힙니다.',
                )
              )
                void action.execute(async () => {
                  const result = await write(`/admin/seasons/${segment(id)}/end`, 'POST');
                  seasons.refresh();
                  return result;
                });
            }}
          >
            선택 시즌 종료
          </button>
        </>
      )}
      {action.result !== undefined && <DataView value={action.result as Row} />}
      {confirm && (
        <Confirm
          title={`시즌 시작 · ${mode}`}
          busy={action.busy}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            void action.execute(async () => {
              const result = await write(
                `/admin/seasons/${segment(id)}/start`,
                'POST',
                mode === 'RESET' ? { confirm: true } : { mode: 'CARRY' },
              );
              setConfirm(false);
              seasons.refresh();
              return result;
            })
          }
        >
          <p>
            {mode === 'RESET'
              ? '모든 계정의 현금과 보유 주식을 초기화합니다.'
              : '현금과 보유 주식을 이월합니다.'}{' '}
            열린 주문은 취소됩니다. 계속하시겠습니까?
          </p>
        </Confirm>
      )}
    </section>
  );
}
