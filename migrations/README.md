# Database Migrations

## Overview

This directory contains all database migrations for AlumERP. Migrations are:
- Append-only (never edit a deployed migration)
- Idempotent (safe to run multiple times)
- Versioned (ordered by numeric prefix)
- **Run inside Docker only** (no host `psql` required)

## Running Migrations

### Prerequisites

```bash
# Ensure PostgreSQL is running
docker compose -f docker-compose.dev.yml up postgres -d
```

### Run All Migrations (Recommended)

```bash
docker compose -f docker-compose.dev.yml run --rm migrations
```

This will:
1. Wait for PostgreSQL to be healthy
2. Run all `.sql` files in order (001, 002, ...)
3. Stop on first error (`ON_ERROR_STOP=1`)
4. Exit with non-zero code if any migration fails

### Why Docker-Only?

| Concern | Solution |
|---------|----------|
| No `psql` on host | Runs inside `postgres:15-alpine` container |
| Consistent environment | Same image in dev, CI, and prod |
| No shell script dependencies | Inline entrypoint in compose |
| Deterministic ordering | Filename sort in `/bin/sh` |
| Fail-fast | `set -e` + `ON_ERROR_STOP=1` |

### CI/CD Usage

```yaml
# Example GitHub Actions
- name: Run migrations
  run: docker compose -f docker-compose.dev.yml run --rm migrations
```

### Production Usage

Same pattern applies:
```bash
docker compose -f docker-compose.prod.yml run --rm migrations
```

## Structure

```
backend/migrations/
├── 001_init.sql          # Extensions, tracking table, helpers
├── 002_tenants.sql       # Multi-tenant foundation
├── 003_auth.sql          # Users, roles, permissions
├── 004_contacts.sql      # Contact management
├── 005_segments.sql      # Audience segmentation
├── 006_templates.sql     # Message templates
├── 007_campaigns.sql     # Campaign management
├── 008_inbox.sql         # Unified inbox
├── 009_workflows.sql     # Automation workflows
├── 010_sequences.sql     # Drip sequences
├── 011_pipeline.sql      # Background jobs
└── README.md             # This file
```

## Migration Tracking

All migrations are tracked in `schema_migrations`:

```sql
SELECT version, name, executed_at FROM schema_migrations ORDER BY version;
```

To check status from Docker:

```bash
docker exec alumoutreach-postgres psql -U alumoutreach -d alumoutreach \
  -c "SELECT version, name, executed_at FROM schema_migrations ORDER BY version;"
```

## Writing New Migrations

### Naming Convention

```
{NNN}_{name}.sql
```

- `NNN`: Zero-padded 3-digit version number
- `name`: Snake_case description

Examples:
- `012_add_analytics_tables.sql`
- `013_add_contact_notes.sql`

### Template

```sql
-- ============================================================
-- Migration: 012_feature_name.sql
-- Purpose: Brief description
-- ============================================================

-- Your DDL here

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('012', 'feature_name')
ON CONFLICT (version) DO NOTHING;
```

### Rules

1. **Idempotent**: Use `IF NOT EXISTS`, `DO $$ ... EXCEPTION ... END $$`
2. **No data**: DDL only, no seed data
3. **No destructive changes**: No `DROP TABLE`, no column removal
4. **Explicit**: All FKs, indexes, constraints named explicitly
5. **Test locally**: Verify on fresh database before deploying

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `contact_status` | active, inactive, bounced, unsubscribed, archived |
| `channel_type` | email, sms, whatsapp, push |
| `segment_type` | static, dynamic, event_driven |
| `campaign_status` | draft, scheduled, running, completed, cancelled, failed |
| `dispatch_status` | pending, sent, delivered, failed, bounced, opened, clicked |
| `thread_status` | open, closed, pending, snoozed |
| `message_direction` | inbound, outbound |
| `workflow_status` | draft, active, paused, archived |
| `job_status` | pending, processing, completed, failed, retrying |

### Table Dependencies

```
tenants
├── users ─── roles ─── permissions
├── contacts
│   ├── contact_tags
│   ├── channel_identifiers
│   ├── contact_attributes
│   ├── contact_consents
│   └── contact_timeline_events
├── segments
│   └── segment_members
├── templates
│   └── template_versions
├── campaigns
│   ├── campaign_runs
│   └── campaign_messages
├── inbox_threads
│   ├── inbox_messages
│   └── inbox_activities
├── workflows
│   ├── workflow_runs
│   └── workflow_node_runs
├── sequences
│   ├── sequence_steps
│   └── sequence_runs
└── pipeline_jobs
    └── pipeline_failures
```

## Common Operations

### Add New Column

```sql
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
```

### Add New Index

```sql
CREATE INDEX IF NOT EXISTS idx_contacts_new_field 
ON contacts(tenant_id, new_field);
```

### Add New Enum Value

```sql
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'new_status';
```

### Create New Table

Follow existing patterns. Always include:
- `tenant_id` FK
- `created_at`, `updated_at`
- Proper indexes
- Trigger for `updated_at`
