import { useState } from 'react';
import { newOperation, operationRequest, useAction, usePage, useRemote } from '../../hooks/useRemote';
import { withQuery } from '../../services/apiClient';
import { segment, write } from '../../services/contractApi';
import { useFandexStore } from '../../store/useFandexStore';
import type { Identified, Row } from '../../types/contracts';
import { additionalStockIds } from '../../utils/contracts';
import { DataView, ErrorNotice, Field, PageButtons, SettingsForm, Table, type FormField } from './Shared';
const fields: FormField[] = [
  { key: 'stockId', required: true },
  { key: 'prompt', kind: 'textarea', required: true, maxLength: 1000 },
  { key: 'stepCount', kind: 'number', min: 2, max: 12 },
  { key: 'horizonDays', kind: 'number', min: 2, max: 30 },
  { key: 'intervalHours', kind: 'number', min: 1, max: 720 },
  { key: 'dailyLimit', kind: 'number', min: 1, max: 24 },
  { key: 'retryMinutes', kind: 'number', min: 1, max: 1440 },
  { key: 'isEnabled', kind: 'boolean' },
  { key: 'nextRunAt', label: '다음 실행 (현지 시각 → UTC)', kind: 'datetime-local' },
  { key: 'additionalStockIds', label: '추가 종목 IDs (쉼표 구분, []로 비우기)' },
  { key: 'continueLatestCompleted', kind: 'boolean' },
];
export function SchedulesPanel() {
  const budget = useRemote<Row>('/admin/storyline-generation/budget');
  const [stockId, setStock] = useState(''),
    [enabled, setEnabled] = useState(''),
    [selected, setSelected] = useState('');
  const page = usePage<Identified>(
    withQuery('/admin/storyline-schedules/page', { stockId, isEnabled: enabled, limit: 50 }),
  );
  const action = useAction(budget.refresh);
  return (
    <div className="contract-workspace">
      <section className="panel">
        <h2>전역 생성 사용량 (UTC)</h2>
        <DataView value={budget.data} />
        <p>
          기본 하루 100회. oneShot + scheduled + summary + review attempts를 공유합니다. dailyLimit=0은 신규
          접수 중지이며 사용량 초기화가 아닙니다.
        </p>
        <button onClick={budget.refresh}>사용량 새로고침</button>
        <SettingsForm
          fields={[{ key: 'dailyLimit', kind: 'number', min: 0, max: 10000, required: true }]}
          busy={action.busy}
          onSubmit={(body) =>
            void action.execute(async () => {
              if (typeof budget.data?.revision !== 'number')
                throw new Error('정책 revision을 먼저 읽으세요.');
              await write('/admin/storyline-generation/budget', 'PATCH', {
                ...body,
                expectedRevision: budget.data.revision,
              });
              budget.refresh();
            })
          }
        />
        <ErrorNotice error={budget.error ?? action.error} />
      </section>
      <section className="panel">
        <h2>반복 생성 일정</h2>
        <p>
          기본 간격 24h / 일정별 일한도 2 / 재시도 15분 / 비활성. 생성물은 PAUSED 초안이며 자동 발행되지
          않습니다.
        </p>
        <div className="form-grid">
          <Field label="대표 종목 필터">
            <input
              value={stockId}
              onChange={(e) => {
                setStock(e.target.value);
                setSelected('');
              }}
            />
          </Field>
          <Field label="활성 필터">
            <select
              value={enabled}
              onChange={(e) => {
                setEnabled(e.target.value);
                setSelected('');
              }}
            >
              <option value="">전체</option>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
          </Field>
        </div>
        <ErrorNotice error={page.error} />
        <Table
          rows={page.items}
          columns={[
            'id',
            'stockId',
            'isEnabled',
            'revision',
            'intervalHours',
            'dailyLimit',
            'nextRunAt',
            'lastRunAt',
            'lastErrorCode',
          ]}
          onSelect={(row) => setSelected(String(row.id))}
        />
        <PageButtons {...page} />
        <button onClick={() => setSelected('')}>새 일정</button>
      </section>
      <ScheduleEditor
        key={selected}
        id={selected}
        refresh={() => {
          page.refresh();
          budget.refresh();
        }}
      />
    </div>
  );
}
function ScheduleEditor({ id, refresh }: { id: string; refresh: () => void }) {
  const path = '/admin/storyline-schedules' + (id ? '/' + segment(id) : '');
  const detail = useRemote<Identified>(id ? path : undefined);
  const action = useAction(detail.refresh);
  const user = useFandexStore((s) => s.user);
  const scope = `${user?.id}:schedule:${id || 'new'}`;
  return (
    <section className="panel">
      <h3>{id ? '일정 상세 / 부분 수정' : '일정 생성'}</h3>
      <ErrorNotice error={detail.error ?? action.error} />
      {id && (
        <>
          <button onClick={detail.refresh}>최신 설정 읽기</button>
          <DataView value={detail.data} />
        </>
      )}
      <SettingsForm
        fields={fields}
        patch={Boolean(id)}
        busy={action.busy}
        onSubmit={(body) =>
          void action.execute(async () => {
            if (body.additionalStockIds !== undefined)
              body.additionalStockIds = additionalStockIds(
                String(body.additionalStockIds),
                String(body.stockId ?? detail.data?.stockId ?? ''),
              );
            if (
              body.stockId &&
              body.additionalStockIds === undefined &&
              Array.isArray(detail.data?.additionalStockIds) &&
              detail.data.additionalStockIds.includes(body.stockId)
            )
              throw new Error('대표 종목이 기존 추가 대상과 겹칩니다. 추가 대상도 함께 수정하세요.');
            if (id) {
              if (typeof detail.data?.revision !== 'number') throw new Error('revision 조회가 필요합니다.');
              await write(path, 'PATCH', { ...body, expectedRevision: detail.data.revision });
            } else await operationRequest(scope, path, body);
            detail.refresh();
            refresh();
            return { status: 'SAVED' };
          })
        }
      />
      <button
        disabled={action.busy}
        onClick={() => {
          if (window.confirm('별도의 새 작업을 준비하시겠습니까?')) newOperation(scope);
        }}
      >
        새 생성 작업 준비
      </button>
      {id && (
        <>
          <button
            disabled={action.busy}
            onClick={() =>
              void action.execute(async () => {
                const result = await operationRequest<Row>(scope + ':run', path + '/run', undefined);
                refresh();
                detail.refresh();
                return {
                  ...result,
                  message:
                    result.status === 'COMPLETED' && result.storylineId
                      ? 'PAUSED 초안 생성 완료'
                      : `생성 완료 아님: ${result.status}`,
                };
              })
            }
          >
            {action.busy ? '실행 중…' : '수동 실행 / 동일 작업 재시도'}
          </button>
          <button
            disabled={action.busy}
            onClick={() => {
              if (window.confirm('새 실행은 한도를 다시 사용할 수 있습니다. 계속하시겠습니까?'))
                newOperation(scope + ':run');
            }}
          >
            새 실행 준비
          </button>
          <ScheduleRuns id={id} />
        </>
      )}
      {action.result !== undefined && <DataView value={action.result} />}
      <p>
        FAILED·STALE·DISABLED·LEASED·DAILY_LIMIT·GLOBAL_DAILY_LIMIT는 생성 완료가 아닙니다. 요청 접수 후
        실패도 한도를 사용하며 같은 실패 키는 과거 결과를 재생합니다.
      </p>
    </section>
  );
}
function ScheduleRuns({ id }: { id: string }) {
  const [status, setStatus] = useState('');
  const page = usePage<Identified>(
    withQuery(`/admin/storyline-schedules/${segment(id)}/runs`, { status, limit: 50 }),
  );
  return (
    <>
      <h4>실행 이력</h4>
      <Field label="실행 상태">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">전체</option>
          {['RUNNING', 'COMPLETED', 'FAILED', 'STALE'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <ErrorNotice error={page.error} />
      <Table
        rows={page.items}
        columns={['id', 'status', 'claimedAt', 'finishedAt', 'errorCode', 'storylineId']}
      />
      <PageButtons {...page} />
    </>
  );
}
