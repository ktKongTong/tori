import { metrics, ValueType, type Attributes, type MeterOptions } from "@opentelemetry/api";

export type MeterSource = {
  name: string;
  version?: string;
  options?: MeterOptions;
};

export type MetricAttrs = Attributes;

export type CounterOptions = {
  description?: string;
  unit?: string;
  valueType?: ValueType;
};

export type HistogramOptions = CounterOptions & {
  boundaries?: number[];
};

export function getMeter(source: MeterSource | string) {
  if (typeof source === "string") return metrics.getMeter(source);
  return metrics.getMeter(source.name, source.version, source.options);
}

export function createCounter(
  source: MeterSource | string,
  name: string,
  options: CounterOptions = {},
) {
  return getMeter(source).createCounter(name, {
    description: options.description,
    unit: options.unit,
    valueType: options.valueType ?? ValueType.INT,
  });
}

export function createUpDownCounter(
  source: MeterSource | string,
  name: string,
  options: CounterOptions = {},
) {
  return getMeter(source).createUpDownCounter(name, {
    description: options.description,
    unit: options.unit,
    valueType: options.valueType ?? ValueType.INT,
  });
}

export function createHistogram(
  source: MeterSource | string,
  name: string,
  options: HistogramOptions = {},
) {
  return getMeter(source).createHistogram(name, {
    description: options.description,
    unit: options.unit,
    valueType: options.valueType,
    advice: options.boundaries ? { explicitBucketBoundaries: options.boundaries } : undefined,
  });
}

export async function recordDuration<T>(
  histogram: ReturnType<ReturnType<typeof getMeter>["createHistogram"]>,
  attrs: MetricAttrs | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    histogram.record(performance.now() - startedAt, attrs);
  }
}
