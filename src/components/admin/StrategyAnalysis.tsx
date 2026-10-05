import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAction, useRemote } from '../../hooks/useRemote';
import { write } from '../../services/contractApi';
import type { AiProfile, Comparison, Performance, Row } from '../../types/contracts';
import {
  calibrationRules,
  comparisonDates,
  comparisonStrategies,
  localDate,
  money,
  numeric,
  personalityKeys,
} from '../../utils/contracts';
import { DataView, ErrorNotice, Field, Table } from './Shared';

export function PerformancePanel({ accounts }: { accounts: AiProfile[] }) {
  const seasons = useRemote<{ id: string; name: string; status: string }[]>('/seasons');
  const [seasonId, setSeason] = useState(''),
    [agentIds, setAgents] = useState<string[]>([]);
  const [performance, setPerformance] = useState<Performance>();
  const action = useAction();
  return (
    <section className="panel">
      <h2>실제 계정의 시즌 성과</h2>
      <p>
        수동 거래·배당·기간 중 전략/설정 변경을 포함합니다. 현재 전략만의 수익률이 아닙니다. 종료 시즌은 동결
        자산을 사용합니다.
      </p>
      <Field label="시즌">
        <select
          disabled={action.busy}
          value={seasonId}
          onChange={(e) => {
            setSeason(e.target.value);
            setPerformance(undefined);
          }}
        >
          <option value="">시즌 선택</option>
          {seasons.data?.map((s) => (
            <option key={s.id} value={s.id} disabled={s.status === 'UPCOMING'}>
              {s.name} · {s.status}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`비교할 AI profile (${agentIds.length}/50, 선택 순서대로 비교)`}>
        <select
          multiple
          disabled={action.busy}
          value={agentIds}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (x) => x.value);
            setAgents((previous) => [
              ...previous.filter((x) => selected.includes(x)),
              ...selected.filter((x) => !previous.includes(x)),
            ]);
            setPerformance(undefined);
          }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nickname ?? a.user?.nickname ?? a.id}
            </option>
          ))}
        </select>
      </Field>
      <button
        className="primary-button"
        disabled={action.busy || !seasonId || !agentIds.length || agentIds.length > 50}
        onClick={() =>
          void action.execute(async () => {
            const result = await write<Performance>('/admin/ai-strategies/performance', 'POST', {
              seasonId,
              agentIds,
            });
            setPerformance(result);
            return result;
          })
        }
      >
        {action.busy ? '조회 중…' : '성과 조회 / 갱신'}
      </button>
      <ErrorNotice error={action.error ?? seasons.error} />
      {performance && (
        <>
          <p>
            조회: {localDate(performance.observedAt)} · {performance.seasonStatus}
          </p>
          {performance.items.map((item) => (
            <article key={item.agentId} className="result-card">
              <h3>
                {item.nickname} · {item.status}
              </h3>
              <p>
                agentId {item.agentId} / accountId {item.accountId} · 현재 전략 {item.currentStrategyType}
              </p>
              {item.status === 'BASELINE_UNAVAILABLE' ? (
                <p>기준 기록이 없어 자산/수익률을 계산할 수 없습니다.</p>
              ) : (
                <>
                  <DataView
                    value={{
                      baselineSource: item.baselineSource,
                      baselineAt: item.baselineAt,
                      valuedAt: item.valuedAt,
                    }}
                  />
                  <dl className="data-grid">
                    {(
                      [
                        'initialCash',
                        'initialStockValue',
                        'capitalAdjustments',
                        'basis',
                        'cash',
                        'stockValue',
                        'totalAssets',
                        'profit',
                      ] as const
                    ).map((key) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{money(item[key])}</dd>
                      </div>
                    ))}
                    <div>
                      <dt>수익률</dt>
                      <dd>{item.returnPct == null ? '— (기준금액 0 이하)' : `${item.returnPct}%`}</dd>
                    </div>
                  </dl>
                </>
              )}
              <h4>시즌 중 기록된 전략별 판단 수</h4>
              <Table rows={item.decisions} columns={['strategyType', 'action', 'count']} />
            </article>
          ))}
          <DataView value={performance.limitations} />
        </>
      )}
    </section>
  );
}
interface Variant {
  label: string;
  strategyType: string;
  [key: string]: string;
}
export function ComparisonPanel() {
  const [common, setCommon] = useState<Record<string, string>>({
    initialCash: '1000000',
    feeBps: '10',
    volumeParticipation: '0.01',
    maxExposure: '0.5',
  });
  const [variants, setVariants] = useState<Variant[]>([{ label: '기본', strategyType: 'MOMENTUM' }]);
  const [result, setResult] = useState<Comparison>();
  const action = useAction();
  const change = (key: string, value: string) => setCommon((x) => ({ ...x, [key]: value }));
  const execute = () =>
    void action.execute(async () => {
      if (!common.stockId?.trim() || common.stockId.trim().length > 100)
        throw new Error('종목 ID를 선택하세요.');
      const labels = variants.map((v) => v.label.trim());
      if (
        !variants.length ||
        variants.length > 8 ||
        labels.some((x) => !x || x.length > 40) ||
        new Set(labels).size !== labels.length
      )
        throw new Error('변형 1~8개, 중복 없는 label 1~40자를 입력하세요.');
      const body: Row = {
        stockId: common.stockId.trim(),
        ...comparisonDates(common.from, common.to),
        initialCash: numeric(common.initialCash, '초기 현금', 1, 1e12),
        feeBps: numeric(common.feeBps, '수수료 bps', 0, 1000),
        volumeParticipation: numeric(common.volumeParticipation, '거래량 비중', 0.0001, 1),
        maxExposure: numeric(common.maxExposure, '최대 비중', 0.05, 1),
      };
      if (common.referencePrice?.trim())
        body.referencePrice = numeric(common.referencePrice, '기준 가격', 0.0001, 1e12);
      const personality: Row = {};
      for (const key of personalityKeys)
        if (common[key]?.trim()) personality[key] = numeric(common[key], key, 0, 1, 10);
      if (Object.keys(personality).length) body.personality = personality;
      body.variants = variants.map((v, index) => {
        const row: Row = { label: labels[index], strategyType: v.strategyType };
        for (const [key, [min, max]] of Object.entries(calibrationRules))
          if (key !== 'maxSectorExposure' && v[key]?.trim()) row[key] = numeric(v[key], key, min, max);
        return row;
      });
      setResult(undefined);
      const data = await write<Comparison>('/admin/ai-strategies/compare', 'POST', body);
      setResult(data);
      return data;
    });
  return (
    <section className="panel">
      <h2>과거 가격 전략 비교</h2>
      <p>
        가상 가격 비교 · 실제 계정 설정을 변경하지 않습니다. 종가 판단 → 다음 연속 시간봉 시가 체결, 강제 청산
        없음. 실제 AI 일정·뉴스·호가·배당은 재현하지 않습니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          execute();
        }}
      >
        <fieldset disabled={action.busy}>
          <div className="form-grid">
            {[
              ['stockId', '종목 ID'],
              ['from', '시작 (현지 입력 → UTC, 포함)'],
              ['to', '종료 (현지 입력 → UTC, 제외)'],
              ['initialCash', '초기 현금'],
              ['referencePrice', '고정 기준가격 (선택)'],
              ['feeBps', '수수료 bps'],
              ['volumeParticipation', '거래량 비중 (0.01 = 1%)'],
              ['maxExposure', '최대 비중 (0.5 = 50%)'],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type={key === 'from' || key === 'to' ? 'datetime-local' : 'text'}
                  step={key === 'from' || key === 'to' ? 3600 : undefined}
                  value={common[key] ?? ''}
                  onChange={(e) => change(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <p>
            UTC 정각, 완료된 시간까지 최대 90일. 양수 거래량·시가·종가의 1h 봉 3~1000개가 필요합니다. 봉
            부족/초과 400이면 기간을 조절하세요. 사후 정보로 고정 기준가격을 선택하면 편향될 수 있습니다.
          </p>
          <details>
            <summary>공통 성격 (선택)</summary>
            <div className="form-grid">
              {personalityKeys.map((key) => (
                <Field key={key} label={key}>
                  <input value={common[key] ?? ''} onChange={(e) => change(key, e.target.value)} />
                </Field>
              ))}
            </div>
          </details>
          {variants.map((variant, index) => (
            <article className="result-card" key={index}>
              <h3>변형 {index + 1}</h3>
              <div className="form-grid">
                <Field label="이름">
                  <input
                    maxLength={40}
                    value={variant.label}
                    onChange={(e) =>
                      setVariants((v) => v.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </Field>
                <Field label="전략">
                  <select
                    value={variant.strategyType}
                    onChange={(e) =>
                      setVariants((v) =>
                        v.map((x, i) => (i === index ? { ...x, strategyType: e.target.value } : x)),
                      )
                    }
                  >
                    {comparisonStrategies.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {Object.entries(calibrationRules)
                  .filter(([key]) => key !== 'maxSectorExposure')
                  .map(([key, [min, max, defaultValue]]) => (
                    <Field key={key} label={`${key} (${min}~${max}, 기본 ${defaultValue})`}>
                      <input
                        value={variant[key] ?? ''}
                        placeholder={String(defaultValue)}
                        onChange={(e) =>
                          setVariants((v) =>
                            v.map((x, i) => (i === index ? { ...x, [key]: e.target.value } : x)),
                          )
                        }
                      />
                    </Field>
                  ))}
              </div>
              <button
                type="button"
                disabled={variants.length === 1}
                onClick={() => setVariants((v) => v.filter((_, i) => i !== index))}
              >
                변형 제거
              </button>
            </article>
          ))}
          <div className="toolbar">
            <button
              type="button"
              disabled={variants.length >= 8}
              onClick={() =>
                setVariants((v) => [...v, { label: `변형 ${v.length + 1}`, strategyType: 'MOMENTUM' }])
              }
            >
              변형 추가
            </button>
            <button className="primary-button" type="submit">
              {action.busy ? '비교 중…' : '비교 실행'}
            </button>
          </div>
        </fieldset>
      </form>
      <ErrorNotice error={action.error} />
      {result && (
        <>
          <h3>가상 비교 결과 · {result.model}</h3>
          <h4>실제 사용한 기간 / 봉 수 / 누락 / SHA256</h4>
          <DataView value={result.source} />
          <h4>적용된 공통값</h4>
          <DataView value={result.parameters} />
          <Table
            rows={result.results}
            columns={[
              'label',
              'strategyType',
              'finalCash',
              'finalQuantity',
              'finalValue',
              'profit',
              'returnPct',
              'maxDrawdownPct',
              'fees',
              'tradeCount',
              'skippedGapSignals',
              'unfilledSignals',
            ]}
          />
          <p>returnPct / maxDrawdownPct 단위: %. 자산 곡선은 서버 equity.value만 표시합니다.</p>
          {result.results.map((r) => (
            <article key={r.label} className="result-card">
              <h3>{r.label}</h3>
              <details>
                <summary>실제 적용 변형 설정</summary>
                <DataView
                  value={Object.fromEntries(
                    Object.entries(r).filter(([key]) => !['trades', 'equity'].includes(key)),
                  )}
                />
              </details>
              {r.equity.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={r.equity.map((p, i) => ({ ...p, displayValue: Number(p.value), index: i }))}
                  >
                    <XAxis dataKey="at" tickFormatter={(value) => localDate(value)} />
                    <YAxis />
                    <Tooltip
                      formatter={(_, __, props) => [money(props.payload.value), '가상 자산']}
                      labelFormatter={(_, payload) =>
                        localDate(payload[0]?.payload.at ?? payload[0]?.payload.timestamp)
                      }
                    />
                    <Line
                      dataKey="displayValue"
                      name="가상 자산"
                      stroke="#38d5ff"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p>자산 곡선 기록 없음</p>
              )}
              <h4>가상 거래 내역</h4>
              <Table
                rows={r.trades}
                columns={[
                  'decisionAt',
                  'filledAt',
                  'side',
                  'rawScore',
                  'score',
                  'plannedQuantity',
                  'quantity',
                  'price',
                  'fee',
                  'cashAfter',
                  'quantityAfter',
                ]}
              />
            </article>
          ))}
          <DataView value={result.limitations} />
        </>
      )}
    </section>
  );
}
