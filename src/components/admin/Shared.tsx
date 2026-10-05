import { useState, type ReactNode } from 'react';
import { ApiError } from '../../services/apiClient';
import { localDate, numeric } from '../../utils/contracts';
import type { Row } from '../../types/contracts';

export function ErrorNotice({ error }: { error?: unknown }) {
  if (!error) return null;
  const messages: Record<number, string> = {
    0: '연결 설정',
    400: '입력 확인',
    401: '인증 확인 (생성 요청은 제공자 인증 오류일 수도 있습니다)',
    403: '현재 DB 관리자 권한이 필요합니다',
    404: '대상을 찾을 수 없습니다',
    409: '충돌: 최신 데이터를 읽었습니다. 작성 내용과 비교 후 다시 검토하세요',
    429: '사용 한도 초과',
    502: '제공자 오류',
    503: '서비스/제공자 사용 불가',
    504: '제공자 응답 지연',
  };
  return (
    <div className="form-error" role="alert">
      {error instanceof ApiError && <strong>{messages[error.status] ?? `HTTP ${error.status}`} · </strong>}
      {error instanceof Error ? error.message : '요청 실패'}
      {error instanceof ApiError && error.path && <small> {error.path}</small>}
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function DataView({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'true' : 'false'}</span>;
  if (typeof value !== 'object')
    return (
      <span>
        {typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) ? localDate(value) : String(value)}
      </span>
    );
  if (Array.isArray(value))
    return value.length ? (
      <ol className="data-list">
        {value.map((item, index) => (
          <li key={index}>
            <DataView value={item} />
          </li>
        ))}
      </ol>
    ) : (
      <span>기록 없음</span>
    );
  return (
    <dl className="data-grid">
      {Object.entries(value)
        .filter(([key]) => !['leaseToken', 'error', 'errorMessage', 'stack'].includes(key))
        .map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              {key === 'documentId' && typeof item === 'string' ? (
                item.startsWith('event:') ? (
                  <a
                    href={`/news?eventId=${encodeURIComponent(item.slice(6))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    공개 기사 {item.slice(6)}
                  </a>
                ) : (
                  <a href={`#draft-${item.replace(':', '-')}`}>초안 단계 {item.slice(5)}</a>
                )
              ) : key === 'eventId' && typeof item === 'string' ? (
                <a href={`/news?eventId=${encodeURIComponent(item)}`} target="_blank" rel="noreferrer">
                  공개 기사 {item}
                </a>
              ) : key === 'eventIds' && Array.isArray(item) ? (
                item.map((id) => (
                  <p key={String(id)}>
                    <a
                      href={`/news?eventId=${encodeURIComponent(String(id))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      공개 기사 {String(id)}
                    </a>
                  </p>
                ))
              ) : (
                <DataView value={item} />
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function Table({
  rows,
  columns,
  onSelect,
}: {
  rows: Row[];
  columns: string[];
  onSelect?: (row: Row) => void;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table className="contract-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            {onSelect && <th>상세</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((c) => (
                <td key={c}>
                  <DataView value={row[c]} />
                </td>
              ))}
              {onSelect && (
                <td>
                  <button type="button" className="ghost-button" onClick={() => onSelect(row)}>
                    열기
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="panel-copy">기록이 없습니다.</p>
  );
}
export function PageButtons({
  loading,
  hasMore,
  more,
  refresh,
}: {
  loading: boolean;
  hasMore: boolean;
  more: () => void;
  refresh: () => void;
}) {
  return (
    <div className="toolbar">
      <button className="secondary-button" disabled={loading} onClick={refresh}>
        새로고침
      </button>
      <button className="secondary-button" disabled={loading || !hasMore} onClick={more}>
        {loading ? '조회 중…' : hasMore ? '더 보기' : '마지막 페이지'}
      </button>
    </div>
  );
}
export interface FormField {
  key: string;
  label?: string;
  kind?: 'number' | 'text' | 'textarea' | 'boolean' | 'datetime-local' | 'select';
  min?: number;
  max?: number;
  decimals?: number;
  required?: boolean;
  maxLength?: number;
  options?: string[];
}
export function SettingsForm({
  fields,
  initial = {},
  patch = false,
  busy,
  onSubmit,
  label = '저장',
}: {
  fields: FormField[];
  initial?: Row;
  patch?: boolean;
  busy: boolean;
  onSubmit: (body: Row) => void;
  label?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>();
  return (
    <form
      className="contract-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);
        try {
          const body: Row = {};
          for (const field of fields) {
            if (patch && !(field.key in values)) continue;
            const value =
              values[field.key] ?? (initial[field.key] === undefined ? '' : String(initial[field.key]));
            if (!value.trim()) {
              if (field.required) throw new Error(`${field.label ?? field.key}: 필수 입력`);
              continue;
            }
            body[field.key] =
              field.kind === 'number'
                ? numeric(
                    value,
                    field.label ?? field.key,
                    field.min ?? 0,
                    field.max ?? Number.MAX_SAFE_INTEGER,
                    field.decimals ?? 0,
                  )
                : field.kind === 'boolean'
                  ? value === 'true'
                  : field.kind === 'datetime-local'
                    ? new Date(value).toISOString()
                    : value.trim();
          }
          if (patch && !Object.keys(body).length) throw new Error('변경할 값을 입력하세요.');
          onSubmit(body);
        } catch (err) {
          setError(err);
        }
      }}
    >
      <fieldset disabled={busy}>
        <div className="form-grid">
          {fields.map((field) => (
            <Field key={field.key} label={field.label ?? field.key}>
              {field.kind === 'boolean' || field.kind === 'select' ? (
                <select
                  value={values[field.key] ?? String(initial[field.key] ?? '')}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                >
                  <option value="">{patch ? '변경 없음' : '기본값 사용'}</option>
                  {(field.kind === 'boolean' ? ['false', 'true'] : (field.options ?? [])).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              ) : field.kind === 'textarea' ? (
                <textarea
                  maxLength={field.maxLength}
                  value={values[field.key] ?? String(initial[field.key] ?? '')}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              ) : (
                <input
                  type={field.kind === 'datetime-local' ? field.kind : 'text'}
                  inputMode={field.kind === 'number' ? 'decimal' : undefined}
                  maxLength={field.maxLength}
                  value={values[field.key] ?? String(initial[field.key] ?? '')}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        <ErrorNotice error={error} />
        <button className="primary-button" type="submit">
          {busy ? '요청 중…' : label}
        </button>
      </fieldset>
    </form>
  );
}
export function Confirm({
  title,
  children,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">
          <button disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="primary-button" disabled={busy} onClick={onConfirm}>
            {busy ? '처리 중…' : '확인 후 실행'}
          </button>
        </div>
      </div>
    </div>
  );
}
