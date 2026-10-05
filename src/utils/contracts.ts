import Decimal from 'decimal.js';

export const calibrationRules = {
  buySignalThreshold: [0.001, 1, 0.005],
  sellSignalThreshold: [0.001, 1, 0.005],
  tradeSizeRatio: [0.1, 1, 1],
  maxSectorExposure: [0.05, 1, 0.6],
  scoreMultiplier: [0.1, 3, 1],
  scoreOffset: [-0.5, 0.5, 0],
} as const;
export const personalityKeys = [
  'riskTolerance',
  'greed',
  'fear',
  'panicSensitivity',
  'newsSensitivity',
  'momentumPreference',
  'valuePreference',
  'contrarianPreference',
  'fanBias',
  'confidence',
  'fomo',
  'informationSpeed',
  'riskAversion',
] as const;
export const comparisonStrategies = ['VALUE', 'MOMENTUM', 'CONTRARIAN', 'SWING', 'LONG_TERM'] as const;
export function numeric(value: string, label: string, min: number, max: number, decimals = 4): number {
  if (!value.trim() || !/^-?\d+(\.\d+)?$/.test(value.trim())) throw new Error(`${label}: 숫자를 입력하세요.`);
  const n = new Decimal(value);
  if (n.lt(min) || n.gt(max) || n.decimalPlaces() > decimals)
    throw new Error(`${label}: ${min}~${max}, 소수 ${decimals}자리까지 입력하세요.`);
  return n.toNumber();
}
export function money(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const [whole, fraction] = new Decimal(value).toFixed().split('.');
  return `₩${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}
export function localDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}
export function utcInput(value: string) {
  if (!value || !Number.isFinite(new Date(value).getTime())) throw new Error('날짜를 입력하세요.');
  return new Date(value).toISOString();
}
export function comparisonDates(from: string, to: string, now = Date.now()) {
  const a = new Date(utcInput(from)),
    b = new Date(utcInput(to));
  if (+a % 3600000 || +b % 3600000) throw new Error('UTC 정각을 선택하세요.');
  if (+a >= +b || +b > Math.floor(now / 3600000) * 3600000 || +b - +a > 90 * 86400000)
    throw new Error('완료된 시간까지, 시작 < 종료, 최대 90일을 선택하세요.');
  return { from: a.toISOString(), to: b.toISOString() };
}
export function ids(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}
export function uniqueItems<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((x) => [x.id, x])).values()];
}
export function sourceMode(mode: string, source: string): Record<string, unknown> {
  if (mode === 'latest') return { continueLatestCompleted: true };
  if (mode === 'continuation') {
    if (!source.trim()) throw new Error('완료 서사 ID를 입력하세요.');
    return { continuationOfId: source.trim() };
  }
  if (mode === 'merge') {
    const list = ids(source);
    if (list.length < 2 || list.length > 4) throw new Error('같은 대표 종목의 완료 서사 2~4개를 선택하세요.');
    return { mergeSourceIds: list };
  }
  return {};
}
export function validArtifact<T extends { status: string }>(value: T | undefined): T | undefined {
  return value?.status === 'AVAILABLE' ? value : undefined;
}
export const decisionLabels: Record<string, string> = {
  STARTED: '진행 중 또는 중단 가능',
  HOLD: '주문 없음',
  ORDERS_SUBMITTED: '주문 접수 (체결 미확정)',
  ERROR: '판단/기록 오류 · 접수된 주문이 있을 수 있음',
  NOT_DUE: '다음 판단 시각 전',
  ALREADY_CLAIMED: '다른 실행이 처리 중',
};

export function additionalStockIds(value: string, root: string) {
  const list = value === '[]' ? [] : value.split(',').map((x) => x.trim());
  if (list.length > 9 || list.some((x) => !x || x === root) || new Set(list).size !== list.length)
    throw new Error('추가 종목은 대표 종목을 제외한 중복 없는 ID 최대 9개입니다.');
  return list;
}
