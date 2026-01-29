-- ============================================================
-- Seed: 006_permissions.sql
-- Purpose: Create system permissions and role mappings
-- ============================================================
-- Permissions define what actions users can perform.
-- Role-permission mappings control what each role can do.
--
-- This seed assumes:
--   - 001_system_roles.sql seed has run (system roles exist)
--   - 003_auth.sql migration has run (permissions table exists)
--
-- Idempotency: Uses ON CONFLICT DO NOTHING
-- ============================================================

-- ========== PERMISSIONS ==========

-- Contact permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000001', 'contacts.view', 'View Contacts', 'View contact list and details', 'contacts'),
    ('00000000-0000-0000-0001-000000000002', 'contacts.create', 'Create Contacts', 'Create new contacts', 'contacts'),
    ('00000000-0000-0000-0001-000000000003', 'contacts.edit', 'Edit Contacts', 'Edit existing contacts', 'contacts'),
    ('00000000-0000-0000-0001-000000000004', 'contacts.delete', 'Delete Contacts', 'Delete contacts', 'contacts'),
    ('00000000-0000-0000-0001-000000000005', 'contacts.import', 'Import Contacts', 'Bulk import contacts', 'contacts'),
    ('00000000-0000-0000-0001-000000000006', 'contacts.export', 'Export Contacts', 'Export contacts to file', 'contacts')
ON CONFLICT (code) DO NOTHING;

-- Segment permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000011', 'segments.view', 'View Segments', 'View segment list and details', 'segments'),
    ('00000000-0000-0000-0001-000000000012', 'segments.create', 'Create Segments', 'Create new segments', 'segments'),
    ('00000000-0000-0000-0001-000000000013', 'segments.edit', 'Edit Segments', 'Edit existing segments', 'segments'),
    ('00000000-0000-0000-0001-000000000014', 'segments.delete', 'Delete Segments', 'Delete segments', 'segments')
ON CONFLICT (code) DO NOTHING;

-- Campaign permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000021', 'campaigns.view', 'View Campaigns', 'View campaign list and details', 'campaigns'),
    ('00000000-0000-0000-0001-000000000022', 'campaigns.create', 'Create Campaigns', 'Create new campaigns', 'campaigns'),
    ('00000000-0000-0000-0001-000000000023', 'campaigns.edit', 'Edit Campaigns', 'Edit existing campaigns', 'campaigns'),
    ('00000000-0000-0000-0001-000000000024', 'campaigns.delete', 'Delete Campaigns', 'Delete campaigns', 'campaigns'),
    ('00000000-0000-0000-0001-000000000025', 'campaigns.launch', 'Launch Campaigns', 'Launch/send campaigns', 'campaigns')
ON CONFLICT (code) DO NOTHING;

-- Template permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000031', 'templates.view', 'View Templates', 'View template list and details', 'templates'),
    ('00000000-0000-0000-0001-000000000032', 'templates.create', 'Create Templates', 'Create new templates', 'templates'),
    ('00000000-0000-0000-0001-000000000033', 'templates.edit', 'Edit Templates', 'Edit existing templates', 'templates'),
    ('00000000-0000-0000-0001-000000000034', 'templates.delete', 'Delete Templates', 'Delete templates', 'templates')
ON CONFLICT (code) DO NOTHING;

-- Inbox permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000041', 'inbox.view', 'View Inbox', 'View inbox messages', 'inbox'),
    ('00000000-0000-0000-0001-000000000042', 'inbox.reply', 'Reply to Messages', 'Send replies in inbox', 'inbox'),
    ('00000000-0000-0000-0001-000000000043', 'inbox.assign', 'Assign Threads', 'Assign threads to users', 'inbox')
ON CONFLICT (code) DO NOTHING;

-- Workflow permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000051', 'workflows.view', 'View Workflows', 'View workflow list and details', 'workflows'),
    ('00000000-0000-0000-0001-000000000052', 'workflows.create', 'Create Workflows', 'Create new workflows', 'workflows'),
    ('00000000-0000-0000-0001-000000000053', 'workflows.edit', 'Edit Workflows', 'Edit existing workflows', 'workflows'),
    ('00000000-0000-0000-0001-000000000054', 'workflows.delete', 'Delete Workflows', 'Delete workflows', 'workflows'),
    ('00000000-0000-0000-0001-000000000055', 'workflows.publish', 'Publish Workflows', 'Publish/activate workflows', 'workflows')
ON CONFLICT (code) DO NOTHING;

-- Analytics permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000061', 'analytics.view', 'View Analytics', 'View analytics dashboards', 'analytics'),
    ('00000000-0000-0000-0001-000000000062', 'analytics.export', 'Export Analytics', 'Export analytics data', 'analytics')
ON CONFLICT (code) DO NOTHING;

-- User management permissions
INSERT INTO permissions (id, code, name, description, category)
VALUES
    ('00000000-0000-0000-0001-000000000071', 'users.view', 'View Users', 'View user list', 'users'),
    ('00000000-0000-0000-0001-000000000072', 'users.create', 'Create Users', 'Create new users', 'users'),
    ('00000000-0000-0000-0001-000000000073', 'users.edit', 'Edit Users', 'Edit existing users', 'users'),
    ('00000000-0000-0000-0001-000000000074', 'users.delete', 'Delete Users', 'Delete users', 'users')
ON CONFLICT (code) DO NOTHING;

-- ========== ROLE-PERMISSION MAPPINGS ==========

-- Get role IDs for the demo tenant
-- Viewer: view-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND r.name = 'viewer'
  AND p.code IN (
    'contacts.view',
    'segments.view',
    'campaigns.view',
    'templates.view',
    'inbox.view',
    'workflows.view',
    'analytics.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operator: view + create/edit permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND r.name = 'operator'
  AND p.code IN (
    'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.import',
    'segments.view', 'segments.create', 'segments.edit',
    'campaigns.view', 'campaigns.create', 'campaigns.edit',
    'templates.view', 'templates.create', 'templates.edit',
    'inbox.view', 'inbox.reply',
    'workflows.view',
    'analytics.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
