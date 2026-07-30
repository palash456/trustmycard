import { Injectable } from "@nestjs/common";
import {
  DEFAULT_SAMPLING_CONFIG,
  LogSampler,
  type SamplingConfig,
  type SamplingDecision,
  type LogLevel,
} from "@trustmycard/shared/observability";

@Injectable()
export class LogSamplerService {
  private readonly sampler: LogSampler;

  constructor() {
    const enabled = process.env.LOG_SAMPLING_ENABLED !== "false";
    const config: Partial<SamplingConfig> = { enabled };
    this.sampler = new LogSampler(config);
  }

  shouldEmit(
    level: LogLevel,
    module: string,
    keyParts: Record<string, unknown>
  ): SamplingDecision {
    return this.sampler.shouldEmit(level, module, keyParts);
  }
}

export { DEFAULT_SAMPLING_CONFIG };
