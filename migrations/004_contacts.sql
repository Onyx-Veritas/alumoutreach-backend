-- ============================================================
-- Migration: 004_contacts.sql
-- Purpose: Contact management with multi-channel support
-- ============================================================
-- Creates:
--   1. contact_status enum
--   2. contacts table
--   3. channel_type & channel_status enums
--   4. channel_identifiers table (email, phone, whatsapp, etc.)
--   5. consent_channel, consent_status, consent_source enums
--   6. contact_consents table (GDPR compliance)
--   7. attribute_type enum
--   8. contact_attributes table (flexible custom fields)
--   9. contact_tags table
--   10. contact_tag_mappings junction table
--   11. timeline_event_type enum
--   12. contact_timeline_events table (activity log)
-- ============================================================

-- ============ CONTACT STATUS ENUM ============
DO $$ BEGIN
    CREATE TYPE contact_status AS ENUM (
        'active',
        'inactive',
        'bounced',
        'unsubscribed',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CONTACTS TABLE ============
CREATE TABLE IF NOT EXISTS contacts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id             VARCHAR(255),
    -- Basic info
    full_name               VARCHAR(255) NOT NULL,
    preferred_name          VARCHAR(100),
    email                   VARCHAR(255),
    email_secondary         VARCHAR(255),
    phone                   VARCHAR(50),
    phone_country_code      VARCHAR(10),
    whatsapp                VARCHAR(50),
    profile_image_url       VARCHAR(500),
    -- Extended profile
    salutation              VARCHAR(20),
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    date_of_birth           DATE,
    gender                  VARCHAR(20),
    -- Academic (alumni-specific)
    program                 VARCHAR(255),
    specialization          VARCHAR(255),
    batch_year              INTEGER,
    graduation_year         INTEGER,
    department              VARCHAR(255),
    roll_number             VARCHAR(100),
    degree                  VARCHAR(100),
    -- Professional
    current_company         VARCHAR(255),
    designation             VARCHAR(255),
    industry                VARCHAR(100),
    linkedin_url            VARCHAR(500),
    years_of_experience     INTEGER,
    skills                  TEXT,  -- simple-array stored as comma-separated
    -- Location
    city                    VARCHAR(100),
    state                   VARCHAR(100),
    country                 VARCHAR(100),
    postal_code             VARCHAR(20),
    timezone                VARCHAR(50),
    -- Engagement
    engagement_score        INTEGER DEFAULT 50,
    status                  contact_status NOT NULL DEFAULT 'active',
    roles                   TEXT,  -- simple-array stored as comma-separated
    preferred_language      VARCHAR(10) DEFAULT 'en',
    last_activity_at        TIMESTAMPTZ,
    last_contacted_at       TIMESTAMPTZ,
    total_interactions      INTEGER DEFAULT 0,
    -- Soft delete
    is_deleted              BOOLEAN NOT NULL DEFAULT false,
    deleted_at              TIMESTAMPTZ,
    deleted_by              UUID,
    -- Metadata
    metadata                JSONB,
    -- Audit
    created_by              UUID,
    updated_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON contacts(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_status ON contacts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON contacts(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);

DROP TRIGGER IF EXISTS set_contacts_updated_at ON contacts;
CREATE TRIGGER set_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ CHANNEL TYPE & STATUS ENUMS ============
DO $$ BEGIN
    CREATE TYPE channel_type AS ENUM (
        'email',
        'sms',
        'whatsapp',
        'push',
        'voice',
        'linkedin',
        'twitter'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE channel_status AS ENUM (
        'active',
        'unverified',
        'bounced',
        'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CHANNEL IDENTIFIERS TABLE ============
CREATE TABLE IF NOT EXISTS channel_identifiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    channel_type        channel_type NOT NULL,
    identifier          VARCHAR(255) NOT NULL,
    display_name        VARCHAR(255),
    status              channel_status NOT NULL DEFAULT 'unverified',
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    verified_at         TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ,
    bounce_count        INTEGER DEFAULT 0,
    last_bounce_at      TIMESTAMPTZ,
    metadata            JSONB,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, channel_type, identifier)
);

CREATE INDEX IF NOT EXISTS idx_channel_identifiers_contact ON channel_identifiers(contact_id);
CREATE INDEX IF NOT EXISTS idx_channel_identifiers_tenant ON channel_identifiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channel_identifiers_lookup ON channel_identifiers(tenant_id, channel_type, identifier);

DROP TRIGGER IF EXISTS set_channel_identifiers_updated_at ON channel_identifiers;
CREATE TRIGGER set_channel_identifiers_updated_at
    BEFORE UPDATE ON channel_identifiers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ CONSENT ENUMS ============
DO $$ BEGIN
    CREATE TYPE consent_channel AS ENUM (
        'email',
        'sms',
        'whatsapp',
        'push',
        'voice'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE consent_status AS ENUM (
        'opted_in',
        'opted_out',
        'pending',
        'unknown'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE consent_source AS ENUM (
        'explicit',
        'implicit',
        'import',
        'system',
        'user_request',
        'preference_center'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CONTACT CONSENTS TABLE ============
CREATE TABLE IF NOT EXISTS contact_consents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    channel             consent_channel NOT NULL,
    status              consent_status NOT NULL DEFAULT 'unknown',
    source              consent_source NOT NULL DEFAULT 'system',
    opted_in_at         TIMESTAMPTZ,
    opted_out_at        TIMESTAMPTZ,
    consent_text        TEXT,
    consent_version     VARCHAR(50),
    ip_address          VARCHAR(50),
    user_agent          TEXT,
    metadata            JSONB,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contact_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_contact_consents_contact ON contact_consents(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_consents_tenant ON contact_consents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_consents_lookup ON contact_consents(tenant_id, channel, status);

DROP TRIGGER IF EXISTS set_contact_consents_updated_at ON contact_consents;
CREATE TRIGGER set_contact_consents_updated_at
    BEFORE UPDATE ON contact_consents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ ATTRIBUTE TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE attribute_type AS ENUM (
        'string',
        'number',
        'boolean',
        'date',
        'datetime',
        'json',
        'array'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CONTACT ATTRIBUTES TABLE ============
CREATE TABLE IF NOT EXISTS contact_attributes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    key                 VARCHAR(100) NOT NULL,
    value               TEXT,
    value_type          attribute_type NOT NULL DEFAULT 'string',
    label               VARCHAR(255),
    category            VARCHAR(100),
    is_searchable       BOOLEAN NOT NULL DEFAULT false,
    is_encrypted        BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contact_id, key)
);

CREATE INDEX IF NOT EXISTS idx_contact_attributes_contact ON contact_attributes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_attributes_tenant ON contact_attributes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_attributes_key ON contact_attributes(tenant_id, key);

DROP TRIGGER IF EXISTS set_contact_attributes_updated_at ON contact_attributes;
CREATE TRIGGER set_contact_attributes_updated_at
    BEFORE UPDATE ON contact_attributes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ CONTACT TAGS TABLE ============
CREATE TABLE IF NOT EXISTS contact_tags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    color               VARCHAR(7),
    icon                VARCHAR(50),
    is_system           BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_tenant ON contact_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_category ON contact_tags(tenant_id, category);

DROP TRIGGER IF EXISTS set_contact_tags_updated_at ON contact_tags;
CREATE TRIGGER set_contact_tags_updated_at
    BEFORE UPDATE ON contact_tags
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ============ CONTACT TAG MAPPINGS TABLE ============
CREATE TABLE IF NOT EXISTS contact_tag_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id              UUID NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
    added_by            UUID,
    added_via           VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tag_mappings_contact ON contact_tag_mappings(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tag_mappings_tag ON contact_tag_mappings(tag_id);
CREATE INDEX IF NOT EXISTS idx_contact_tag_mappings_tenant ON contact_tag_mappings(tenant_id);

-- ============ TIMELINE EVENT TYPE ENUM ============
DO $$ BEGIN
    CREATE TYPE timeline_event_type AS ENUM (
        'contact.created',
        'contact.updated',
        'email.sent',
        'email.opened',
        'email.clicked',
        'email.bounced',
        'sms.sent',
        'sms.delivered',
        'whatsapp.sent',
        'whatsapp.delivered',
        'whatsapp.read',
        'push.sent',
        'push.clicked',
        'campaign.enrolled',
        'campaign.completed',
        'sequence.enrolled',
        'sequence.completed',
        'workflow.triggered',
        'tag.added',
        'tag.removed',
        'consent.updated',
        'attribute.updated',
        'note.added',
        'import',
        'export',
        'merge',
        'segment.added',
        'segment.removed',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============ CONTACT TIMELINE EVENTS TABLE ============
CREATE TABLE IF NOT EXISTS contact_timeline_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    event_type          timeline_event_type NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    data                JSONB,
    channel             VARCHAR(20),
    reference_type      VARCHAR(50),
    reference_id        UUID,
    correlation_id      VARCHAR(100),
    source              VARCHAR(50),
    ip_address          VARCHAR(50),
    user_agent          TEXT,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id            UUID,
    actor_type          VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_contact ON contact_timeline_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_tenant ON contact_timeline_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_lookup ON contact_timeline_events(tenant_id, contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_type ON contact_timeline_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_events_occurred ON contact_timeline_events(occurred_at);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('004', 'contacts')
ON CONFLICT (version) DO NOTHING;
