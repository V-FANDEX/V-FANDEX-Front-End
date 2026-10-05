import { useState } from 'react';
import { useAction, usePage, useRemote } from '../../hooks/useRemote';
import { segment, write } from '../../services/contractApi';
import type { Identified, Row, RetentionPolicy, RetentionPreview } from '../../types/contracts';
import { Confirm, DataView, ErrorNotice, PageButtons, SettingsForm, Table, type FormField } from './Shared';
const root = '/admin/operations/retention';
export function RetentionPanel() {
  const policy = useRemote<RetentionPolicy>(root),
    automation = useRemote<Row>(root + '/automation');
  const [previewRequested, setPreview] = useState(false);
  const preview = useRemote<RetentionPreview>(previewRequested ? root + '/preview' : undefined);
  const [failed, setFailed] = useState<string[]>([]),
    [resolved, setResolved] = useState<string[]>([]),
    [confirmation, setConfirmation] = useState(false);
  const resetPreview = () => {
    setFailed([]);
    setResolved([]);
    setConfirmation(false);
    preview.refresh();
    policy.refresh();
  };
  const action = useAction(resetPreview);
  const [archiveId, setArchive] = useState('');
  const archives = usePage<Identified>(root + '/archives');
  const archive = useRemote<Row>(archiveId ? root + '/archives/' + segment(archiveId) : undefined);
  const fields: FormField[] = [
    { key: 'failedRunsEnabled', kind: 'boolean' },
    { key: 'resolvedAlertsEnabled', kind: 'boolean' },
    { key: 'automaticCleanupEnabled', kind: 'boolean' },
    { key: 'cleanupIntervalHours', kind: 'number', min: 1, max: 168 },
    { key: 'cleanupBatchSize', kind: 'number', min: 1, max: 100 },
  ];
  fields.push(
    { key: 'failedRunRetentionDays', kind: 'number', min: 7, max: 3650 },
    { key: 'resolvedAlertRetentionDays', kind: 'number', min: 7, max: 3650 },
  );
  const groups = preview.data
    ? ([
        ['failedRuns', preview.data.failedRuns.items],
        ['resolvedAlerts', preview.data.resolvedAlerts.items],
      ] as const)
    : [];
  return (
    <div className="contract-workspace">
      <section className="panel">
        <h2>이력 보존 정책</h2>
        <p>
          정리 전 원문은 같은 DB 아카이브에 무기한 보관됩니다. 외부 백업이나 복구 기능이 아닙니다. 자동 정리를
          켜면 한 간격 뒤가 첫 기한입니다.
        </p>
        <button onClick={policy.refresh}>정책 새로고침</button>
        <DataView value={policy.data} />
        <SettingsForm
          fields={fields}
          patch
          busy={action.busy}
          onSubmit={(body) =>
            void action.execute(async () => {
              if (typeof policy.data?.revision !== 'number')
                throw new Error('정책 revision을 읽어야 합니다.');
              await write(root, 'PATCH', { ...body, expectedRevision: policy.data.revision });
              resetPreview();
              automation.refresh();
              return { status: 'SAVED' };
            })
          }
        />
        <ErrorNotice error={policy.error ?? action.error} />
      </section>
      <section className="panel">
        <h2>자동 정리 상태</h2>
        <button onClick={automation.refresh}>상태 새로고침</button>
        <ErrorNotice error={automation.error} />
        <DataView value={automation.data} />
        <button
          disabled={action.busy}
          onClick={() =>
            void action.execute(async () => {
              const result = await write<Row>(root + '/run-due', 'POST');
              automation.refresh();
              archives.refresh();
              resetPreview();
              return {
                ...result,
                message:
                  result.status === 'COMPLETED'
                    ? '기한에 따른 처리 완료'
                    : `정리 완료 아님: ${result.status}`,
              };
            })
          }
        >
          기한 도래 작업 실행
        </button>
        <p>
          DISABLED / NOT_DUE / BUSY / COMPLETED를 구분합니다. 이 동작은 기한을 무시한 강제 정리가 아닙니다.
        </p>
      </section>
      <section className="panel">
        <h2>수동 정리 preview</h2>
        <button
          disabled={action.busy}
          onClick={() => {
            setPreview(true);
            resetPreview();
          }}
        >
          후보 미리보기 / 다시 조회
        </button>
        <ErrorNotice error={preview.error} />
        <DataView value={preview.data} />
        {groups.map(([key, value]) => {
          const target = /fail.*run|failed/i.test(key)
            ? 'failed'
            : /resolv.*alert|resolved/i.test(key)
              ? 'resolved'
              : undefined;
          if (!target) return null;
          const chosen = target === 'failed' ? failed : resolved,
            change = target === 'failed' ? setFailed : setResolved;
          return (
            <fieldset key={key}>
              <legend>{key} · 명시 선택 (최대 100개)</legend>
              {(value as Identified[])
                .filter((x) => typeof x.id === 'string')
                .map((row) => (
                  <label key={row.id} className="selection-row">
                    <input
                      type="checkbox"
                      disabled={
                        action.busy || preview.loading ||
                        (target === 'failed'
                          ? preview.data?.policy.failedRunsEnabled
                          : preview.data?.policy.resolvedAlertsEnabled) === false
                      }
                      checked={chosen.includes(row.id)}
                      onChange={(e) =>
                        change((current) =>
                          e.target.checked
                            ? [...current, row.id].slice(0, 100)
                            : current.filter((id) => id !== row.id),
                        )
                      }
                    />
                    {row.id} <DataView value={row} />
                  </label>
                ))}
            </fieldset>
          );
        })}
        <button
          className="primary-button"
          disabled={action.busy || preview.loading || !preview.data || (!failed.length && !resolved.length)}
          onClick={() => setConfirmation(true)}
        >
          선택 {failed.length + resolved.length}개 정리 검토
        </button>
      </section>
      <section className="panel">
        <h2>원문 아카이브</h2>
        <ErrorNotice error={archives.error ?? archive.error} />
        <Table
          rows={archives.items}
          columns={[
            'id',
            'version',
            'trigger',
            'adminId',
            'policyRevision',
            'createdAt',
            'failedRunCount',
            'resolvedAlertCount',
          ]}
          onSelect={(row) => setArchive(String(row.id))}
        />
        <PageButtons {...archives} />
        {archiveId && (
          <article>
            <h3>아카이브 원문 {archiveId}</h3>
            <DataView value={archive.data} />
          </article>
        )}
      </section>
      {action.result !== undefined && (
        <section className="panel">
          <DataView value={action.result} />
        </section>
      )}
      {confirmation && (
        <Confirm
          title="선택 이력 정리 확인"
          busy={action.busy}
          onClose={() => setConfirmation(false)}
          onConfirm={() =>
            void action.execute(async () => {
              const revision = preview.data?.policy.revision;
              if (typeof revision !== 'number')
                throw new Error(
                  'preview의 정책 revision이 확인되지 않아 실행할 수 없습니다. 다시 조회하세요.',
                );
              const result = await write(root + '/cleanup', 'POST', {
                confirm: true,
                expectedRevision: revision,
                ...(failed.length ? { failedRunIds: failed } : {}),
                ...(resolved.length ? { resolvedAlertIds: resolved } : {}),
              });
              resetPreview();
              archives.refresh();
              automation.refresh();
              return result;
            })
          }
        >
          <p>
            선택한 실패 실행 {failed.length}개, 해결 경보 {resolved.length}개를 정리합니다. 원문은 DB
            아카이브에 보관됩니다. 요청을 자동 재시도하지 않습니다.
          </p>
          <DataView value={{ failedRunIds: failed, resolvedAlertIds: resolved }} />
        </Confirm>
      )}
    </div>
  );
}
