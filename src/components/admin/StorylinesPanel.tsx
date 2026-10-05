import { useState } from 'react';
import { newOperation, operationRequest, useAction, useRemote } from '../../hooks/useRemote';
import { read, segment, write } from '../../services/contractApi';
import { useFandexStore } from '../../store/useFandexStore';
import type { Artifact, Row, Storyline, StoryPreview } from '../../types/contracts';
import { additionalStockIds, sourceMode } from '../../utils/contracts';
import { validateDraft } from '../../utils/storyline';
import { DataView, ErrorNotice, Field, SettingsForm, Table } from './Shared';
export function StorylinesPanel() {
  const stories = useRemote<Storyline[]>('/admin/storylines');
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState('independent'),
    [source, setSource] = useState('');
  const action = useAction(stories.refresh);
  const user = useFandexStore((s) => s.user);
  const scope = `${user?.id}:generate`;
  return (
    <div className="contract-workspace">
      <section className="panel">
        <h2>스토리라인 PAUSED 초안 생성</h2>
        <p>
          접수 후 실패도 전역 한도를 사용합니다. 응답 유실 시 같은 작업을 다시 제출하세요. 요청 취소는 LLM
          취소나 한도 환급을 뜻하지 않습니다. 생성만으로 발행하지 않습니다.
        </p>
        <Field label="원본 모드">
          <select disabled={action.busy} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="independent">독립</option>
            <option value="continuation">완료 서사 하나 후속</option>
            <option value="latest">최근 완료 서사 자동 후속</option>
            <option value="merge">완료 분기 병합</option>
          </select>
        </Field>
        {(mode === 'continuation' || mode === 'merge') && (
          <Field
            label={mode === 'merge' ? '같은 대표 종목의 완료 서사 ID 2~4개 (쉼표 구분)' : '완료 서사 ID'}
          >
            <input disabled={action.busy} value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
        )}
        <SettingsForm
          fields={[
            { key: 'stockId', label: '대표 종목 ID', required: true },
            { key: 'prompt', label: '생성 요청', kind: 'textarea', required: true, maxLength: 1000 },
            { key: 'stepCount', kind: 'number', min: 2, max: 12 },
            { key: 'horizonDays', kind: 'number', min: 2, max: 30 },
            { key: 'additionalStockIds', label: '추가 종목 ID (쉼표 구분, 최대 9개)' },
          ]}
          busy={action.busy}
          label="생성 / 동일 작업 재시도"
          onSubmit={(body) =>
            void action.execute(async () => {
              const request = {
                ...body,
                ...sourceMode(mode, source),
                ...(body.additionalStockIds
                  ? {
                      additionalStockIds: additionalStockIds(
                        String(body.additionalStockIds),
                        String(body.stockId),
                      ),
                    }
                  : {}),
              };
              const result = await operationRequest<Storyline>(scope, '/admin/storylines/generate', request);
              stories.refresh();
              setSelected(result.id);
              return { id: result.id, state: result.state };
            })
          }
        />
        <button
          disabled={action.busy}
          onClick={() => {
            if (window.confirm('새 생성 작업은 한도를 다시 사용합니다. 시작하시겠습니까?'))
              newOperation(scope);
          }}
        >
          새 작업 시작
        </button>
        {action.busy && <p role="status">생성 중입니다. 완료까지 시간이 걸릴 수 있습니다.</p>}
        <ErrorNotice error={action.error ?? stories.error} />
        {action.result !== undefined && <DataView value={action.result} />}
      </section>
      <section className="panel">
        <h2>저장된 서사</h2>
        <button onClick={stories.refresh}>새로고침</button>
        <Table
          rows={stories.data ?? []}
          columns={['id', 'type', 'stockId', 'state', 'revision', 'nextStep', 'startedAt']}
          onSelect={(row) => setSelected(String(row.id))}
        />
      </section>
      {selected && (
        <StoryEditor
          key={selected}
          id={selected}
          original={stories.data?.find((story) => story.id === selected)}
          refresh={stories.refresh}
        />
      )}
    </div>
  );
}
function StoryEditor({ id, original, refresh }: { id: string; original?: Storyline; refresh: () => void }) {
  const path = `/admin/storylines/${segment(id)}`;
  const saved = useRemote<StoryPreview>(`${path}/preview`),
    [draft, setDraft] = useState(''),
    [preview, setPreview] = useState<unknown>();
  const [baseRevision, setBaseRevision] = useState<number>();
  const refreshAll = () => {
    saved.refresh();
    refresh();
  };
  const action = useAction(refreshAll);
  const current =
    saved.data && original?.revision === saved.data.revision && Array.isArray(original.steps)
      ? { ...saved.data, stockId: original.stockId, marketId: original.marketId, steps: original.steps }
      : undefined;
  const editable = current?.state === 'PAUSED' && current.nextStep === 0;
  const loadDraft = () => {
    if (!current) return;
    const { type, stockId, marketId, startedAt, steps, revision } = current;
    setDraft(
      JSON.stringify(
        {
          type,
          ...(stockId ? { stockId } : {}),
          ...(marketId ? { marketId } : {}),
          startedAt,
          steps: steps.map((step) =>
            Object.fromEntries(
              Object.entries(step).filter(
                ([key]) =>
                  !['storylineStep', 'scheduledAt', 'effectiveStockIds', 'effectiveMarketIds'].includes(key),
              ),
            ),
          ),
        },
        null,
        2,
      ),
    );
    setBaseRevision(revision);
  };
  return (
    <section className="panel">
      <h2>서사 편집 / 검토 · {id}</h2>
      <ErrorNotice error={saved.error ?? action.error} />
      <button onClick={refreshAll}>최신 저장본 조회</button>
      {saved.data && !current && <p>원본과 preview revision이 다릅니다. 최신 저장본을 다시 조회하세요.</p>}
      <DataView value={saved.data} />
      {current?.steps.map((step, index) => (
        <details id={`draft-step-${index}`} key={index}>
          <summary>초안 단계 {index}</summary>
          <DataView value={{ headline: step.headline, body: step.body }} />
        </details>
      ))}
      <div className="toolbar">
        <button disabled={!editable || action.busy} onClick={loadDraft}>
          저장본을 편집기에 불러오기
        </button>
        <button
          disabled={action.busy || !saved.data}
          onClick={() =>
            void action.execute(async () => {
              const quality = await read(`${path}/quality`);
              setPreview(quality);
              return quality;
            })
          }
        >
          저장본 규칙 검토 (무료)
        </button>
      </div>
      <p>
        JSON 편집기는 관리자 전용입니다. worldUpdates는 종목/시장 중 하나의 대상과 0~1 세계 상태를 사용합니다.
        수정은 PAUSED·미진행 초안에만 가능하며 전체 대체입니다.
      </p>
      <Field label="초안 JSON">
        <textarea className="json-editor" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </Field>
      <div className="toolbar">
        <button
          disabled={!draft || action.busy}
          onClick={() =>
            void action.execute(async () => {
              const result = await write('/admin/storylines/preview', 'POST', validateDraft(draft));
              setPreview(result);
              return result;
            })
          }
        >
          저장 전 preview
        </button>
        <button
          disabled={!draft || action.busy}
          onClick={() =>
            void action.execute(async () => {
              const result = await write('/admin/storylines/quality', 'POST', validateDraft(draft));
              setPreview(result);
              return result;
            })
          }
        >
          저장 전 규칙 검토
        </button>
        <button
          disabled={!editable || baseRevision === undefined || !draft || action.busy}
          onClick={() =>
            void action.execute(async () => {
              await write(`${path}/draft`, 'PATCH', {
                ...validateDraft(draft),
                expectedRevision: baseRevision,
              });
              setDraft('');
              setBaseRevision(undefined);
              saved.refresh();
              refresh();
              return { status: 'SAVED' };
            })
          }
        >
          초안 저장 (revision {baseRevision ?? '—'})
        </button>
      </div>
      <p>규칙 통과는 자동 승인이 아닙니다. coverage=NOT_EVALUATED는 평가하지 않은 범위입니다.</p>
      {preview !== undefined && <DataView value={preview} />}
      <div className="toolbar">
        {['ACTIVE', 'PAUSED', 'CANCELED'].map((state) => (
          <button
            key={state}
            disabled={action.busy || !saved.data || ['COMPLETED', 'CANCELED'].includes(saved.data.state)}
            onClick={() => {
              if (
                window.confirm(
                  state === 'ACTIVE'
                    ? '발행을 재개합니다. 기한이 지난 단계는 곧 발행될 수 있습니다. 계속하시겠습니까?'
                    : `${state}로 변경하시겠습니까?`,
                )
              )
                void action.execute(async () => {
                  await write(path, 'PATCH', { state });
                  saved.refresh();
                  refresh();
                  return { state };
                });
            }}
          >
            {state === 'ACTIVE' ? '검토 후 명시 재개' : state === 'PAUSED' ? '일시정지' : '취소'}
          </button>
        ))}
      </div>
      <ArtifactPanel
        key={`${id}:${saved.data?.revision}`}
        id={id}
        storyline={current}
        refreshStory={refreshAll}
      />
    </section>
  );
}
function ArtifactPanel({
  id,
  storyline,
  refreshStory,
}: {
  id: string;
  storyline?: Storyline;
  refreshStory: () => void;
}) {
  const path = `/admin/storylines/${segment(id)}`,
    user = useFandexStore((s) => s.user);
  const contextSource =
    storyline?.state === 'COMPLETED'
      ? id
      : typeof storyline?.continuationOfId === 'string'
        ? storyline.continuationOfId
        : undefined;
  const context = useRemote<Row>(
      contextSource ? `/admin/storylines/${segment(contextSource)}/continuity-context` : undefined,
    ),
    summary = useRemote<Artifact>(`${path}/summary`),
    review = useRemote<Artifact>(`${path}/semantic-review`);
  const action = useAction(() => {
    refreshStory();
    summary.refresh();
    review.refresh();
  });
  const generate = (type: 'summary' | 'semantic-review', artifact: Artifact | undefined) =>
    void action.execute(async () => {
      if (!artifact || (artifact.status !== 'MISSING' && artifact.revision === undefined) || !storyline)
        throw new Error('최신 revision을 먼저 읽어야 합니다.');
      await operationRequest(`${user?.id}:${id}:${type}`, `${path}/${type}`, {
        expectedRevision: artifact.status === 'MISSING' ? 0 : artifact.revision,
        ...(type === 'semantic-review' ? { expectedStorylineRevision: storyline.revision } : {}),
      });
      summary.refresh();
      review.refresh();
      return { status: '생성 후 현재 유효성 다시 조회' };
    });
  return (
    <>
      <h3>후속 문맥</h3>
      <p>
        공개 기사 발췌와 유효 모델 요약을 구분합니다. truncation/coverage 범위만 포함하며 전체 역사가
        아닙니다.
      </p>
      <ErrorNotice error={context.error} />
      <DataView value={context.data} />
      {(
        [
          ['summary', '공개 기사 요약', summary],
          ['semantic-review', '의미 검토', review],
        ] as const
      ).map(([type, label, remote]) => (
        <article key={type} className="result-card">
          <h3>
            {label} · {remote.data?.status ?? '조회 중'}
          </h3>
          <button onClick={remote.refresh}>유효성 새로고침</button>
          <ErrorNotice error={remote.error} />
          {remote.data?.status === 'AVAILABLE' ? (
            <DataView value={remote.data} />
          ) : (
            <p>
              {remote.data?.status === 'STALE'
                ? '오래된 본문은 숨겼습니다. 최신 원본을 검토한 뒤 명시적으로 재생성하세요.'
                : '유효한 기록이 없습니다.'}
            </p>
          )}
          <button
            disabled={
              action.busy ||
              !remote.data ||
              !storyline ||
              (type === 'summary'
                ? storyline.state !== 'COMPLETED' || !storyline.stockId
                : storyline.state !== 'PAUSED' || storyline.nextStep !== 0 || !storyline.stockId)
            }
            onClick={() => generate(type, remote.data)}
          >
            한도 사용 · 생성 / 동일 작업 재시도
          </button>
          <button
            disabled={action.busy}
            onClick={() => {
              if (window.confirm('현재 revision을 검토한 새 유료 작업을 시작하시겠습니까?'))
                newOperation(`${user?.id}:${id}:${type}`);
            }}
          >
            새 작업 준비
          </button>
        </article>
      ))}
      <p>
        요약·의미 검토는 전역 UTC 일일 한도를 공유합니다. 모델의 의심과 제안이며 blocking=false,
        semanticAccuracy=NOT_VERIFIED입니다. 자동 승인되지 않습니다.
      </p>
      <ErrorNotice error={action.error} />
    </>
  );
}
