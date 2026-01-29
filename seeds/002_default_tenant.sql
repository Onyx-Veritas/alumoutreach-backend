-- ============================================================
-- Seed: 002_default_tenant.sql
-- Purpose: Create a default development tenant
-- ============================================================
-- This creates a ready-to-use tenant for local development.
-- In production, tenants are created via API/admin panel.
--
-- This seed assumes:
--   - 001_system_roles.sql seed has run (system roles exist)
--
-- Idempotency: Uses ON CONFLICT DO NOTHING
-- ============================================================

-- Create default development tenant
INSERT INTO tenants (id, name, slug, domain, is_active, settings)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Demo University',
    'demo',
    'demo.alumoutreach.local',
    true,
    '{
        "timezone": "UTC",
        "dateFormat": "YYYY-MM-DD",
        "defaultChannel": "email"
    }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Clone system roles to the demo tenant
-- Viewer
INSERT INTO roles (tenant_id, name, description, is_system)
SELECT 
    '11111111-1111-1111-1111-111111111111',
    name,
    description,
    false  -- Not system role when cloned
FROM roles 
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  AND name = 'viewer'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Operator
INSERT INTO roles (tenant_id, name, description, is_system)
SELECT 
    '11111111-1111-1111-1111-111111111111',
    name,
    description,
    false
FROM roles 
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  AND name = 'operator'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Admin
INSERT INTO roles (tenant_id, name, description, is_system)
SELECT 
    '11111111-1111-1111-1111-111111111111',
    name,
    description,
    false
FROM roles 
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  AND name = 'admin'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Create a default admin user for development
-- Password hash is for 'admin123' (bcrypt)
INSERT INTO users (id, tenant_id, role_id, email, password_hash, full_name, is_active, email_verified)
SELECT
    '11111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111111',
    r.id,
    'admin@demo.alumoutreach.local',
    '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- admin123
    'Demo Admin',
    true,
    true
FROM roles r
WHERE r.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@demo.alumoutreach.local'
  );
