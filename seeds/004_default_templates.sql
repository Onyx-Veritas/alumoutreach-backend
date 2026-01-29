-- ============================================================
-- Seed: 004_default_templates.sql
-- Purpose: Create starter message templates
-- ============================================================
-- Templates are reusable message formats with variable
-- placeholders. These are starter templates to help users
-- get started quickly.
--
-- This seed assumes:
--   - 002_default_tenant.sql seed has run (demo tenant exists)
--   - 006_templates.sql migration has run (templates table exists)
--
-- Idempotency: Uses WHERE NOT EXISTS checks
-- ============================================================

-- ========== EMAIL TEMPLATES ==========

-- Welcome Email template
INSERT INTO templates (id, tenant_id, name, description, channel, category, status, approval_status, is_approved)
SELECT
    '11111111-1111-1111-1111-111111111201',
    '11111111-1111-1111-1111-111111111111',
    'Welcome Email',
    'Standard welcome email for new contacts.',
    'email',
    'lifecycle',
    'active',
    'approved',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM templates 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND name = 'Welcome Email' 
      AND channel = 'email'
);

-- Welcome Email - Version 1
INSERT INTO template_versions (id, tenant_id, template_id, version_number, channel, content, variables, is_current, is_valid)
SELECT
    '11111111-1111-1111-1111-111111111211',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111201',
    1,
    'email',
    '{
        "subject": "Welcome to {{organization_name}}, {{first_name}}!",
        "htmlBody": "<html><body><h1>Welcome, {{first_name}}!</h1><p>Welcome to our alumni community! We''re excited to have you.</p><p>Best regards,<br>The {{organization_name}} Team</p></body></html>",
        "textBody": "Hi {{first_name}},\n\nWelcome to our alumni community! We''re excited to have you.\n\nBest regards,\nThe {{organization_name}} Team"
    }'::jsonb,
    '{"first_name", "organization_name"}'::text[],
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM template_versions 
    WHERE template_id = '11111111-1111-1111-1111-111111111201' 
      AND version_number = 1
);

-- Update current version
UPDATE templates 
SET current_version_id = '11111111-1111-1111-1111-111111111211',
    current_version_number = 1
WHERE id = '11111111-1111-1111-1111-111111111201'
  AND current_version_id IS NULL;

-- Newsletter template
INSERT INTO templates (id, tenant_id, name, description, channel, category, status, approval_status, is_approved)
SELECT
    '11111111-1111-1111-1111-111111111202',
    '11111111-1111-1111-1111-111111111111',
    'Monthly Newsletter',
    'Standard monthly newsletter format.',
    'email',
    'marketing',
    'active',
    'approved',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM templates 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND name = 'Monthly Newsletter' 
      AND channel = 'email'
);

-- Newsletter - Version 1
INSERT INTO template_versions (id, tenant_id, template_id, version_number, channel, content, variables, is_current, is_valid)
SELECT
    '11111111-1111-1111-1111-111111111221',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111202',
    1,
    'email',
    '{
        "subject": "{{organization_name}} Newsletter - {{month}} {{year}}",
        "htmlBody": "<html><body><h1>{{organization_name}} Newsletter</h1><h2>{{month}} {{year}}</h2><p>Hi {{first_name}},</p><p>Here''s what''s new this month:</p><div>{{newsletter_content}}</div><p>Stay connected!<br>{{organization_name}}</p></body></html>",
        "textBody": "Hi {{first_name}},\n\nHere''s what''s new this month:\n\n{{newsletter_content}}\n\nStay connected!\n{{organization_name}}"
    }'::jsonb,
    '{"first_name", "organization_name", "month", "year", "newsletter_content"}'::text[],
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM template_versions 
    WHERE template_id = '11111111-1111-1111-1111-111111111202' 
      AND version_number = 1
);

UPDATE templates 
SET current_version_id = '11111111-1111-1111-1111-111111111221',
    current_version_number = 1
WHERE id = '11111111-1111-1111-1111-111111111202'
  AND current_version_id IS NULL;

-- ========== WHATSAPP TEMPLATES ==========

-- WhatsApp Welcome
INSERT INTO templates (id, tenant_id, name, description, channel, category, status, approval_status, is_approved)
SELECT
    '11111111-1111-1111-1111-111111111203',
    '11111111-1111-1111-1111-111111111111',
    'WhatsApp Welcome',
    'Welcome message for WhatsApp.',
    'whatsapp',
    'lifecycle',
    'active',
    'approved',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM templates 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND name = 'WhatsApp Welcome' 
      AND channel = 'whatsapp'
);

-- WhatsApp Welcome - Version 1
INSERT INTO template_versions (id, tenant_id, template_id, version_number, channel, content, variables, is_current, is_valid)
SELECT
    '11111111-1111-1111-1111-111111111231',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111203',
    1,
    'whatsapp',
    '{
        "templateName": "welcome_message",
        "language": "en",
        "body": "Hi {{first_name}}! 👋\n\nWelcome to {{organization_name}}. We''re glad to connect with you on WhatsApp.\n\nReply HELP for assistance or STOP to unsubscribe."
    }'::jsonb,
    '{"first_name", "organization_name"}'::text[],
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM template_versions 
    WHERE template_id = '11111111-1111-1111-1111-111111111203' 
      AND version_number = 1
);

UPDATE templates 
SET current_version_id = '11111111-1111-1111-1111-111111111231',
    current_version_number = 1
WHERE id = '11111111-1111-1111-1111-111111111203'
  AND current_version_id IS NULL;
