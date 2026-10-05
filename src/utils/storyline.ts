import type { Row } from '../types/contracts';
const worldKeys = [
  'popularity',
  'growth',
  'activity',
  'fandomStrength',
  'futureExpectation',
  'risk',
  'controversyRisk',
];
const stepKeys = [
  'type',
  'headline',
  'body',
  'sentiment',
  'importance',
  'stockIds',
  'marketIds',
  'eventType',
  'surprise',
  'reliability',
  'durationSeconds',
  'storylineId',
  'offsetSeconds',
  'worldState',
  'worldUpdates',
];
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('객체가 필요합니다.');
  return value as Row;
}
function allowed(value: Row, keys: string[]) {
  for (const key of Object.keys(value))
    if (!keys.includes(key) || value[key] === null) throw new Error(`허용되지 않은 필드/ null: ${key}`);
}
function number(value: unknown, min: number, max: number, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(`숫자 범위 ${min}~${max}${integer ? ' 정수' : ''}`);
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`문자열 1~${max}자를 입력하세요.`);
}
function world(value: unknown) {
  const patch = object(value);
  allowed(patch, worldKeys);
  if (!Object.keys(patch).length) throw new Error('세계 상태가 비었습니다.');
  Object.values(patch).forEach((x) => number(x, 0, 1));
}
export function validateDraft(input: string): Row {
  const draft = object(JSON.parse(input));
  allowed(draft, ['type', 'stockId', 'marketId', 'startedAt', 'steps']);
  text(draft.type, 64);
  if (
    draft.startedAt !== undefined &&
    (typeof draft.startedAt !== 'string' ||
      !/(Z|[+-]\d\d:\d\d)$/.test(draft.startedAt) ||
      !Number.isFinite(Date.parse(draft.startedAt)))
  )
    throw new Error('startedAt은 timezone을 포함한 ISO 날짜여야 합니다.');
  for (const key of ['stockId', 'marketId']) if (draft[key] !== undefined) text(draft[key], 128);
  if (!Array.isArray(draft.steps) || !draft.steps.length || draft.steps.length > 30)
    throw new Error('단계는 1~30개입니다.');
  let previous = -1;
  draft.steps.forEach((raw) => {
    const step = object(raw);
    allowed(step, stepKeys);
    number(step.offsetSeconds, 0, 31536000, true);
    if (Number(step.offsetSeconds) <= previous) throw new Error('offsetSeconds는 증가해야 합니다.');
    previous = Number(step.offsetSeconds);
    if (!['MAIN', 'BIG', 'SMALL'].includes(String(step.type))) throw new Error('단계 type을 확인하세요.');
    if (!['POSITIVE', 'NEGATIVE', 'MIXED', 'NEUTRAL'].includes(String(step.sentiment)))
      throw new Error('sentiment를 확인하세요.');
    text(step.headline, 120);
    text(step.body, 2000);
    number(step.importance, 1, 10, true);
    for (const key of ['surprise', 'reliability']) if (step[key] !== undefined) number(step[key], 0, 1);
    if (step.durationSeconds !== undefined) number(step.durationSeconds, 1, 604800, true);
    if (step.worldState !== undefined) world(step.worldState);
    if (step.worldUpdates !== undefined) {
      if (!Array.isArray(step.worldUpdates) || step.worldUpdates.length < 1 || step.worldUpdates.length > 50)
        throw new Error('worldUpdates는 1~50개입니다.');
      const seen = new Set<string>();
      step.worldUpdates.forEach((rawUpdate) => {
        const update = object(rawUpdate);
        allowed(update, ['stockId', 'marketId', 'worldState']);
        if (Boolean(update.stockId) === Boolean(update.marketId))
          throw new Error('세계 변경 대상은 종목 또는 시장 하나입니다.');
        const key = update.stockId ? 'stockId' : 'marketId';
        text(update[key], 128);
        const target = `${key}:${update[key]}`;
        if (seen.has(target)) throw new Error('중복 세계 변경 대상입니다.');
        seen.add(target);
        world(update.worldState);
      });
    }
  });
  return draft;
}
