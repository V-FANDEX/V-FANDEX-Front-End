export const currency = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

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
