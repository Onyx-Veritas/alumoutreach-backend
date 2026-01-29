-- ============================================================
-- Migration: 010_sequences.sql
-- Purpose: Drip sequence automation for nurturing campaigns
-- ============================================================
-- Creates:
--   1. sequence_type enum
--   2. sequences table
--   3. sequence_step_type enum
--   4. sequence_steps table
--   5. sequence_run_status enum
--   6. sequence_exit_reason enum
--   7. sequence_runs table
-- ============================================================

-- ============ SEQUENCE TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE sequence_type AS ENUM (
        'drip',
        'onboarding',
        'behavioral'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEQUENCES TABLE ============
CREATE TABLE IF NOT EXISTS sequences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    type                sequence_type NOT NULL DEFAULT 'drip',
    trigger_config      JSONB,
    is_published        BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    published_at        TIMESTAMPTZ,
    published_by        UUID,
    -- Audit
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    -- Statistics (cached)
    total_enrollments   INTEGER DEFAULT 0,
    completed_runs      INTEGER DEFAULT 0,
    exited_runs         INTEGER DEFAULT 0,
    failed_runs         INTEGER DEFAULT 0,
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sequences_tenant ON sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sequences_tenant_type ON sequences(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_sequences_tenant_published ON sequences(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS idx_sequences_tenant_created ON sequences(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sequences_deleted ON sequences(deleted_at);

DROP TRIGGER IF EXISTS set_sequences_updated_at ON sequences;
CREATE TRIGGER set_sequences_updated_at
    BEFORE UPDATE ON sequences
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ SEQUENCE STEP TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE sequence_step_type AS ENUM (
        'send_message',
        'delay',
        'condition',
        'end'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEQUENCE STEPS TABLE ============
CREATE TABLE IF NOT EXISTS sequence_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sequence_id         UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    step_number         INTEGER NOT NULL,
    name                VARCHAR(255),
    description         TEXT,
    step_type           sequence_step_type NOT NULL,
    config              JSONB NOT NULL DEFAULT '{}',
    next_step_id        UUID,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_tenant ON sequence_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_tenant_sequence ON sequence_steps(tenant_id, sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON sequence_steps(sequence_id, step_number);

DROP TRIGGER IF EXISTS set_sequence_steps_updated_at ON sequence_steps;
CREATE TRIGGER set_sequence_steps_updated_at
    BEFORE UPDATE ON sequence_steps
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ SEQUENCE RUN STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE sequence_run_status AS ENUM (
        'running',
        'completed',
        'exited',
        'failed',
        'waiting'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEQUENCE EXIT REASON ENUM ============
DO $$ BEGIN
    CREATE TYPE sequence_exit_reason AS ENUM (
        'completed',
        'manual_exit',
        'condition_exit',
        'trigger_exit',
        'unsubscribed',
        'contact_deleted',
        'error'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ SEQUENCE RUNS TABLE ============
CREATE TABLE IF NOT EXISTS sequence_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sequence_id             UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    current_step_id         UUID,
    current_step_number     INTEGER DEFAULT 0,
    status                  sequence_run_status NOT NULL DEFAULT 'running',
    context                 JSONB NOT NULL DEFAULT '{"variables": {}, "stepHistory": []}',
    next_execution_at       TIMESTAMPTZ,
    correlation_id          VARCHAR(255),
    enrolled_by             UUID,
    enrollment_source       VARCHAR(100),
    exit_reason             sequence_exit_reason,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_runs_tenant ON sequence_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_sequence ON sequence_runs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_contact ON sequence_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_tenant_sequence ON sequence_runs(tenant_id, sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_tenant_contact ON sequence_runs(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_tenant_status ON sequence_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_scheduler ON sequence_runs(status, next_execution_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_sequence_runs_sequence_contact ON sequence_runs(sequence_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_correlation ON sequence_runs(correlation_id) WHERE correlation_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_sequence_runs_updated_at ON sequence_runs;
CREATE TRIGGER set_sequence_runs_updated_at
    BEFORE UPDATE ON sequence_runs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('010', 'sequences')
ON CONFLICT (version) DO NOTHING;
