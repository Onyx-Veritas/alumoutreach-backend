-- Migration: Add pipeline job hardening columns
-- Adds: skip_reason, queued_at, processing_at, failed_at, skipped_at columns
-- Updates: pipeline_job_status enum to include 'skipped'

-- Step 1: Add 'skipped' to the pipeline_job_status enum
-- Note: The enum is named 'pipeline_job_status' (not 'pipeline_job_status_enum')
-- ALTER TYPE ADD VALUE cannot be run in a transaction, so we use a separate statement
ALTER TYPE pipeline_job_status ADD VALUE IF NOT EXISTS 'skipped';

-- Step 2: Create skip_reason enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_skip_reason_enum') THEN
        CREATE TYPE pipeline_skip_reason_enum AS ENUM (
            'missing_email',
            'invalid_email',
            'missing_phone',
            'invalid_phone',
            'unsubscribed',
            'contact_not_found',
            'template_error',
            'duplicate_send',
            'other'
        );
    END IF;
END $$;

-- Step 3: Add new columns to pipeline_jobs table
ALTER TABLE pipeline_jobs 
ADD COLUMN IF NOT EXISTS skip_reason pipeline_skip_reason_enum,
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;

-- Step 4: Add index for skipped jobs (useful for reporting)
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_skip_reason 
ON pipeline_jobs (skip_reason) 
WHERE skip_reason IS NOT NULL;

-- Step 5: Add index for status with timestamp (for analytics)
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status_sent_at 
ON pipeline_jobs (status, sent_at) 
WHERE sent_at IS NOT NULL;

-- Verification
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_name = 'pipeline_jobs' 
AND column_name IN ('skip_reason', 'queued_at', 'processing_at', 'failed_at', 'skipped_at')
ORDER BY column_name;
