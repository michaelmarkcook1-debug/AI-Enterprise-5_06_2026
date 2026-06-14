-- Daily point-in-time ranking snapshots.
-- One row per (vendor, snapshot_date). Backs the dashboard
-- "Who's winning / losing" hover-over trend graphs and any future
-- time-series ranking analysis.
CREATE TABLE "vendor_ranking_snapshots" (
  "id"               TEXT NOT NULL,
  "vendor_id"        TEXT NOT NULL,
  "snapshot_date"    DATE NOT NULL,
  "overall_score"    DOUBLE PRECISION NOT NULL,
  "momentum_score"   DOUBLE PRECISION NOT NULL,
  "confidence_score" DOUBLE PRECISION NOT NULL,
  "rank"             INTEGER NOT NULL,
  "tracked_vendors"  INTEGER NOT NULL,
  "source"           TEXT NOT NULL DEFAULT 'snapshot',
  "captured_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_ranking_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_ranking_snapshots_vendor_id_snapshot_date_key"
  ON "vendor_ranking_snapshots" ("vendor_id", "snapshot_date");

CREATE INDEX "vendor_ranking_snapshots_snapshot_date_idx"
  ON "vendor_ranking_snapshots" ("snapshot_date");

CREATE INDEX "vendor_ranking_snapshots_vendor_id_snapshot_date_idx"
  ON "vendor_ranking_snapshots" ("vendor_id", "snapshot_date");

ALTER TABLE "vendor_ranking_snapshots"
  ADD CONSTRAINT "vendor_ranking_snapshots_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
