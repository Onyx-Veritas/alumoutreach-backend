-- ============================================================
-- Migration: 006_templates.sql
-- Purpose: Message templates with versioning and approval workflow
-- ============================================================
-- Creates:
--   1. template_channel enum
--   2. template_category enum
--   3. template_status enum
--   4. approval_status enum
--   5. templates table
--   6. template_versions table
--   7. template_usage_stats table
-- ============================================================

-- ============ TEMPLATE CHANNEL ENUM ============
DO $$ BEGIN
    CREATE TYPE template_channel AS ENUM (
        'email',
        'sms',
        'whatsapp',
        'push',
        'rcs'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ TEMPLATE CATEGORY ENUM ============
DO $$ BEGIN
    CREATE TYPE template_category AS ENUM (
        'transactional',
        'marketing',
        'lifecycle',
        'compliance',
        'notification',
        'reminder'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ TEMPLATE STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE template_status AS ENUM (
        'active',
        'inactive',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ APPROVAL STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'draft',
        'pending',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ TEMPLATES TABLE ============
CREATE TABLE IF NOT EXISTS templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    channel                 template_channel NOT NULL,
    category                template_category NOT NULL DEFAULT 'marketing',
    status                  template_status NOT NULL DEFAULT 'active',
    approval_status         approval_status NOT NULL DEFAULT 'draft',
    is_approved             BOOLEAN NOT NULL DEFAULT false,
    approval_notes          TEXT,
    approved_by             UUID,
    approved_at             TIMESTAMPTZ,
    current_version_id      UUID,
    current_version_number  INTEGER DEFAULT 0,
    -- Organization
    folder                  VARCHAR(255),
    tags                    TEXT[] DEFAULT '{}',
    -- Usage tracking
    usage_count             INTEGER DEFAULT 0,
    last_used_at            TIMESTAMPTZ,
    -- Metadata
    metadata                JSONB,
    -- Audit fields
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_tenant_name ON templates(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_templates_tenant_channel ON templates(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_templates_tenant_category ON templates(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_templates_tenant_approval ON templates(tenant_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_templates_tenant_status ON templates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_templates_deleted_at ON templates(tenant_id, deleted_at);

DROP TRIGGER IF EXISTS set_templates_updated_at ON templates;
CREATE TRIGGER set_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ TEMPLATE VERSIONS TABLE ============
CREATE TABLE IF NOT EXISTS template_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL,
    channel             template_channel NOT NULL,
    content             JSONB NOT NULL,
    variables           TEXT[] DEFAULT '{}',
    changelog           TEXT,
    is_current          BOOLEAN NOT NULL DEFAULT false,
    is_valid            BOOLEAN NOT NULL DEFAULT true,
    validation_errors   JSONB,
    preview_data        JSONB,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_tenant ON template_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_lookup ON template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_created ON template_versions(template_id, created_at);
CREATE INDEX IF NOT EXISTS idx_template_versions_current ON template_versions(template_id, is_current) WHERE is_current = true;

-- Add foreign key for current_version_id after template_versions exists
ALTER TABLE templates 
    DROP CONSTRAINT IF EXISTS fk_templates_current_version;
ALTER TABLE templates 
    ADD CONSTRAINT fk_templates_current_version 
    FOREIGN KEY (current_version_id) 
    REFERENCES template_versions(id) 
    ON DELETE SET NULL;

-- ============ TEMPLATE USAGE STATS TABLE ============
CREATE TABLE IF NOT EXISTS template_usage_stats (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id             UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    template_version_id     UUID NOT NULL REFERENCES template_versions(id) ON DELETE CASCADE,
    date                    DATE NOT NULL,
    -- Delivery metrics
    sent_count              INTEGER DEFAULT 0,
    delivered_count         INTEGER DEFAULT 0,
    failed_count            INTEGER DEFAULT 0,
    bounced_count           INTEGER DEFAULT 0,
    -- Engagement metrics
    opened_count            INTEGER DEFAULT 0,
    clicked_count           INTEGER DEFAULT 0,
    replied_count           INTEGER DEFAULT 0,
    unsubscribed_count      INTEGER DEFAULT 0,
    complained_count        INTEGER DEFAULT 0,
    -- Calculated rates (cached)
    delivery_rate           DECIMAL(5,2) DEFAULT 0,
    open_rate               DECIMAL(5,2) DEFAULT 0,
    click_rate              DECIMAL(5,2) DEFAULT 0,
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_version_id, date)
);

CREATE INDEX IF NOT EXISTS idx_template_usage_version ON template_usage_stats(template_version_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant ON template_usage_stats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant_version ON template_usage_stats(tenant_id, template_version_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant_date ON template_usage_stats(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_stats(template_id);

DROP TRIGGER IF EXISTS set_template_usage_stats_updated_at ON template_usage_stats;
CREATE TRIGGER set_template_usage_stats_updated_at
    BEFORE UPDATE ON template_usage_stats
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('006', 'templates')
ON CONFLICT (version) DO NOTHING;
