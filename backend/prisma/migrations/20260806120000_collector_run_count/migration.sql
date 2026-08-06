-- Track how many times the collector has run per approval (enforces COLLECTOR_MAX_RUNS).
ALTER TABLE "Approval" ADD COLUMN "collectorRunCount" INTEGER NOT NULL DEFAULT 0;
