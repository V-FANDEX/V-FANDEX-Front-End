import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiWorkspace } from '../src/components/admin/AiWorkspace';
import { ComparisonPanel, PerformancePanel } from '../src/components/admin/StrategyAnalysis';
import { StorylinesPanel } from '../src/components/admin/StorylinesPanel';
import { RetentionPanel } from '../src/components/admin/RetentionPanel';
import { SchedulesPanel } from '../src/components/admin/SchedulesPanel';
import { SettingsForm } from '../src/components/admin/Shared';
import { useFandexStore } from '../src/store/useFandexStore';
import { clearOperations } from '../src/hooks/useRemote';
import type { AiProfile } from '../src/types/contracts';
const profile: AiProfile = {
  id: 'agent-a',
  userId: 'account-a',
  nickname: '계정 A',
  strategyType: 'MOMENTUM',
  riskLevel: 5,
  isActive: true,
};
function fixture(routes: Record<string, unknown>) {
  const calls: { path: string; method: string; body?: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit = {}) => {
      const path = new URL(input).pathname;
      calls.push({
        path,
        method: options.method ?? 'GET',
        body: options.body ? JSON.parse(String(options.body)) : undefined,
      });
      const value = routes[`${options.method ?? 'GET'} ${path}`] ?? routes[path];
      return new Response(JSON.stringify(value ?? []), { status: 200 });
    }),
  );
  return calls;
}
beforeEach(() => {
  clearOperations();
  useFandexStore.setState({
    user: {
      id: 'admin',
      name: '관리자',
      role: 'admin',
      cash: 0,
      totalDividend: 0,
      favoriteStockIds: [],
      holdings: [],
    },
  });
});
describe('connected screen contracts', () => {
  it('patch form omits untouched optional fields and blank numeric values', () => {
    const save = vi.fn();
    render(
      <SettingsForm
        fields={[
          { key: 'riskLevel', kind: 'number', min: 1, max: 10 },
          { key: 'scoreOffset', kind: 'number', min: -0.5, max: 0.5, decimals: 4 },
        ]}
        initial={{ riskLevel: 3, scoreOffset: 0 }}
        patch
        busy={false}
        onSubmit={save}
      />,
    );
    fireEvent.change(screen.getByLabelText('riskLevel'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('저장'));
    expect(save).toHaveBeenCalledWith({ riskLevel: 5 });
  });
  it.each(['STARTED', 'ERROR'])(
    'shows current orders separately for %s and preserves maker null',
    async (action) => {
      fixture({
        '/admin/ai-accounts': [profile],
        '/admin/ai-accounts/agent-a/decisions': {
          items: [
            {
              id: 'decision',
              agentId: 'agent-a',
              action,
              sequence: '9007199254740993',
              strategyType: 'MARKET_MAKER',
              model: 'ai-score-v2',
            },
          ],
          nextCursor: null,
        },
        '/admin/ai-accounts/agent-a/decisions/decision': {
          id: 'decision',
          action,
          profile: { strategyType: 'MARKET_MAKER' },
          result: {
            strategyContext: { rawScore: null, score: null },
            orders: [{ id: 'order', status: 'OPEN' }],
          },
          orders: [{ id: 'order', status: 'FILLED', filledQuantity: 2 }],
          executionCount: 1,
          executedQuantity: 2,
          observedAt: '2026-10-03T00:00:00Z',
        },
      });
      render(<AiWorkspace />);
      await screen.findByText(/계정 A · MOMENTUM/);
      fireEvent.change(screen.getByLabelText('AI profile 선택'), { target: { value: 'agent-a' } });
      await screen.findByText('9007199254740993');
      fireEvent.click(screen.getByText('열기'));
      await screen.findByText('FILLED');
      expect(screen.getByText('OPEN')).toBeTruthy();
      expect(screen.getByText('rawScore').nextElementSibling?.textContent).toBe('—');
      expect(screen.getByText('현재 주문 상태 (당시 결과와 별도)')).toBeTruthy();
    },
  );
  it('NOT_DUE shows deferred decision without trade completion', async () => {
    fixture({
      '/admin/ai-accounts': [profile],
      'POST /admin/ai-accounts/agent-a/run-trade': { action: 'HOLD', reason: 'NOT_DUE' },
      '/admin/ai-accounts/agent-a/decisions': { items: [], nextCursor: null },
    });
    render(<AiWorkspace />);
    await screen.findByText(/계정 A · MOMENTUM/);
    fireEvent.change(screen.getByLabelText('AI profile 선택'), { target: { value: 'agent-a' } });
    fireEvent.click(await screen.findByText('판단 실행'));
    await screen.findByText('NOT_DUE');
    expect(screen.queryByText('체결 완료')).toBeNull();
  });
  it('separates LIVE CLOSED and unavailable, string percentages and null', async () => {
    fixture({
      '/seasons': [{ id: 'season', name: '시즌', status: 'ACTIVE' }],
      'POST /admin/ai-strategies/performance': {
        seasonId: 'season',
        seasonStatus: 'ACTIVE',
        observedAt: '2026-10-03T00:00:00Z',
        limitations: [],
        items: [
          {
            ...profile,
            agentId: 'a',
            accountId: 'asset-a',
            currentStrategyType: 'SWING',
            status: 'LIVE',
            basis: '100',
            totalAssets: '110',
            capitalAdjustments: '5',
            returnPct: '10',
            decisions: [{ strategyType: 'VALUE', action: 'HOLD', count: 2 }],
          },
          { ...profile, agentId: 'b', status: 'CLOSED', returnPct: null, decisions: [] },
          { ...profile, agentId: 'c', status: 'BASELINE_UNAVAILABLE', decisions: [] },
        ],
      },
    });
    render(<PerformancePanel accounts={[profile]} />);
    fireEvent.change(await screen.findByLabelText('시즌'), { target: { value: 'season' } });
    await screen.findByText('시즌 · ACTIVE');
    const select = screen.getByLabelText(/비교할 AI profile/) as HTMLSelectElement;
    select.options[0].selected = true;
    fireEvent.change(select);
    fireEvent.click(screen.getByText('성과 조회 / 갱신'));
    await screen.findByText('10%');
    expect(screen.getByText('— (기준금액 0 이하)')).toBeTruthy();
    expect(screen.getByText('기준 기록이 없어 자산/수익률을 계산할 수 없습니다.')).toBeTruthy();
    expect(screen.getByText('VALUE')).toBeTruthy();
    expect(screen.getByText('₩5')).toBeTruthy();
  });
  it('comparison caps variants and does not auto-run', () => {
    const calls = fixture({});
    render(<ComparisonPanel />);
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByText('변형 추가'));
    expect((screen.getByText('변형 추가') as HTMLButtonElement).disabled).toBe(true);
    expect(calls).toHaveLength(0);
    expect(screen.queryByText('MARKET_MAKER')).toBeNull();
  });
  it('STALE summary body remains hidden and artifact reads do not generate', async () => {
    const calls = fixture({
      '/admin/storylines': [
        { id: 'story', type: 'arc', stockId: 's', state: 'PAUSED', revision: 2, nextStep: 0, steps: [] },
      ],
      '/admin/storylines/story/preview': {
        id: 'story',
        type: 'arc',
        state: 'PAUSED',
        revision: 2,
        nextStep: 0,
        steps: [],
      },
      '/admin/storylines/story/summary': { status: 'STALE', revision: 1, body: 'SECRET_OLD_SUMMARY' },
      '/admin/storylines/story/semantic-review': { status: 'MISSING', revision: 0 },
      '/admin/storylines/story/continuity-context': { coverage: 'NOT_EVALUATED', truncated: true },
    });
    render(<StorylinesPanel />);
    fireEvent.click(await screen.findByText('열기'));
    await screen.findByText('공개 기사 요약 · STALE');
    expect(screen.queryByText('SECRET_OLD_SUMMARY')).toBeNull();
    expect(calls.every((x) => x.method === 'GET')).toBe(true);
  });
  it('HTTP success schedule FAILED does not become completed generation', async () => {
    fixture({
      '/admin/storyline-generation/budget': { dailyLimit: 100, revision: 0, used: 2 },
      '/admin/storyline-schedules/page': {
        items: [{ id: 'schedule', stockId: 's', revision: 0 }],
        nextCursor: null,
      },
      '/admin/storyline-schedules/schedule': { id: 'schedule', revision: 0 },
      '/admin/storyline-schedules/schedule/runs': { items: [], nextCursor: null },
      'POST /admin/storyline-schedules/schedule/run': { status: 'FAILED', errorCode: 'GENERATION_HTTP_503' },
    });
    render(<SchedulesPanel />);
    fireEvent.click(await screen.findByText('열기'));
    fireEvent.click(await screen.findByText('수동 실행 / 동일 작업 재시도'));
    await screen.findByText('생성 완료 아님: FAILED');
    expect(screen.queryByText('PAUSED 초안 생성 완료')).toBeNull();
  });
  it('cleanup requires preview, selected IDs and explicit dialog confirmation', async () => {
    const calls = fixture({
      '/admin/operations/retention': { revision: 3, failedRunsEnabled: true, failedRunRetentionDays: 90 },
      '/admin/operations/retention/preview': {
        policy: { revision: 3 },
        failedRuns: { count: '1', items: [{ id: 'failed-1' }] },
        resolvedAlerts: { count: '0', items: [] },
      },
      '/admin/operations/retention/automation': { status: 'NOT_DUE' },
      '/admin/operations/retention/archives': { items: [], nextCursor: null },
      'POST /admin/operations/retention/cleanup': { status: 'COMPLETED' },
    });
    render(<RetentionPanel />);
    await screen.findByLabelText('failedRunRetentionDays');
    expect(calls.some((c) => c.path.endsWith('/preview'))).toBe(false);
    fireEvent.click(screen.getByText('후보 미리보기 / 다시 조회'));
    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('선택 1개 정리 검토'));
    expect(calls.some((c) => c.path.endsWith('/cleanup'))).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('확인 후 실행'));
    await waitFor(() =>
      expect(calls.find((c) => c.path.endsWith('/cleanup'))?.body).toEqual({
        confirm: true,
        expectedRevision: 3,
        failedRunIds: ['failed-1'],
      }),
    );
    expect(calls.filter((c) => c.path.endsWith('/cleanup'))).toHaveLength(1);
  });
});

it('uses report revision and storyline revision separately for semantic review', async () => {
  const calls = fixture({
    '/admin/storylines': [
      { id: 'reviewed', type: 'arc', stockId: 'root', state: 'PAUSED', revision: 7, nextStep: 0, steps: [] },
    ],
    '/admin/storylines/reviewed/preview': {
      id: 'reviewed',
      type: 'arc',
      state: 'PAUSED',
      revision: 7,
      nextStep: 0,
      steps: [],
    },
    '/admin/storylines/reviewed/summary': { status: 'MISSING', revision: 0, summary: null },
    '/admin/storylines/reviewed/semantic-review': {
      status: 'AVAILABLE',
      revision: 3,
      review: { findings: [] },
    },
    'POST /admin/storylines/reviewed/semantic-review': { status: 'AVAILABLE', revision: 4 },
  });
  render(<StorylinesPanel />);
  fireEvent.click(await screen.findByText('열기'));
  const heading = await screen.findByText('의미 검토 · AVAILABLE');
  fireEvent.click(within(heading.closest('article')!).getByText('한도 사용 · 생성 / 동일 작업 재시도'));
  await waitFor(() =>
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      expectedRevision: 3,
      expectedStorylineRevision: 7,
    }),
  );
  await waitFor(() =>
    expect(
      calls.filter((c) => c.path.endsWith('semantic-review') && c.method === 'GET').length,
    ).toBeGreaterThan(1),
  );
});

it('preserves parent stockId when loading a preview into the draft editor', async () => {
  const step = {
    type: 'MAIN',
    headline: '제목',
    body: '본문',
    sentiment: 'NEUTRAL',
    importance: 3,
    offsetSeconds: 0,
    worldState: { growth: 0.3 },
  };
  fixture({
    '/admin/storylines': [
      { id: 'edit', type: 'arc', stockId: 'root', revision: 1, state: 'PAUSED', nextStep: 0, steps: [step] },
    ],
    '/admin/storylines/edit/preview': {
      id: 'edit',
      type: 'arc',
      revision: 1,
      state: 'PAUSED',
      nextStep: 0,
      startedAt: '2026-10-03T00:00:00Z',
      steps: [{ ...step, storylineStep: 0, scheduledAt: '2026-10-03T00:00:00Z', stockIds: ['root'] }],
    },
  });
  render(<StorylinesPanel />);
  fireEvent.click(await screen.findByText('열기'));
  const button = await screen.findByText('저장본을 편집기에 불러오기');
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  const draft = JSON.parse((screen.getByLabelText('초안 JSON') as HTMLTextAreaElement).value);
  expect(draft.stockId).toBe('root');
  expect(draft.steps[0]).toEqual(step);
});

it('clears selected cleanup IDs and re-previews after 409 without retrying deletion', async () => {
  let previews = 0,
    deletes = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      if (path.endsWith('/cleanup')) {
        deletes++;
        return new Response(JSON.stringify({ message: 'Revision conflict' }), { status: 409 });
      }
      if (path.endsWith('/preview')) {
        previews++;
        return new Response(
          JSON.stringify({
            policy: { revision: previews },
            failedRuns: { count: '1', items: [{ id: 'failed' }] },
            resolvedAlerts: { count: '0', items: [] },
          }),
        );
      }
      if (path.endsWith('/archives')) return new Response(JSON.stringify({ items: [], nextCursor: null }));
      return new Response(JSON.stringify({ revision: 1 }));
    }),
  );
  render(<RetentionPanel />);
  fireEvent.click(screen.getByText('후보 미리보기 / 다시 조회'));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByText('선택 1개 정리 검토'));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('확인 후 실행'));
  await screen.findByRole('alert');
  await waitFor(() => expect(previews).toBe(2));
  expect(deletes).toBe(1);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});

it('rejects trimmed duplicate comparison labels without making a request', () => {
  const calls = fixture({});
  render(<ComparisonPanel />);
  fireEvent.change(screen.getByLabelText('종목 ID'), { target: { value: 'stock' } });
  fireEvent.click(screen.getByText('변형 추가'));
  fireEvent.change(screen.getAllByLabelText('이름')[1], { target: { value: ' 기본 ' } });
  fireEvent.click(screen.getByText('비교 실행'));
  expect(calls).toHaveLength(0);
});

it.each(['At least 3 eligible candles are required', 'More than 1000 eligible candles'])(
  'shows candle range 400 with adjustment guidance: %s',
  async (message) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-04T00:00:00Z'));
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message }), { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    render(<ComparisonPanel />);
    fireEvent.change(screen.getByLabelText('종목 ID'), { target: { value: 'stock' } });
    fireEvent.change(screen.getByLabelText('시작 (현지 입력 → UTC, 포함)'), {
      target: { value: '2026-09-01T00:00' },
    });
    fireEvent.change(screen.getByLabelText('종료 (현지 입력 → UTC, 제외)'), {
      target: { value: '2026-09-02T00:00' },
    });
    fireEvent.click(screen.getByText('비교 실행'));
    await screen.findByText(message, { exact: false });
    expect(screen.getByText(/봉 부족\/초과 400이면 기간을 조절하세요/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it('keeps a cold SWING HOLD and server raw/calibrated scores unchanged', async () => {
  fixture({
    '/admin/ai-accounts': [profile],
    '/admin/ai-accounts/agent-a/decisions': { items: [], nextCursor: null },
    'POST /admin/ai-accounts/agent-a/run-trade': {
      decisionId: 'cold',
      action: 'HOLD',
      reason: 'SWING_HISTORY_NOT_READY',
      strategyContext: {
        strategyType: 'SWING',
        rawScore: 0,
        score: 0,
        scoreMultiplier: 1,
        scoreOffset: 0.5,
        signal: 'HOLD',
      },
    },
  });
  render(<AiWorkspace />);
  await screen.findByText(/계정 A · MOMENTUM/);
  fireEvent.change(screen.getByLabelText('AI profile 선택'), { target: { value: 'agent-a' } });
  fireEvent.click(await screen.findByText('판단 실행'));
  await screen.findByText('SWING_HISTORY_NOT_READY');
  expect(screen.getByText('score').nextElementSibling?.textContent).toBe('0');
  expect(screen.getByText('rawScore').nextElementSibling?.textContent).toBe('0');
  expect(screen.getByText('scoreOffset').nextElementSibling?.textContent).toBe('0.5');
});
