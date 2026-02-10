# AlumOutreach Backend - AI Agent Guidelines

## Architecture

**NestJS monorepo** for multi-channel alumni outreach (email, SMS, WhatsApp). Polyglot persistence with PostgreSQL (primary), Redis (cache/locks), NATS JetStream (events), Elasticsearch (search), ClickHouse (analytics).

### Infrastructure Ports
| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary data store |
| Redis | 6379 | Cache, rate limiting, BullMQ |
| NATS | 4222 | Event bus (JetStream) |
| Elasticsearch | 9200 | Contact full-text search |
| ClickHouse | 8123 | Analytics OLAP |

### Module Flow
```
Contacts → Segments → Campaigns → Pipeline → Inbox → Analytics
                 ↘    Templates ↗     ↑
            Workflows → Sequences ────┘
```

## Module Structure Pattern

Every module at `services/api-gateway/src/modules/{domain}/` follows:
```
├── {domain}.controller.ts    # REST + Swagger (@ApiTags, @ApiOperation)
├── {domain}.module.ts        # NestJS module with exports
├── services/                 # Business logic
├── repositories/             # TypeORM queries (ALWAYS filter by tenantId)
├── entities/                 # TypeORM entities with snake_case columns
├── dto/                      # class-validator + @ApiProperty()
├── mappers/                  # Entity ↔ DTO transformations
```

## Critical Conventions

### Multi-Tenancy (MANDATORY)
Every query MUST include `tenantId`. Extract via decorator:
```typescript
@Get()
async findAll(@TenantId() tenantId: string) {
  return this.repository.find({ where: { tenantId, isDeleted: false } });
}
```

### API Response Format
All endpoints return: `{ success: boolean, data: T, meta?: PaginationMeta, error?: ErrorDetails }`

### Entity Conventions
```typescript
@Entity('contacts')
@Index(['tenantId', 'status'])
export class Contact {
  @Column({ name: 'tenant_id' })  // snake_case DB columns
  tenantId: string;
  
  @Column({ name: 'is_deleted', default: false })  // Soft delete, never hard delete
  isDeleted: boolean;
}
```

### Event Bus (NATS JetStream)
Cross-module communication via events defined in `libs/common/src/constants/events.ts`:
```typescript
// Subject pattern: {domain}.{action} or {domain}.{entity}.{action}
await this.eventBus.publish('contact.created', { tenantId, contactId, ... });
```
Key events: `contact.created`, `segment.member.added`, `campaign.started`, `pipeline.message.sent`

### Logging
Use `AppLoggerService` with structured context (tenantId, correlationId):
```typescript
this.logger.setContext('ContactsService');
this.logger.info('Contact created', { tenantId, contactId, correlationId });
```

## Development Commands

```bash
# Start all infrastructure
docker-compose up -d

# Run migrations (Docker-based, no local psql needed)
docker compose -f docker-compose.dev.yml run --rm migrations

# Start dev server
npm run start:dev        # Hot reload on :3000
npm run start:debug      # With debugger

# Verify
curl http://localhost:3000/health
open http://localhost:3000/api/docs   # Swagger UI
```

### Required Headers for API Calls
```
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_uuid>
X-Correlation-ID: <optional_trace_id>
```

## Key Files

| Purpose | Path |
|---------|------|
| App bootstrap | `services/api-gateway/src/app.module.ts` |
| Event constants | `libs/common/src/constants/events.ts` |
| Decorators | `services/api-gateway/src/common/decorators/` (@TenantId, @CurrentUser, @CorrelationId) |
| Event bus | `services/api-gateway/src/common/services/event-bus.service.ts` |
| Migrations | `migrations/` (append-only numbered SQL files) |
| Module docs | `backendDocs/modules/*.md` |

## Test Data Generation

Use `/dev/*` endpoints (dev environment only):
```bash
POST /dev/contacts/generate   { "count": 50 }
POST /dev/seed/preset         { "preset": "full" }
```

## Common Pitfalls

1. **Missing tenantId** - Every DB query must filter by tenant
2. **Direct TypeORM injection** - Use repository pattern, not `@InjectRepository` in services
3. **Sync expectations** - Events are async; don't expect immediate cross-module consistency
4. **Editing migrations** - Migrations are append-only; create new files for changes
5. **Hard deletes** - Use `isDeleted` flag for soft deletes
