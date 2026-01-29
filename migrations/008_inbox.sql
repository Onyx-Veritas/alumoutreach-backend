-- ============================================================
-- Migration: 008_inbox.sql
-- Purpose: Unified inbox for multi-channel conversations
-- ============================================================
-- Creates:
--   1. inbox_channel enum
--   2. thread_status enum
--   3. thread_priority enum
--   4. inbox_threads table
--   5. message_direction enum
--   6. message_delivery_status enum
--   7. inbox_messages table
--   8. activity_type enum
--   9. inbox_activities table
-- ============================================================

-- ============ INBOX CHANNEL ENUM ============
DO $$ BEGIN
    CREATE TYPE inbox_channel AS ENUM (
        'whatsapp',
        'sms',
        'email',
        'push',
        'internal'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ THREAD STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE thread_status AS ENUM (
        'open',
        'closed',
        'pending',
        'escalated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ THREAD PRIORITY ENUM ============
DO $$ BEGIN
    CREATE TYPE thread_priority AS ENUM (
        'low',
        'normal',
        'high',
        'urgent'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ INBOX THREADS TABLE ============
CREATE TABLE IF NOT EXISTS inbox_threads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    channel             inbox_channel NOT NULL,
    unread_count        INTEGER DEFAULT 0,
    message_count       INTEGER DEFAULT 0,
    last_message_at     TIMESTAMPTZ,
    status              thread_status NOT NULL DEFAULT 'open',
    priority            thread_priority NOT NULL DEFAULT 'normal',
    assigned_to         UUID,
    assigned_at         TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    is_starred          BOOLEAN NOT NULL DEFAULT false,
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    closed_at           TIMESTAMPTZ,
    closed_by           UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_threads_tenant ON inbox_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_contact ON inbox_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_contact_channel ON inbox_threads(tenant_id, contact_id, channel);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_status ON inbox_threads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_assigned ON inbox_threads(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_last_message ON inbox_threads(tenant_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_starred ON inbox_threads(tenant_id, is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_inbox_threads_archived ON inbox_threads(tenant_id, is_archived);

DROP TRIGGER IF EXISTS set_inbox_threads_updated_at ON inbox_threads;
CREATE TRIGGER set_inbox_threads_updated_at
    BEFORE UPDATE ON inbox_threads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ MESSAGE DIRECTION ENUM ============
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM (
        'inbound',
        'outbound',
        'system'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ MESSAGE DELIVERY STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE message_delivery_status AS ENUM (
        'pending',
        'sent',
        'delivered',
        'read',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ INBOX MESSAGES TABLE ============
CREATE TABLE IF NOT EXISTS inbox_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    thread_id           UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    direction           message_direction NOT NULL,
    channel             inbox_channel NOT NULL,
    content             TEXT,
    media_url           VARCHAR(500),
    template_id         UUID,
    pipeline_job_id     UUID,
    workflow_run_id     UUID,
    sequence_run_id     UUID,
    campaign_id         UUID,
    delivery_status     message_delivery_status NOT NULL DEFAULT 'pending',
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    sent_by             UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant ON inbox_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON inbox_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_contact ON inbox_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant_thread ON inbox_messages(tenant_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant_contact ON inbox_messages(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant_created ON inbox_messages(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread_created ON inbox_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_campaign ON inbox_messages(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============ ACTIVITY TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM (
        'assigned',
        'status_changed',
        'tag_added',
        'tag_removed',
        'note_added',
        'system_event',
        'priority_changed',
        'thread_created',
        'thread_closed',
        'thread_reopened'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ INBOX ACTIVITIES TABLE ============
CREATE TABLE IF NOT EXISTS inbox_activities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    thread_id           UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
    type                activity_type NOT NULL,
    old_value           JSONB,
    new_value           JSONB,
    description         TEXT,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_activities_tenant ON inbox_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbox_activities_thread ON inbox_activities(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_activities_tenant_thread ON inbox_activities(tenant_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_activities_tenant_created ON inbox_activities(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_activities_thread_created ON inbox_activities(thread_id, created_at);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('008', 'inbox')
ON CONFLICT (version) DO NOTHING;
