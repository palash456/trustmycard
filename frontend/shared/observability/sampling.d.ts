import type { LogLevel } from "./schemas";
export type SamplingPolicy = {
  firstN: number;
  thenEveryNth: number;
};
export type SamplingConfig = {
  enabled: boolean;
  defaultPolicy: Record<LogLevel, SamplingPolicy>;
  moduleOverrides: Record<string, Partial<Record<LogLevel, SamplingPolicy>>>;
  neverSampleLevels: LogLevel[];
};
export type SamplingDecision =
  | {
      emit: true;
      info?: never;
    }
  | {
      emit: true;
      info: {
        totalOccurrences: number;
        suppressedCount: number;
        firstOccurrenceAt: string;
        latestOccurrenceAt: string;
        samplingKey: string;
      };
    }
  | {
      emit: false;
    };
export declare const DEFAULT_SAMPLING_CONFIG: SamplingConfig;
export declare function buildSamplingKey(
  parts: Record<string, unknown>,
): string;
export declare class LogSampler {
  private config;
  private readonly maxBuckets;
  private readonly buckets;
  constructor(config?: Partial<SamplingConfig>, maxBuckets?: number);
  updateConfig(config: Partial<SamplingConfig>): void;
  shouldEmit(
    level: LogLevel,
    module: string,
    keyParts: Record<string, unknown>,
  ): SamplingDecision;
  getSuppressedCount(samplingKey: string): number;
  private resolvePolicy;
}
//# sourceMappingURL=sampling.d.ts.map
