import { describe, expect, it } from 'vitest';
import {
  calibrationRules,
  comparisonDates,
  money,
  numeric,
  sourceMode,
  uniqueItems,
  validArtifact,
} from '../src/utils/contracts';
import { validateDraft } from '../src/utils/storyline';
import { withQuery } from '../src/services/apiClient';
describe('contract input and precision', () => {
  it('preserves decimal money beyond Number precision', () =>
    expect(money('9007199254740993.0001')).toBe('₩9,007,199,254,740,993.0001'));
  it.each(['', ' ', 'null', 'NaN', '0.00001', '1.0001'])('rejects invalid bounded value %s', (value) =>
    expect(() => numeric(value, 'ratio', 0.001, 1)).toThrow(),
  );
  it('keeps manual defaults 1 and 0 and JSON numbers', () => {
    expect(calibrationRules.scoreMultiplier[2]).toBe(1);
    expect(calibrationRules.scoreOffset[2]).toBe(0);
    expect(numeric('0', 'offset', -0.5, 0.5)).toBe(0);
  });
  it('checks integer quantities', () => expect(() => numeric('1.5', 'quantity', 1, 1e9, 0)).toThrow());
  it('converts local offset to UTC hour', () =>
    expect(
      comparisonDates(
        '2026-09-01T09:00:00+09:00',
        '2026-09-02T09:00:00+09:00',
        Date.parse('2026-10-04T00:00Z'),
      ),
    ).toEqual({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' }));
  it.each([
    ['2026-09-01T00:01Z', '2026-09-02T00:00Z'],
    ['2026-09-01T00:00Z', '2026-12-20T00:00Z'],
    ['2026-09-02T00:00Z', '2026-09-01T00:00Z'],
  ])('rejects non-hour/future/invalid periods', (from, to) =>
    expect(() => comparisonDates(from, to, Date.parse('2026-10-04T00:00Z'))).toThrow(),
  );
  it('omits both continuation flags for merges', () =>
    expect(sourceMode('merge', 'a,b,a')).toEqual({ mergeSourceIds: ['a', 'b'] }));
  it('enforces 2..4 merge sources', () => expect(() => sourceMode('merge', 'a')).toThrow());
  it('preserves opaque cursor encoding and existing filters', () => {
    const path = withQuery('/page?stockId=a', { cursor: 'a+/==', acknowledged: false });
    expect(new URL(path, 'http://test').searchParams.get('cursor')).toBe('a+/==');
    expect(path).toContain('stockId=a');
    expect(path).toContain('acknowledged=false');
  });
  it('deduplicates IDs using latest row', () =>
    expect(
      uniqueItems([
        { id: 'a', status: 'STARTED' },
        { id: 'a', status: 'HOLD' },
      ]),
    ).toEqual([{ id: 'a', status: 'HOLD' }]));
  it('never exposes stale artifact content', () =>
    expect(validArtifact({ status: 'STALE', body: 'old' })).toBeUndefined());
  const draft = {
    type: 'arc',
    steps: [
      {
        type: 'MAIN',
        headline: '기사',
        body: '본문',
        sentiment: 'NEUTRAL',
        importance: 3,
        offsetSeconds: 0,
        worldUpdates: [{ stockId: 's', worldState: { growth: 0.2 } }],
      },
    ],
  };
  it('validates administrator world update drafts', () =>
    expect(validateDraft(JSON.stringify(draft))).toEqual(draft));
  it('rejects unknown fields/null world values', () =>
    expect(() => validateDraft(JSON.stringify({ ...draft, unknown: true }))).toThrow());
  it('rejects simultaneous world selectors', () =>
    expect(() =>
      validateDraft(
        JSON.stringify({
          ...draft,
          steps: [
            {
              ...draft.steps[0],
              worldUpdates: [{ stockId: 's', marketId: 'm', worldState: { growth: 0.2 } }],
            },
          ],
        }),
      ),
    ).toThrow());
});

describe('additional generation targets', () => {
  it('rejects duplicates, root overlap and a tenth additional stock', async () => {
    const { additionalStockIds } = await import('../src/utils/contracts');
    expect(() => additionalStockIds('a,a', 'root')).toThrow();
    expect(() => additionalStockIds('root', 'root')).toThrow();
    expect(() => additionalStockIds('a,b,c,d,e,f,g,h,i,j', 'root')).toThrow();
    expect(additionalStockIds('a,b', 'root')).toEqual(['a', 'b']);
  });
});
