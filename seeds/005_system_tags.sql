-- ============================================================
-- Seed: 005_system_tags.sql
-- Purpose: Create default contact tags
-- ============================================================
-- Tags are used to label and categorize contacts. These are
-- common starting tags that most organizations need.
--
-- This seed assumes:
--   - 002_default_tenant.sql seed has run (demo tenant exists)
--   - 004_contacts.sql migration has run (contact_tags table exists)
--
-- Idempotency: Uses ON CONFLICT DO NOTHING
-- ============================================================

-- Status tags
INSERT INTO contact_tags (id, tenant_id, name, color, description)
VALUES
    ('11111111-1111-1111-1111-111111111301', '11111111-1111-1111-1111-111111111111', 'VIP', '#EF4444', 'High-value or notable contacts'),
    ('11111111-1111-1111-1111-111111111302', '11111111-1111-1111-1111-111111111111', 'Donor', '#10B981', 'Has made donations'),
    ('11111111-1111-1111-1111-111111111303', '11111111-1111-1111-1111-111111111111', 'Volunteer', '#3B82F6', 'Active volunteer'),
    ('11111111-1111-1111-1111-111111111304', '11111111-1111-1111-1111-111111111111', 'Mentor', '#8B5CF6', 'Available for mentoring'),
    ('11111111-1111-1111-1111-111111111305', '11111111-1111-1111-1111-111111111111', 'Board Member', '#F59E0B', 'Board or committee member')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Engagement tags
INSERT INTO contact_tags (id, tenant_id, name, color, description)
VALUES
    ('11111111-1111-1111-1111-111111111311', '11111111-1111-1111-1111-111111111111', 'Highly Engaged', '#22C55E', 'Regularly interacts with communications'),
    ('11111111-1111-1111-1111-111111111312', '11111111-1111-1111-1111-111111111111', 'Needs Outreach', '#F97316', 'Has not engaged recently'),
    ('11111111-1111-1111-1111-111111111313', '11111111-1111-1111-1111-111111111111', 'Event Attendee', '#06B6D4', 'Has attended events')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Source tags
INSERT INTO contact_tags (id, tenant_id, name, color, description)
VALUES
    ('11111111-1111-1111-1111-111111111321', '11111111-1111-1111-1111-111111111111', 'Imported', '#6B7280', 'Imported from external source'),
    ('11111111-1111-1111-1111-111111111322', '11111111-1111-1111-1111-111111111111', 'Self-Registered', '#A855F7', 'Signed up via website'),
    ('11111111-1111-1111-1111-111111111323', '11111111-1111-1111-1111-111111111111', 'LinkedIn', '#0077B5', 'Found via LinkedIn')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Academic tags
INSERT INTO contact_tags (id, tenant_id, name, color, description)
VALUES
    ('11111111-1111-1111-1111-111111111331', '11111111-1111-1111-1111-111111111111', 'Undergraduate', '#64748B', 'Undergraduate degree'),
    ('11111111-1111-1111-1111-111111111332', '11111111-1111-1111-1111-111111111111', 'Postgraduate', '#475569', 'Postgraduate degree'),
    ('11111111-1111-1111-1111-111111111333', '11111111-1111-1111-1111-111111111111', 'PhD', '#334155', 'Doctoral degree')
ON CONFLICT (tenant_id, name) DO NOTHING;
