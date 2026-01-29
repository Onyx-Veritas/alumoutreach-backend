# Seed Data — AlumERP

## What is Seed Data?

Seed data is **pre-configured reference data** that an application needs to function properly. Unlike migrations (which define schema), seeds populate tables with initial values.

## What Seed Data IS

| Category           | Examples                                           |
|--------------------|---------------------------------------------------|
| **System roles**   | viewer, operator, admin                            |
| **Permissions**    | contacts.view, campaigns.launch                    |
| **Default tenant** | Demo/development tenant for local testing          |
| **System segments**| "All Contacts", "Email Subscribers"                |
| **Starter templates** | Welcome email, Newsletter format                |
| **System tags**    | VIP, Donor, Volunteer                              |

## What Seed Data is NOT

| ❌ NOT Seed Data        | Why                                              |
|-------------------------|--------------------------------------------------|
| Contacts                | User/business data — never pre-populated         |
| Campaigns               | User-created content                             |
| Messages                | Runtime data                                     |
| Analytics               | Generated from usage                             |
| Workflow runs           | Runtime state                                    |
| Any "fake" test data    | Seeds are real system data, not test fixtures    |

---

## Seed Files

| File                        | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `001_system_roles.sql`      | System tenant and default roles              |
| `002_default_tenant.sql`    | Demo tenant with cloned roles + admin user   |
| `003_default_segments.sql`  | System segments (All Contacts, etc.)         |
| `004_default_templates.sql` | Starter email/WhatsApp templates             |
| `005_system_tags.sql`       | Default contact tags                         |
| `006_permissions.sql`       | Permission definitions + role mappings       |

---

## Key Principles

### 1. Idempotent

Seeds can be run multiple times safely. Each file uses:

```sql
-- Option 1: ON CONFLICT DO NOTHING
INSERT INTO roles (id, name) VALUES (...)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Option 2: WHERE NOT EXISTS
INSERT INTO templates (...)
SELECT ... WHERE NOT EXISTS (...);
```

### 2. Docker-Only

Seeds run inside a container using the `seeds` service. **No host-based `psql` required.**

```bash
# ❌ WRONG - requires psql on host
psql -f 001_system_roles.sql

# ✅ CORRECT - runs in Docker
docker compose -f docker-compose.dev.yml run --rm seeds
```

### 3. Never Auto-Run

Seeds are **explicitly executed by a developer**. They:
- Do NOT run on container startup
- Do NOT run in app initialization
- Are NOT part of the migration service

### 4. Migrations First

Seeds assume all migrations have been applied. Always run:

```bash
docker compose run --rm migrations  # First
docker compose run --rm seeds       # Second
```

---

## Usage

### Prerequisites

1. Docker and Docker Compose installed
2. Migrations have been applied

### Running Seeds (Development)

```bash
# Start postgres if not running
docker compose -f docker-compose.dev.yml up postgres -d

# Run migrations first (if not done)
docker compose -f docker-compose.dev.yml run --rm migrations

# Run seeds
docker compose -f docker-compose.dev.yml run --rm seeds
```

### Running a Single Seed File

```bash
docker compose -f docker-compose.dev.yml run --rm seeds \
  psql -v ON_ERROR_STOP=1 -f /seeds/001_system_roles.sql
```

### Verify Seeds Applied

```bash
# Check roles
docker exec alumoutreach-postgres psql -U alumoutreach -d alumoutreach \
  -c "SELECT name, description FROM roles WHERE tenant_id = '11111111-1111-1111-1111-111111111111';"

# Check segments
docker exec alumoutreach-postgres psql -U alumoutreach -d alumoutreach \
  -c "SELECT name FROM segments WHERE tenant_id = '11111111-1111-1111-1111-111111111111';"

# Check permissions
docker exec alumoutreach-postgres psql -U alumoutreach -d alumoutreach \
  -c "SELECT code, name FROM permissions ORDER BY category, code;"
```

---

## CI/CD Usage

### Development/Staging

```yaml
# In CI pipeline
- name: Run seeds
  run: docker compose -f docker-compose.dev.yml run --rm seeds
```

### Production

```yaml
# Production seeds should be reviewed and applied manually
# Or use a separate production-safe seed set

# ⚠️ NEVER auto-run seeds in production
```

---

## ⚠️ Production Warning

Seed data is designed for **development and staging** environments.

For production:

| Consideration               | Recommendation                                    |
|-----------------------------|---------------------------------------------------|
| Default tenant              | Create real tenants via admin API                 |
| Admin user password         | Use secure password, not seed default             |
| Permissions                 | Review permission set for production needs        |
| Templates                   | Create production templates via UI                |

If you must seed production, create a separate `seeds-prod/` folder with production-safe data.

---

## Writing New Seeds

### File Naming

```
XXX_description.sql
```

Where `XXX` is the next sequence number (007, 008, etc.)

### Template

```sql
-- ============================================================
-- Seed: XXX_your_seed.sql
-- Purpose: Brief description
-- ============================================================
-- Detailed explanation of what this seed does and why.
--
-- This seed assumes:
--   - List required migrations
--   - List required seeds that run before this
--
-- Idempotency: Explain the idempotency strategy used
-- ============================================================

-- Your INSERT statements here
INSERT INTO table_name (...)
VALUES (...)
ON CONFLICT (...) DO NOTHING;
```

### Checklist

- [ ] File has descriptive header comments
- [ ] Uses `ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS`
- [ ] Does NOT delete or update existing data
- [ ] Uses fixed UUIDs for reproducibility
- [ ] Tests pass: can run twice without error

---

## Troubleshooting

### "relation does not exist"

Migrations haven't run. Execute:

```bash
docker compose run --rm migrations
```

### "duplicate key value"

This is OK — means the data already exists. `ON CONFLICT DO NOTHING` handles this.

### "permission denied"

Check your postgres user has write access:

```bash
docker exec alumoutreach-postgres psql -U alumoutreach -d alumoutreach \
  -c "SELECT current_user, current_database();"
```

---

## Default Login

After running seeds, you can log in with:

| Field    | Value                              |
|----------|------------------------------------|
| Email    | `admin@demo.alumoutreach.local`    |
| Password | `admin123`                         |

⚠️ **Change this password immediately in any non-local environment.**
