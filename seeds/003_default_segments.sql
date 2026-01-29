-- ============================================================
-- Seed: 003_default_segments.sql
-- Purpose: Create system segments for the demo tenant
-- ============================================================
-- System segments are predefined audience groups that are
-- commonly needed. They use dynamic rules evaluated at runtime.
--
-- This seed assumes:
--   - 002_default_tenant.sql seed has run (demo tenant exists)
--   - 005_segments.sql migration has run (segments table exists)
--
-- Idempotency: Uses ON CONFLICT DO NOTHING
-- ============================================================

-- "All Contacts" segment - matches everyone
INSERT INTO segments (id, tenant_id, name, description, type, status, rules)
VALUES (
    '11111111-1111-1111-1111-111111111101',
    '11111111-1111-1111-1111-111111111111',
    'All Contacts',
    'All contacts in the system. System segment, do not delete.',
    'dynamic',
    'active',
    '{
        "logic": "AND",
        "rules": [
            {"field": "status", "operator": "not_equals", "value": "archived"}
        ]
    }'::jsonb
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- "Active Contacts" segment - only active status
INSERT INTO segments (id, tenant_id, name, description, type, status, rules)
VALUES (
    '11111111-1111-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111111',
    'Active Contacts',
    'Contacts with active status only.',
    'dynamic',
    'active',
    '{
        "logic": "AND",
        "rules": [
            {"field": "status", "operator": "equals", "value": "active"}
        ]
    }'::jsonb
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- "Email Subscribers" segment - contacts with email and not unsubscribed
INSERT INTO segments (id, tenant_id, name, description, type, status, rules)
VALUES (
    '11111111-1111-1111-1111-111111111103',
    '11111111-1111-1111-1111-111111111111',
    'Email Subscribers',
    'Contacts with email who have not unsubscribed.',
    'dynamic',
    'active',
    '{
        "logic": "AND",
        "rules": [
            {"field": "email", "operator": "is_not_null", "value": null},
            {"field": "status", "operator": "not_equals", "value": "unsubscribed"}
        ]
    }'::jsonb
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- "WhatsApp Enabled" segment - contacts with WhatsApp number
INSERT INTO segments (id, tenant_id, name, description, type, status, rules)
VALUES (
    '11111111-1111-1111-1111-111111111104',
    '11111111-1111-1111-1111-111111111111',
    'WhatsApp Enabled',
    'Contacts with a WhatsApp number.',
    'dynamic',
    'active',
    '{
        "logic": "AND",
        "rules": [
            {"field": "whatsapp", "operator": "is_not_null", "value": null},
            {"field": "status", "operator": "equals", "value": "active"}
        ]
    }'::jsonb
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- "Recent Alumni" segment - graduated in last 5 years
INSERT INTO segments (id, tenant_id, name, description, type, status, rules)
VALUES (
    '11111111-1111-1111-1111-111111111105',
    '11111111-1111-1111-1111-111111111111',
    'Recent Alumni (5 years)',
    'Alumni who graduated within the last 5 years.',
    'dynamic',
    'active',
    '{
        "logic": "AND",
        "rules": [
            {"field": "graduation_year", "operator": "gte", "value": 2021},
            {"field": "status", "operator": "equals", "value": "active"}
        ]
    }'::jsonb
)
ON CONFLICT (tenant_id, name) DO NOTHING;
