-- ============================================================
-- Seed: 001a_system_user.sql
-- Purpose: Create the system user for unauthenticated operations
-- ============================================================
-- This creates a system user with a well-known UUID that is used
-- for audit columns (created_by, updated_by) when:
--   - API calls are made without authentication
--   - Background jobs create or update records
--   - Seed data is inserted
--   - System-generated records are created
--
-- The UUID is: 00000000-0000-0000-0000-000000000001
-- This matches the SYSTEM_USER_ID constant in the codebase.
--
-- This seed assumes:
--   - 001_system_roles.sql has run (system tenant exists)
--   - 003_auth.sql migration has run (users table exists)
--
-- Idempotency: Uses ON CONFLICT DO UPDATE (no-op update)
-- ============================================================

-- Create the system user under the system tenant
-- This single user is referenced by all audit columns across all tenants
INSERT INTO users (
    id,
    tenant_id,
    email,
    full_name,
    is_active,
    email_verified
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'system@alumerp.internal',
    'System',
    true,
    true
)
ON CONFLICT (id) DO NOTHING;
