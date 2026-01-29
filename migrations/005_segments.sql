-- ============================================================
-- Migration: 005_segments.sql
-- Purpose: Contact segmentation for targeted campaigns
-- ============================================================
-- Creates:
--   1. segment_type enum
--   2. segment_status enum
--   3. segments table
--   4. member_source enum
--   5. segment_members table
-- ============================================================

-- ============ SEGMENT TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE segment_type AS ENUM (
        'static',
        'dynamic',
        'event_driven'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEGMENT STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE segment_status AS ENUM (
        'active',
        'inactive',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEGMENTS TABLE ============
CREATE TABLE IF NOT EXISTS segments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                        VARCHAR(255) NOT NULL,
    description                 TEXT,
    type                        segment_type NOT NULL DEFAULT 'dynamic',
    status                      segment_status NOT NULL DEFAULT 'active',
    -- Rules for dynamic segments (JSONB)
    rules                       JSONB,
    -- Event trigger config for event-driven segments
    event_config                JSONB,
    -- Organization
    folder                      VARCHAR(255),
    tags                        TEXT[] DEFAULT '{}',
    color                       VARCHAR(7),
    -- Membership counts (cached)
    member_count                INTEGER DEFAULT 0,
    -- Computation tracking
    last_computed_at            TIMESTAMPTZ,
    computation_duration_ms     INTEGER,
    -- Scheduling for dynamic segments
    refresh_interval_minutes    INTEGER,
    next_refresh_at             TIMESTAMPTZ,
    -- Custom metadata
    metadata                    JSONB,
    -- Audit fields
    created_by                  UUID,
    updated_by                  UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_segments_tenant_id ON segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segments_tenant_name ON segments(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_segments_tenant_type ON segments(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_segments_tenant_status ON segments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_segments_tenant_created ON segments(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_segments_next_refresh ON segments(next_refresh_at) WHERE status = 'active' AND type = 'dynamic';
CREATE INDEX IF NOT EXISTS idx_segments_deleted_at ON segments(deleted_at);

DROP TRIGGER IF EXISTS set_segments_updated_at ON segments;
CREATE TRIGGER set_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ MEMBER SOURCE ENUM ============
DO $$ BEGIN
    CREATE TYPE member_source AS ENUM (
        'manual',
        'dynamic',
        'import',
        'api',
        'event'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEGMENT MEMBERS TABLE ============
CREATE TABLE IF NOT EXISTS segment_members (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    segment_id              UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    source                  member_source NOT NULL DEFAULT 'dynamic',
    added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by                UUID,
    computed_at             TIMESTAMPTZ,
    computation_batch_id    VARCHAR(100),
    metadata                JSONB,
    UNIQUE (segment_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_tenant ON segment_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_contact ON segment_members(contact_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_segment_added ON segment_members(segment_id, added_at);
CREATE INDEX IF NOT EXISTS idx_segment_members_tenant_segment ON segment_members(tenant_id, segment_id);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('005', 'segments')
ON CONFLICT (version) DO NOTHING;
