-- 013_campaign_run_skipped_count.sql
-- Promotes skippedCount from metadata JSONB to a proper column for query consistency.

-- Add skipped_count column
ALTER TABLE campaign_runs ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;

-- Backfill from metadata JSONB where it was previously stored
UPDATE campaign_runs
SET skipped_count = COALESCE((metadata->>'skippedCount')::int, 0)
WHERE metadata IS NOT NULL AND metadata->>'skippedCount' IS NOT NULL;
