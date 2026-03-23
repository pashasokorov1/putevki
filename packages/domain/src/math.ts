const SCALE = 100;

// Денежный подход с integer-scale помогает не накапливать ошибки IEEE 754
// при суммировании и вычитании топлива по шагам расчета.
export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * SCALE);
}

export function fromCents(value: number): number {
  return value / SCALE;
}

export function roundToTwo(value: number): number {
  return fromCents(toCents(value));
}

export function add(values: number[]): number {
  return fromCents(values.reduce((sum, item) => sum + toCents(item), 0));
}

export function subtract(left: number, right: number): number {
  return fromCents(toCents(left) - toCents(right));
}

export function multiply(value: number, factor: number): number {
  return roundToTwo(value * factor);
}
