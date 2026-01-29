-- ============================================================
-- Migration: 009_workflows.sql
-- Purpose: Visual workflow automation engine
-- ============================================================
-- Creates:
--   1. workflow_trigger_type enum
--   2. workflows table
--   3. workflow_run_status enum
--   4. workflow_runs table
--   5. workflow_node_type enum
--   6. workflow_node_run_status enum
--   7. workflow_node_runs table
-- ============================================================

-- ============ WORKFLOW TRIGGER TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE workflow_trigger_type AS ENUM (
        'incoming_message',
        'event_based',
        'time_based'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ WORKFLOWS TABLE ============
CREATE TABLE IF NOT EXISTS workflows (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    trigger_type        workflow_trigger_type NOT NULL,
    trigger_config      JSONB,
    graph               JSONB NOT NULL,
    is_published        BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    published_at        TIMESTAMPTZ,
    published_by        UUID,
    -- Stats (cached)
    total_runs          INTEGER DEFAULT 0,
    successful_runs     INTEGER DEFAULT 0,
    failed_runs         INTEGER DEFAULT 0,
    -- Audit fields
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_name ON workflows(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_trigger ON workflows(tenant_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_published ON workflows(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_created ON workflows(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_deleted ON workflows(tenant_id, deleted_at);

DROP TRIGGER IF EXISTS set_workflows_updated_at ON workflows;
CREATE TRIGGER set_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ WORKFLOW RUN STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE workflow_run_status AS ENUM (
        'pending',
        'running',
        'waiting',
        'completed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ WORKFLOW RUNS TABLE ============
CREATE TABLE IF NOT EXISTS workflow_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id         UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
    status              workflow_run_status NOT NULL DEFAULT 'pending',
    current_node_id     VARCHAR(100),
    context             JSONB,
    next_execution_at   TIMESTAMPTZ,
    correlation_id      VARCHAR(255),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_contact ON workflow_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_workflow ON workflow_runs(tenant_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_contact ON workflow_runs(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_status ON workflow_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_created ON workflow_runs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_scheduler ON workflow_runs(status, next_execution_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_workflow_runs_correlation ON workflow_runs(correlation_id) WHERE correlation_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_workflow_runs_updated_at ON workflow_runs;
CREATE TRIGGER set_workflow_runs_updated_at
    BEFORE UPDATE ON workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ WORKFLOW NODE TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE workflow_node_type AS ENUM (
        'start',
        'send_message',
        'condition',
        'delay',
        'update_attribute',
        'assign_agent',
        'end'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ WORKFLOW NODE RUN STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE workflow_node_run_status AS ENUM (
        'pending',
        'executing',
        'completed',
        'failed',
        'skipped'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ WORKFLOW NODE RUNS TABLE ============
CREATE TABLE IF NOT EXISTS workflow_node_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id              UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id             VARCHAR(100) NOT NULL,
    node_type           workflow_node_type NOT NULL,
    status              workflow_node_run_status NOT NULL DEFAULT 'pending',
    input               JSONB,
    result              JSONB,
    error_message       TEXT,
    duration_ms         INTEGER,
    executed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_tenant ON workflow_node_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_run ON workflow_node_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_tenant_run ON workflow_node_runs(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_run_node ON workflow_node_runs(run_id, node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_tenant_executed ON workflow_node_runs(tenant_id, executed_at);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('009', 'workflows')
ON CONFLICT (version) DO NOTHING;
