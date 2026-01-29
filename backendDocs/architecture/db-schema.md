# Database Schema Architecture

## Overview

AlumOutreach uses a polyglot persistence architecture with multiple specialized databases:

| Database      | Type     | Purpose                              | Port  |
|---------------|----------|--------------------------------------|-------|
| PostgreSQL    | RDBMS    | Primary transactional data           | 5432  |
| Redis         | Key-Value| Caching, rate limiting, sessions     | 6379  |
| ClickHouse    | OLAP     | Analytics and time-series data       | 8123  |
| Elasticsearch | Search   | Full-text search                     | 9200  |
| NATS JetStream| Messaging| Event bus and message queue          | 4222  |

## PostgreSQL Schema

### Database Configuration

```sql
-- Database settings
CREATE DATABASE alumoutreach
  WITH ENCODING = 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8';

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CONTACTS MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │   contacts   │───<│ channel_identifiers│    │ contact_attributes│              │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ tenant_id        │    │ tenant_id        │              │
│  │ email        │    │ contact_id (FK)  │    │ contact_id (FK)  │              │
│  │ phone        │    │ channel          │    │ key              │              │
│  │ first_name   │    │ identifier       │    │ value            │              │
│  │ last_name    │    │ is_primary       │    │ data_type        │              │
│  │ status       │    └──────────────────┘    └──────────────────┘              │
│  │ attributes   │                                                               │
│  └──────┬───────┘    ┌──────────────────┐    ┌──────────────────┐              │
│         │            │ contact_consents │    │contact_timeline_ │              │
│         ├───────────<│                  │    │    events        │              │
│         │            │ id               │    │                  │              │
│         │            │ contact_id (FK)  │    │ id               │              │
│         │            │ channel          │    │ contact_id (FK)  │              │
│         │            │ purpose          │    │ event_type       │              │
│         │            │ granted          │    │ title            │              │
│         │            └──────────────────┘    │ occurred_at      │              │
│         │                                    └──────────────────┘              │
│         │            ┌──────────────────┐                                      │
│         └───────────<│contact_tag_mapping│                                      │
│                      │                  │    ┌──────────────────┐              │
│                      │ id               │    │  contact_tags    │              │
│                      │ contact_id (FK)  │───>│                  │              │
│                      │ tag_id (FK)      │    │ id               │              │
│                      └──────────────────┘    │ tenant_id        │              │
│                                              │ name             │              │
│                                              │ color            │              │
│                                              └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TEMPLATES MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │  templates   │───<│ template_versions│    │whatsapp_hsm_     │              │
│  │              │    │                  │    │   approvals      │              │
│  │ id           │    │ id               │    │                  │              │
│  │ tenant_id    │    │ template_id (FK) │    │ id               │              │
│  │ name         │    │ version          │    │ template_id (FK) │              │
│  │ channel      │    │ subject          │    │ hsm_namespace    │              │
│  │ status       │    │ body             │    │ status           │              │
│  │ current_ver  │    │ body_html        │    │ submitted_at     │              │
│  │ variables    │    │ changelog        │    └──────────────────┘              │
│  └──────────────┘    └──────────────────┘                                      │
│                                                                                  │
│  ┌──────────────────┐                                                           │
│  │template_categories│                                                           │
│  │                  │                                                           │
│  │ id               │                                                           │
│  │ tenant_id        │                                                           │
│  │ name             │                                                           │
│  │ parent_id (FK)   │ (self-referential for hierarchy)                         │
│  └──────────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SEGMENTS MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │   segments   │───<│  segment_rules   │    │ segment_members  │              │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ segment_id (FK)  │    │ segment_id (FK)  │              │
│  │ name         │    │ group_index      │    │ contact_id (FK)  │──────────────┼──> contacts
│  │ type         │    │ field            │    │ added_at         │              │
│  │ rules        │    │ operator         │    │ added_reason     │              │
│  │ member_count │    │ value            │    └──────────────────┘              │
│  └──────────────┘    └──────────────────┘                                      │
│         │                                                                        │
│         └───────────<┌──────────────────┐                                      │
│                      │ segment_history  │                                      │
│                      │                  │                                      │
│                      │ id               │                                      │
│                      │ segment_id (FK)  │                                      │
│                      │ evaluation_date  │                                      │
│                      │ member_count     │                                      │
│                      └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CAMPAIGNS MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │  campaigns   │───<│campaign_recipients│    │ campaign_variants│              │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ campaign_id (FK) │    │ campaign_id (FK) │              │
│  │ name         │    │ contact_id (FK)  │──> │ variant_id       │              │
│  │ channel      │    │ variant_id       │    │ template_id (FK) │──────────────┼──> templates
│  │ template_id  │────┼──────────────────┼──> │ weight           │              │
│  │ segment_ids  │    │ status           │    │ is_winner        │              │
│  │ status       │    │ sent_at          │    └──────────────────┘              │
│  │ scheduled_at │    │ opened_at        │                                      │
│  └──────────────┘    │ message_id (FK)  │────────────────────────────────────> pipeline_messages
│         │            └──────────────────┘                                      │
│         └───────────<┌──────────────────┐                                      │
│                      │ campaign_stats   │                                      │
│                      │                  │                                      │
│                      │ id               │                                      │
│                      │ campaign_id (FK) │                                      │
│                      │ variant_id       │                                      │
│                      │ sent_count       │                                      │
│                      │ opened_count     │                                      │
│                      └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PIPELINE MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐          │
│  │pipeline_messages │───<│pipeline_delivery_│    │pipeline_dead_    │          │
│  │                  │    │      logs        │    │    letter        │          │
│  │ id               │    │                  │    │                  │          │
│  │ tenant_id        │    │ id               │    │ id               │          │
│  │ channel          │    │ message_id (FK)  │    │ original_msg_id  │          │
│  │ status           │    │ event            │    │ payload          │          │
│  │ contact_id (FK)  │──> │ occurred_at      │    │ error_message    │          │
│  │ recipient_address│    │ metadata         │    │ failed_at        │          │
│  │ source_type      │    └──────────────────┘    └──────────────────┘          │
│  │ source_id        │                                                           │
│  │ template_id (FK) │──────────────────────────────────────────────────────────> templates
│  │ body             │                                                           │
│  │ external_id      │                                                           │
│  │ retry_count      │                                                           │
│  └──────────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WORKFLOWS MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │  workflows   │───<│  workflow_runs   │───<│workflow_run_steps│              │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ workflow_id (FK) │    │ run_id (FK)      │              │
│  │ name         │    │ contact_id (FK)  │──> │ node_id          │              │
│  │ trigger      │    │ status           │    │ node_type        │              │
│  │ nodes        │    │ current_node_id  │    │ status           │              │
│  │ edges        │    │ started_at       │    │ scheduled_at     │              │
│  │ goals        │    │ completed_at     │    └──────────────────┘              │
│  │ status       │    └──────────────────┘                                      │
│  └──────────────┘                                                               │
│         │            ┌──────────────────┐    ┌──────────────────┐              │
│         ├───────────<│workflow_versions │    │workflow_schedules│              │
│         │            │                  │    │                  │              │
│         │            │ id               │    │ id               │              │
│         │            │ workflow_id (FK) │    │ workflow_id (FK) │              │
│         │            │ version          │    │ run_id (FK)      │              │
│         │            │ nodes            │    │ scheduled_at     │              │
│         │            │ edges            │    │ processed_at     │              │
│         │            └──────────────────┘    └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SEQUENCES MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │  sequences   │───<│ sequence_steps   │    │sequence_enrollments│             │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ sequence_id (FK) │    │ sequence_id (FK) │              │
│  │ name         │    │ step_number      │    │ contact_id (FK)  │──────────────┼──> contacts
│  │ channel      │    │ type             │    │ status           │              │
│  │ settings     │    │ template_id (FK) │──> │ current_step_num │              │
│  │ status       │    │ delay_days       │    │ assigned_to      │              │
│  └──────────────┘    └──────────────────┘    └──────────────────┘              │
│                                                     │                           │
│                      ┌──────────────────────────────┘                           │
│                      │                                                          │
│                      ▼                                                          │
│  ┌──────────────────────────┐    ┌──────────────────┐                          │
│  │sequence_step_executions  │    │sequence_schedules│                          │
│  │                          │    │                  │                          │
│  │ id                       │    │ id               │                          │
│  │ enrollment_id (FK)       │    │ enrollment_id(FK)│                          │
│  │ step_id (FK)             │    │ step_id (FK)     │                          │
│  │ status                   │    │ scheduled_at     │                          │
│  │ message_id (FK)          │──> │ processed_at     │                          │
│  │ opened_at                │    └──────────────────┘                          │
│  │ replied_at               │                                                   │
│  └──────────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                INBOX MODULE                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │inbox_threads │───<│ inbox_messages   │    │inbox_assignments │              │
│  │              │    │                  │    │                  │              │
│  │ id           │    │ id               │    │ id               │              │
│  │ tenant_id    │    │ thread_id (FK)   │    │ thread_id (FK)   │              │
│  │ contact_id   │──> │ direction        │    │ user_id          │              │
│  │ channel      │    │ channel          │    │ assigned_by      │              │
│  │ status       │    │ body             │    │ assigned_at      │              │
│  │ priority     │    │ attachments      │    └──────────────────┘              │
│  │ assigned_to  │    │ external_id      │                                      │
│  │ sla_deadline │    │ sent_by          │                                      │
│  └──────────────┘    └──────────────────┘                                      │
│                                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                                   │
│  │inbox_canned_     │    │ inbox_sla_       │                                   │
│  │   responses      │    │   policies       │                                   │
│  │                  │    │                  │                                   │
│  │ id               │    │ id               │                                   │
│  │ tenant_id        │    │ tenant_id        │                                   │
│  │ shortcut         │    │ priority         │                                   │
│  │ content          │    │ first_response   │                                   │
│  └──────────────────┘    │ resolution       │                                   │
│                          └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy

All tables include a `tenant_id` column for data isolation:

```sql
-- Every table has tenant_id
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(100) NOT NULL,
    -- ...other columns
);

-- Composite indexes include tenant_id first
CREATE INDEX idx_contacts_tenant_email ON contacts (tenant_id, email);

-- Row-level security (optional)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contacts
    USING (tenant_id = current_setting('app.tenant_id'));
```

## Soft Deletes

All entities use soft delete with `deleted_at` timestamp:

```sql
CREATE TABLE contacts (
    -- ...
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Queries exclude soft-deleted records
SELECT * FROM contacts WHERE deleted_at IS NULL;
```

## ClickHouse Schema

### Analytics Events Table

```sql
CREATE TABLE analytics_events (
    id UUID,
    tenant_id String,
    event_type LowCardinality(String),
    entity_type LowCardinality(String),
    entity_id String,
    channel LowCardinality(String),
    contact_id Nullable(String),
    user_id Nullable(String),
    source_type LowCardinality(String),
    source_id Nullable(String),
    campaign_id Nullable(String),
    workflow_id Nullable(String),
    sequence_id Nullable(String),
    template_id Nullable(String),
    metadata String,
    occurred_at DateTime64(3),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, event_type, occurred_at, id)
TTL occurred_at + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;
```

### Materialized Views

```sql
-- Daily message summary
CREATE MATERIALIZED VIEW mv_daily_message_summary
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, channel, event_type)
AS SELECT
    tenant_id,
    toDate(occurred_at) as date,
    channel,
    event_type,
    count() as count
FROM analytics_events
WHERE entity_type = 'message'
GROUP BY tenant_id, date, channel, event_type;
```

## Elasticsearch Schema

### Contacts Index

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "email_analyzer": {
          "type": "custom",
          "tokenizer": "uax_url_email",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "tenant_id": {"type": "keyword"},
      "id": {"type": "keyword"},
      "first_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
      "last_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
      "display_name": {"type": "text"},
      "email": {"type": "text", "analyzer": "email_analyzer", "fields": {"keyword": {"type": "keyword"}}},
      "phone": {"type": "keyword"},
      "status": {"type": "keyword"},
      "tags": {"type": "keyword"},
      "attributes": {"type": "object", "dynamic": true},
      "created_at": {"type": "date"},
      "updated_at": {"type": "date"}
    }
  }
}
```

## Redis Data Structures

### Rate Limiting

```
Key: rate:{tenant_id}:{channel}:{window}
Type: String (counter)
TTL: Window duration (1s, 1m, 1h)
Value: Current count
```

### Session Cache

```
Key: session:{session_id}
Type: Hash
TTL: 24 hours
Fields: user_id, tenant_id, permissions, created_at
```

### Distributed Locks

```
Key: lock:{resource_type}:{resource_id}
Type: String
TTL: Lock duration + buffer
Value: Lock owner ID
```

### Workflow State Cache

```
Key: workflow:run:{run_id}
Type: Hash
TTL: 7 days
Fields: workflow_id, contact_id, current_node, status, context
```

## Migration Strategy

### TypeORM Migrations

```typescript
// migrations/1706300000000-CreateContactsTable.ts
export class CreateContactsTable1706300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active',
        attributes JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
      
      CREATE INDEX idx_contacts_tenant_email ON contacts (tenant_id, email);
      CREATE INDEX idx_contacts_tenant_phone ON contacts (tenant_id, phone);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE contacts;`);
  }
}
```

### Running Migrations

```bash
# Generate migration from entity changes
npm run typeorm migration:generate -- -n MigrationName

# Run pending migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert
```

## Backup Strategy

### PostgreSQL

```bash
# Daily full backup
pg_dump -Fc alumoutreach > backup_$(date +%Y%m%d).dump

# Point-in-time recovery with WAL archiving
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

### ClickHouse

```bash
# Backup using clickhouse-backup
clickhouse-backup create daily_backup
clickhouse-backup upload daily_backup

# Or using native backup
BACKUP TABLE analytics_events TO Disk('backups', 'analytics_backup');
```

### Redis

```bash
# RDB snapshot
redis-cli BGSAVE

# AOF for durability
appendonly yes
appendfsync everysec
```
