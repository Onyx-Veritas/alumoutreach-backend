# AlumOutreach API Gateway Documentation

> Enterprise-grade multi-channel outreach platform for alumni engagement, marketing automation, and conversational messaging.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AlumOutreach Platform                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway (NestJS)                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │   │
│  │  │Contacts │ │Templates│ │Segments │ │Campaigns│ │Message Pipeline │ │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘ │   │
│  │       │           │           │           │                │          │   │
│  │  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────────┴────────┐ │   │
│  │  │Workflows│ │Sequences│ │  Inbox  │ │Analytics│ │     Health      │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│  ┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐   │
│  │   PostgreSQL 15     │ │   NATS JetStream│ │      ClickHouse         │   │
│  │   (Primary Store)   │ │   (Event Bus)   │ │   (Analytics OLAP)      │   │
│  └─────────────────────┘ └─────────────────┘ └─────────────────────────┘   │
│                    │                                                         │
│                    ▼                                                         │
│  ┌─────────────────────┐ ┌─────────────────┐                                │
│  │   Elasticsearch 8   │ │    Redis 7      │                                │
│  │   (Contact Search)  │ │   (Cache/Lock)  │                                │
│  └─────────────────────┘ └─────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
                              ┌─────────────┐
                              │   Health    │
                              └─────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌─────────────┐             ┌─────────────┐              ┌─────────────┐
│  Contacts   │◄────────────│  Segments   │              │  Templates  │
└──────┬──────┘             └──────┬──────┘              └──────┬──────┘
       │                           │                            │
       │         ┌─────────────────┴────────────────┐           │
       │         ▼                                  ▼           │
       │  ┌─────────────┐                  ┌─────────────┐      │
       │  │  Campaigns  │◄─────────────────│  Workflows  │      │
       │  └──────┬──────┘                  └──────┬──────┘      │
       │         │                                │             │
       │         │         ┌─────────────┐        │             │
       │         │         │  Sequences  │◄───────┘             │
       │         │         └──────┬──────┘                      │
       │         │                │                             │
       │         ▼                ▼                             │
       │  ┌─────────────────────────────────────────────────┐   │
       └─►│              Message Pipeline                   │◄──┘
          └─────────────────────┬───────────────────────────┘
                                │
                                ▼
                       ┌─────────────┐
                       │    Inbox    │
                       └──────┬──────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  Analytics  │
                       └─────────────┘
```

## Event Bus Flow

```
┌─────────────┐     contact.created      ┌─────────────┐
│  Contacts   │─────────────────────────►│  Segments   │
└─────────────┘                          └─────────────┘
       │                                        │
       │ contact.updated                        │ segment.member.added
       ▼                                        ▼
┌─────────────┐     campaign.scheduled   ┌─────────────┐
│  Workflows  │◄─────────────────────────│  Campaigns  │
└─────────────┘                          └─────────────┘
       │                                        │
       │ workflow.node.executed                 │ campaign.message.queued
       ▼                                        ▼
┌─────────────┐     sequence.step.due    ┌─────────────┐
│  Sequences  │─────────────────────────►│  Pipeline   │
└─────────────┘                          └─────────────┘
                                                │
                                                │ pipeline.job.completed
                                                ▼
                                         ┌─────────────┐
                                         │    Inbox    │
                                         └─────────────┘
                                                │
                                                │ inbox.message.sent
                                                ▼
                                         ┌─────────────┐
                                         │  Analytics  │
                                         └─────────────┘
```

## Database Topology

| Database       | Purpose                         | Port  |
|----------------|--------------------------------|-------|
| PostgreSQL 15  | Primary relational store       | 5432  |
| Redis 7        | Caching, distributed locks     | 6379  |
| NATS JetStream | Event streaming, pub/sub       | 4222  |
| ClickHouse     | Analytics OLAP                 | 8123  |
| Elasticsearch  | Contact full-text search       | 9200  |

## Folder Structure

```
backend/services/api-gateway/
├── src/
│   ├── app.module.ts              # Root module
│   ├── main.ts                    # Bootstrap
│   │
│   ├── common/                    # Shared infrastructure
│   │   ├── decorators/            # @TenantId, @CurrentUser, @CorrelationId
│   │   ├── events/                # Base event definitions
│   │   ├── filters/               # GlobalExceptionFilter
│   │   ├── guards/                # JwtAuthGuard
│   │   ├── logger/                # AppLoggerService
│   │   ├── middleware/            # RequestLoggingMiddleware
│   │   └── services/              # EventBusService
│   │
│   └── modules/
│       ├── analytics/             # ClickHouse analytics
│       ├── campaigns/             # Campaign management
│       ├── contacts/              # Contact CRM
│       ├── health/                # Healthchecks
│       ├── inbox/                 # Unified inbox
│       ├── pipeline/              # Message pipeline
│       ├── segments/              # Dynamic segments
│       ├── sequences/             # Sales sequences
│       ├── templates/             # Message templates
│       └── workflows/             # Visual workflows
│
├── test/                          # E2E tests
├── docker-compose.yml             # Local dev stack
├── .env.example                   # Environment template
└── package.json
```

## Module Index

| Module   | Description                                        | Documentation                           |
|----------|----------------------------------------------------|-----------------------------------------|
| Contacts | Contact management with multi-channel identifiers  | [contacts.md](modules/contacts.md)      |
| Templates| Multi-channel message templates with versioning   | [templates.md](modules/templates.md)    |
| Segments | Dynamic and static audience segments              | [segments.md](modules/segments.md)      |
| Campaigns| Broadcast campaign orchestration                  | [campaigns.md](modules/campaigns.md)    |
| Pipeline | Async message processing queue                    | [pipeline.md](modules/pipeline.md)      |
| Workflows| Visual automation workflows                       | [workflows.md](modules/workflows.md)    |
| Sequences| Time-based sales sequences                        | [sequences.md](modules/sequences.md)    |
| Inbox    | Unified multi-channel inbox                       | [inbox.md](modules/inbox.md)            |
| Analytics| ClickHouse-backed analytics                       | [analytics.md](modules/analytics.md)    |
| Health   | System health monitoring                          | [health.md](modules/health.md)          |
| Common   | Shared infrastructure                             | [common.md](modules/common.md)          |

## Quick Links

- [Development Setup](dev/setup.md)
- [API Reference](api/index.md)
- [Database Schema](architecture/db-schema.md)
- [Event Flow](architecture/event-flow.md)

## Conventions

### API Response Format

All API responses follow the standard wrapper:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### Multi-Tenancy

All requests must include the `X-Tenant-ID` header. All database queries are automatically scoped to the tenant using the `@TenantId()` decorator.

### Logging

All services use structured logging via `AppLoggerService`:
- `logOperationStart(operation, context)` - Log operation start
- `logOperationEnd(operation, context, duration)` - Log operation end
- `logDbQuery(operation, query, params)` - Log database queries
- `logEventPublish(subject, eventType)` - Log event publishing

### Error Handling

Global exception filter catches all errors and returns consistent error responses:
- `400` - Validation errors
- `401` - Authentication required
- `403` - Authorization denied
- `404` - Resource not found
- `409` - Conflict (duplicate)
- `500` - Internal server error

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Maintainer**: AlumOutreach Engineering Team
