-- ============================================================
-- Migration: 011_pipeline.sql
-- Purpose: Message dispatch pipeline for campaign execution
-- ============================================================
-- Creates:
--   1. pipeline_channel enum
--   2. pipeline_job_status enum
--   3. pipeline_jobs table
--   4. pipeline_failures table
-- ============================================================

-- ============ PIPELINE CHANNEL ENUM ============
DO $$ BEGIN
    CREATE TYPE pipeline_channel AS ENUM (
        'email',
        'sms',
        'whatsapp',
        'push'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ PIPELINE JOB STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE pipeline_job_status AS ENUM (
        'queued',
        'pending',
        'processing',
        'sent',
        'delivered',
        'failed',
        'retrying',
        'dead'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ PIPELINE JOBS TABLE ============
CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id             UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_run_id         UUID NOT NULL REFERENCES campaign_runs(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    template_version_id     UUID,
    channel                 pipeline_channel NOT NULL,
    payload                 JSONB,
    status                  pipeline_job_status NOT NULL DEFAULT 'pending',
    retry_count             INTEGER DEFAULT 0,
    next_attempt_at         TIMESTAMPTZ,
    error_message           TEXT,
    provider_message_id     VARCHAR(255),
    sent_at                 TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant ON pipeline_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_campaign ON pipeline_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_run ON pipeline_jobs(campaign_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_contact ON pipeline_jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant_status ON pipeline_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant_campaign ON pipeline_jobs(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant_run ON pipeline_jobs(tenant_id, campaign_run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant_contact ON pipeline_jobs(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_tenant_next ON pipeline_jobs(tenant_id, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_worker ON pipeline_jobs(status, next_attempt_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_provider ON pipeline_jobs(provider_message_id) WHERE provider_message_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_pipeline_jobs_updated_at ON pipeline_jobs;
CREATE TRIGGER set_pipeline_jobs_updated_at
    BEFORE UPDATE ON pipeline_jobs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ PIPELINE FAILURES TABLE ============
CREATE TABLE IF NOT EXISTS pipeline_failures (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id              UUID NOT NULL REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
    campaign_id         UUID,
    contact_id          UUID,
    error_message       TEXT NOT NULL,
    last_status         pipeline_job_status NOT NULL,
    retry_count         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_failures_tenant ON pipeline_failures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_failures_job ON pipeline_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_failures_tenant_job ON pipeline_failures(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_failures_campaign ON pipeline_failures(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_failures_created ON pipeline_failures(tenant_id, created_at);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('011', 'pipeline')
ON CONFLICT (version) DO NOTHING;
