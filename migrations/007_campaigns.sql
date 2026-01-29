-- ============================================================
-- Migration: 007_campaigns.sql
-- Purpose: Campaign management for multi-channel outreach
-- ============================================================
-- Creates:
--   1. campaign_channel enum
--   2. campaign_status enum
--   3. campaigns table
--   4. campaign_run_status enum
--   5. campaign_runs table
--   6. dispatch_status enum
--   7. campaign_messages table
-- ============================================================

-- ============ CAMPAIGN CHANNEL ENUM ============
DO $$ BEGIN
    CREATE TYPE campaign_channel AS ENUM (
        'email',
        'sms',
        'whatsapp',
        'push'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CAMPAIGN STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM (
        'draft',
        'scheduled',
        'running',
        'completed',
        'cancelled',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CAMPAIGNS TABLE ============
CREATE TABLE IF NOT EXISTS campaigns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    channel                 campaign_channel NOT NULL,
    template_version_id     UUID,
    segment_id              UUID,
    schedule_at             TIMESTAMPTZ,
    status                  campaign_status NOT NULL DEFAULT 'draft',
    -- Audience stats (cached)
    audience_count          INTEGER DEFAULT 0,
    sent_count              INTEGER DEFAULT 0,
    delivered_count         INTEGER DEFAULT 0,
    failed_count            INTEGER DEFAULT 0,
    opened_count            INTEGER DEFAULT 0,
    clicked_count           INTEGER DEFAULT 0,
    -- Metadata
    metadata                JSONB,
    -- Soft delete
    is_deleted              BOOLEAN NOT NULL DEFAULT false,
    -- Audit fields
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_name ON campaigns(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_channel ON campaigns(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_schedule ON campaigns(tenant_id, schedule_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_created ON campaigns(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_template ON campaigns(template_version_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_segment ON campaigns(segment_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(tenant_id, deleted_at);

DROP TRIGGER IF EXISTS set_campaigns_updated_at ON campaigns;
CREATE TRIGGER set_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ CAMPAIGN RUN STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE campaign_run_status AS ENUM (
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CAMPAIGN RUNS TABLE ============
CREATE TABLE IF NOT EXISTS campaign_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status                  campaign_run_status NOT NULL DEFAULT 'pending',
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    -- Run statistics
    total_recipients        INTEGER DEFAULT 0,
    processed_count         INTEGER DEFAULT 0,
    sent_count              INTEGER DEFAULT 0,
    failed_count            INTEGER DEFAULT 0,
    -- Metadata
    metadata                JSONB,
    -- Error info
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_runs_campaign ON campaign_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_tenant ON campaign_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_status ON campaign_runs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_runs_started ON campaign_runs(campaign_id, started_at);

-- ============ DISPATCH STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE dispatch_status AS ENUM (
        'pending',
        'sent',
        'delivered',
        'failed',
        'bounced',
        'opened',
        'clicked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CAMPAIGN MESSAGES TABLE ============
CREATE TABLE IF NOT EXISTS campaign_messages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id             UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    run_id                  UUID REFERENCES campaign_runs(id) ON DELETE SET NULL,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    template_version_id     UUID,
    dispatch_status         dispatch_status NOT NULL DEFAULT 'pending',
    provider_message_id     VARCHAR(255),
    dispatch_error          TEXT,
    -- Rendered content (for audit)
    rendered_content        JSONB,
    -- Delivery/engagement timestamps
    sent_at                 TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    opened_at               TIMESTAMPTZ,
    clicked_at              TIMESTAMPTZ,
    bounced_at              TIMESTAMPTZ,
    -- Metadata
    metadata                JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_run ON campaign_messages(run_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_tenant ON campaign_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_contact ON campaign_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_status ON campaign_messages(campaign_id, dispatch_status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_run_status ON campaign_messages(run_id, dispatch_status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_provider ON campaign_messages(provider_message_id);

DROP TRIGGER IF EXISTS set_campaign_messages_updated_at ON campaign_messages;
CREATE TRIGGER set_campaign_messages_updated_at
    BEFORE UPDATE ON campaign_messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('007', 'campaigns')
ON CONFLICT (version) DO NOTHING;
