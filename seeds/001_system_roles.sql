-- ============================================================
-- Seed: 001_system_roles.sql
-- Purpose: Create default system roles
-- ============================================================
-- Roles are tenant-scoped, but we create system-level defaults
-- that can be cloned to new tenants.
--
-- This seed assumes:
--   - 002_tenants.sql migration has run (tenants table exists)
--   - 003_auth.sql migration has run (roles table exists)
--
-- Idempotency: Uses ON CONFLICT DO NOTHING
-- ============================================================

-- First, ensure we have a system tenant for system-level resources
-- This is a special tenant that holds system defaults
INSERT INTO tenants (id, name, slug, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'System',
    'system',
    true
)
ON CONFLICT (slug) DO NOTHING;

-- Create system roles under the system tenant
-- These serve as templates for new tenants

-- Viewer role: Read-only access
INSERT INTO roles (id, tenant_id, name, description, is_system)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'viewer',
    'Read-only access to all data. Cannot create, edit, or delete.',
    true
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Operator role: Read + write access
INSERT INTO roles (id, tenant_id, name, description, is_system)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'operator',
    'Can create and edit contacts, segments, campaigns. Cannot launch campaigns or delete.',
    true
)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Admin role: Full access
INSERT INTO roles (id, tenant_id, name, description, is_system)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'admin',
    'Full access including launching campaigns, deleting data, and managing users.',
    true
)
ON CONFLICT (tenant_id, name) DO NOTHING;
