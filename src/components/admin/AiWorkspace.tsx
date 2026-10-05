import { useEffect, useState } from 'react';
import { read, segment, write } from '../../services/contractApi';
import { useAction, usePage, useRemote } from '../../hooks/useRemote';
import type { AiProfile, Decision, DecisionDetail, Row } from '../../types/contracts';
import { calibrationRules, decisionLabels, ids, personalityKeys } from '../../utils/contracts';
import { DataView, ErrorNotice, Field, PageButtons, SettingsForm, Table, type FormField } from './Shared';
import { PerformancePanel, ComparisonPanel } from './StrategyAnalysis';

const strategies = [
  'VALUE',
  'MOMENTUM',
  'CONTRARIAN',
  'SWING',
  'LONG_TERM',
  'NEWS',
  'FAN',
  'DAY_TRADER',
  'SCALPER',
  'MARKET_MAKER',
  'AGGRESSIVE',
  'STABLE',
  'RANDOM',
  'MARKET_FOCUSED',
];
const fields: FormField[] = [
  { key: 'nickname', label: '닉네임', required: true, maxLength: 32 },
  { key: 'strategyType', kind: 'select', options: strategies, required: true },
  { key: 'riskLevel', kind: 'number', min: 1, max: 10, required: true },
  ...['preferredMarketIds', 'watchlistStockIds', 'favoriteStockIds'].map((key) => ({
    key,
    label: `${key} (쉼표로 구분, 최대 20개; []로 비우기)`,
  })),
  ...Object.entries(calibrationRules).map(([key, [min, max, defaultValue]]) => ({
    key,
    label: `${key} (${min}~${max}, 기본 ${defaultValue})`,
    kind: 'number' as const,
    min,
    max,
    decimals: 4,
  })),
  ...personalityKeys.map((key) => ({
    key: `personality.${key}`,
    label: key + ' (성격 0~1)',
    kind: 'number' as const,
    min: 0,
    max: 1,
    decimals: 10,
  })),
];
export function AiWorkspace() {
  const accounts = useRemote<AiProfile[]>('/admin/ai-accounts');
  const [selected, setSelected] = useState(''),
    [tab, setTab] = useState('accounts');
  const profile = accounts.data?.find((x) => x.id === selected);
  return (
    <div className="contract-workspace">
      <div className="segmented">
        {[
          ['accounts', 'AI 계정 / 판단 이력'],
          ['performance', '실제 계정의 시즌 성과'],
          ['compare', '과거 가격 전략 비교'],
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <ErrorNotice error={accounts.error} />
      {tab === 'accounts' && (
        <>
          <section className="panel">
            <Field label="AI profile 선택">
              <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">새 AI 계정</option>
                {accounts.data?.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nickname ?? x.user?.nickname ?? x.id} · {x.strategyType}
                  </option>
                ))}
              </select>
            </Field>
            <button onClick={accounts.refresh}>최신 프로필 읽기</button>
          </section>
          {(!selected || profile) && (
            <ProfileEditor key={`profile:${selected}`} profile={profile} refresh={accounts.refresh} />
          )}
          {selected && <DecisionHistory key={`decisions:${selected}`} agentId={selected} />}
        </>
      )}
      {tab === 'performance' && <PerformancePanel accounts={accounts.data ?? []} />}
      {tab === 'compare' && <ComparisonPanel />}
    </div>
  );
}
function ProfileEditor({ profile, refresh }: { profile?: AiProfile; refresh: () => void }) {
  const action = useAction(refresh);
  const [latest, setLatest] = useState<AiProfile>();
  const initial: Row = { ...profile };
  for (const key of personalityKeys)
    if (profile?.personality?.[key] !== undefined) initial[`personality.${key}`] = profile.personality[key];
  for (const key of ['preferredMarketIds', 'watchlistStockIds', 'favoriteStockIds'])
    if (Array.isArray(initial[key])) initial[key] = (initial[key] as string[]).join(',');
  const save = (values: Row) =>
    void action.execute(async () => {
      const body: Row = {},
        personality: Row = {};
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith('personality.')) personality[key.slice(12)] = value;
        else if (key.endsWith('Ids')) {
          const list = value === '[]' ? [] : ids(String(value));
          if (list.length > 20) throw new Error('관심 대상은 최대 20개입니다.');
          body[key] = list;
        } else body[key] = value;
      }
      if (Object.keys(personality).length) body.personality = personality;
      await write(
        `/admin/ai-accounts${profile ? '/' + segment(profile.id) : ''}`,
        profile ? 'PATCH' : 'POST',
        body,
      );
      const current = await read<AiProfile[]>('/admin/ai-accounts');
      setLatest(current.find((x) => x.id === profile?.id));
      refresh();
      return {
        status: 'SAVED',
        message: '저장했습니다. 기존 주문은 유지하며 이미 시작한 판단은 당시 설정으로 완료될 수 있습니다.',
      };
    });
  return (
    <section className="panel">
      <h2>{profile ? 'AI 설정 수정' : 'AI 계정 생성'}</h2>
      {profile && (
        <p>
          agentId: {profile.id} · 자산 accountId: {profile.userId ?? profile.user?.id}
        </p>
      )}
      <p>
        점수 = rawScore × scoreMultiplier + scoreOffset. 경계는 HOLD입니다. 비율 0.5 = 50%. MARKET_MAKER는
        방향 점수·보정을 적용하지 않고, 과거 데이터가 없는 SWING은 HOLD입니다. 수동 보정이며 자동 학습이나
        수익 보장이 아닙니다.
      </p>
      <SettingsForm
        fields={
          profile
            ? [...fields, { key: 'isActive', label: '활성 여부', kind: 'boolean' }]
            : [...fields, { key: 'initialCash', label: '초기 현금 (선택)', kind: 'number', min: 0 }]
        }
        initial={initial}
        patch={Boolean(profile)}
        busy={action.busy}
        onSubmit={save}
      />
      {profile && (
        <div className="toolbar">
          <button
            disabled={action.busy || !profile.isActive}
            onClick={() =>
              void action.execute(async () => {
                const result = await write<Row>(
                  `/admin/ai-accounts/${segment(profile.id)}/run-trade`,
                  'POST',
                );
                window.dispatchEvent(new Event('vfandex:decisions'));
                return result;
              })
            }
          >
            판단 실행
          </button>
          <button
            disabled={action.busy || !profile.isActive}
            onClick={() => {
              if (window.confirm('이 AI 계정을 비활성화하시겠습니까?'))
                void action.execute(async () => {
                  await write(`/admin/ai-accounts/${segment(profile.id)}`, 'DELETE');
                  refresh();
                  return { status: 'INACTIVE' };
                });
            }}
          >
            비활성화
          </button>
        </div>
      )}
      <ErrorNotice error={action.error} />
      {action.result !== undefined && (
        <>
          <p>
            {decisionLabels[String((action.result as Row)?.reason ?? (action.result as Row)?.action ?? '')]}
          </p>
          <DataView value={action.result} />
        </>
      )}
      {latest && (
        <details>
          <summary>저장 후 최신 프로필</summary>
          <DataView value={latest} />
        </details>
      )}
    </section>
  );
}
function DecisionHistory({ agentId }: { agentId: string }) {
  const path = `/admin/ai-accounts/${segment(agentId)}/decisions`;
  const page = usePage<Decision>(path + '?limit=50');
  const refreshDecisions = page.refresh;
  useEffect(() => {
    window.addEventListener('vfandex:decisions', refreshDecisions);
    return () => window.removeEventListener('vfandex:decisions', refreshDecisions);
  }, [refreshDecisions]);
  const [id, setId] = useState('');
  const detail = useRemote<DecisionDetail>(id ? `${path}/${segment(id)}` : undefined);
  return (
    <section className="panel">
      <h2>판단 이력</h2>
      <p>
        migration 이후 기록만 표시됩니다. STARTED는 진행 중 또는 중단 가능 상태이며, ERROR에도 접수된 주문이
        있을 수 있습니다.
      </p>
      <ErrorNotice error={page.error} />
      <Table
        rows={page.items.map((x) => ({ ...x, action: decisionLabels[x.action] ?? x.action }))}
        columns={[
          'id',
          'sequence',
          'strategyType',
          'model',
          'action',
          'stockId',
          'errorCode',
          'startedAt',
          'finishedAt',
        ]}
        onSelect={(row) => setId(String(row.id))}
      />
      <PageButtons {...page} />
      {id && (
        <article className="detail-drawer">
          <h3>판단 상세</h3>
          <button onClick={detail.refresh}>현재 주문 상태 새로고침</button>
          <button onClick={() => setId('')}>닫기</button>
          <ErrorNotice error={detail.error} />
          {detail.data && (
            <>
              <p>
                {decisionLabels[detail.data.action]} · {detail.data.errorCode}
              </p>
              <h4>판단 당시 프로필</h4>
              <DataView value={detail.data.profile} />
              <h4>판단 당시 결과 / 유지 주문</h4>
              <DataView value={detail.data.result} />
              <h4>현재 주문 상태 (당시 결과와 별도)</h4>
              <Table
                rows={detail.data.orders}
                columns={['id', 'status', 'quantity', 'filledQuantity', 'remainingQuantity', 'updatedAt']}
              />
              <DataView
                value={{
                  executionCount: detail.data.executionCount,
                  executedQuantity: detail.data.executedQuantity,
                  observedAt: detail.data.observedAt,
                }}
              />
            </>
          )}
        </article>
      )}
    </section>
  );
}
