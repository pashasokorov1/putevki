export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatLiters(value: number): string {
  return `${formatNumber(value)} л`;
}

export function formatKm(value: number): string {
  return `${formatNumber(value)} км`;
}

export function formatHours(value: number): string {
  return `${formatNumber(value)} ч`;
}
