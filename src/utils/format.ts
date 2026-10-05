import { money } from './contracts';
export const currency = (value: string | number) => money(value);

export const compact = (value: number) =>
  new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
