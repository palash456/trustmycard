-- Speed up structured log list queries (kind = 'log' ordered by ts).
CREATE INDEX IF NOT EXISTS "ObservabilityEvent_kind_ts_idx" ON "ObservabilityEvent"("kind", "ts" DESC);
