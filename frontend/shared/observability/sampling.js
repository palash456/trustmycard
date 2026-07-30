const DEFAULT_POLICY = {
    trace: { firstN: 10, thenEveryNth: 100 },
    debug: { firstN: 10, thenEveryNth: 100 },
    info: { firstN: 10, thenEveryNth: 100 },
    warn: { firstN: 20, thenEveryNth: 50 },
    error: { firstN: Number.MAX_SAFE_INTEGER, thenEveryNth: 1 },
    fatal: { firstN: Number.MAX_SAFE_INTEGER, thenEveryNth: 1 },
};
export const DEFAULT_SAMPLING_CONFIG = {
    enabled: true,
    defaultPolicy: DEFAULT_POLICY,
    moduleOverrides: {
        collector: {
            info: { firstN: 5, thenEveryNth: 500 },
        },
        rpc: {
            warn: { firstN: 10, thenEveryNth: 100 },
        },
    },
    neverSampleLevels: ["error", "fatal"],
};
function stableHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}
export function buildSamplingKey(parts) {
    const normalized = Object.keys(parts)
        .sort()
        .map((k) => `${k}=${String(parts[k] ?? "")}`)
        .join("|");
    return stableHash(normalized);
}
export class LogSampler {
    constructor(config = {}, maxBuckets = 10000) {
        this.buckets = new Map();
        this.config = { ...DEFAULT_SAMPLING_CONFIG, ...config };
        this.maxBuckets = maxBuckets;
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    shouldEmit(level, module, keyParts) {
        if (!this.config.enabled)
            return { emit: true };
        if (this.config.neverSampleLevels.includes(level))
            return { emit: true };
        const policy = this.resolvePolicy(level, module);
        const samplingKey = buildSamplingKey({ level, module, ...keyParts });
        const now = new Date().toISOString();
        let bucket = this.buckets.get(samplingKey);
        if (!bucket) {
            if (this.buckets.size >= this.maxBuckets) {
                const firstKey = this.buckets.keys().next().value;
                if (firstKey)
                    this.buckets.delete(firstKey);
            }
            bucket = { count: 0, firstAt: now, latestAt: now };
            this.buckets.set(samplingKey, bucket);
        }
        bucket.count += 1;
        bucket.latestAt = now;
        const { count, firstAt, latestAt } = bucket;
        const suppressedCount = count - 1;
        if (count <= policy.firstN) {
            return { emit: true };
        }
        const afterFirst = count - policy.firstN;
        if (afterFirst % policy.thenEveryNth === 0) {
            return {
                emit: true,
                info: {
                    totalOccurrences: count,
                    suppressedCount,
                    firstOccurrenceAt: firstAt,
                    latestOccurrenceAt: latestAt,
                    samplingKey,
                },
            };
        }
        return { emit: false };
    }
    getSuppressedCount(samplingKey) {
        const bucket = this.buckets.get(samplingKey);
        return bucket ? Math.max(0, bucket.count - 1) : 0;
    }
    resolvePolicy(level, module) {
        const override = this.config.moduleOverrides[module]?.[level];
        return override ?? this.config.defaultPolicy[level];
    }
}
