# Contacts Module

## 1. Overview

The Contacts Module is the core CRM component of AlumOutreach, responsible for managing contact records across all communication channels. It provides multi-channel identifier management (email, phone, WhatsApp), custom attributes, tagging, consent tracking, and timeline event logging.

**Key Responsibilities:**
- CRUD operations for contacts
- Multi-channel identifier management (email, phone, WhatsApp Business)
- Custom attribute storage (JSONB)
- Tag management with many-to-many relationships
- Consent tracking per channel per purpose
- Timeline event logging
- Full-text search via Elasticsearch
- Event publishing for downstream modules

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `contacts.controller.ts`                       | REST API endpoints                   |
| **Service**              | `contacts.service.ts`                          | Business logic                       |
| **Search Service**       | `services/contact-search.service.ts`           | Elasticsearch integration            |
| **Repository**           | `repositories/contact.repository.ts`           | Database operations                  |
| **Entities**             | `entities/*.entity.ts`                         | TypeORM entity definitions           |

### Module Dependencies

```
ContactsModule
├── TypeOrmModule (Contact entities)
├── ElasticsearchModule
├── LoggerModule
└── Exports: ContactsService, ContactSearchService, ContactRepository
```

### Integration Points

| Integration       | Direction | Purpose                                      |
|-------------------|-----------|----------------------------------------------|
| Segments Module   | Outbound  | Publishes `contact.created`, `contact.updated` |
| Workflows Module  | Outbound  | Trigger workflow on contact events           |
| Inbox Module      | Inbound   | Resolve contact from channel identifier      |
| Analytics Module  | Outbound  | Contact analytics events                     |

### Tenancy & Logging

- All queries include `tenantId` filter
- `@TenantId()` decorator extracts tenant from request header
- `AppLoggerService` used with context `ContactsService`
- Correlation ID passed through all operations

## 3. Database Schema

### Contact Entity

| Column        | Type            | Nullable | Default    | Index | Description                    |
|---------------|-----------------|----------|------------|-------|--------------------------------|
| id            | UUID            | No       | generated  | PK    | Primary key                    |
| tenantId      | VARCHAR         | No       | -          | Yes   | Tenant identifier              |
| externalId    | VARCHAR         | Yes      | null       | Yes   | External system ID             |
| firstName     | VARCHAR(100)    | Yes      | null       | -     | First name                     |
| lastName      | VARCHAR(100)    | Yes      | null       | -     | Last name                      |
| displayName   | VARCHAR(200)    | Yes      | null       | -     | Computed display name          |
| email         | VARCHAR(255)    | Yes      | null       | Yes   | Primary email                  |
| phone         | VARCHAR(50)     | Yes      | null       | Yes   | Primary phone                  |
| avatarUrl     | VARCHAR(500)    | Yes      | null       | -     | Profile image URL              |
| status        | ENUM            | No       | 'active'   | Yes   | active, inactive, blocked      |
| source        | VARCHAR(100)    | Yes      | null       | -     | Acquisition source             |
| attributes    | JSONB           | No       | {}         | -     | Custom attributes              |
| lastContactAt | TIMESTAMPTZ     | Yes      | null       | -     | Last interaction timestamp     |
| createdAt     | TIMESTAMPTZ     | No       | now()      | -     | Created timestamp              |
| updatedAt     | TIMESTAMPTZ     | No       | now()      | -     | Updated timestamp              |
| deletedAt     | TIMESTAMPTZ     | Yes      | null       | -     | Soft delete timestamp          |

**Indexes:**
- `idx_contacts_tenant_email` - (tenantId, email)
- `idx_contacts_tenant_phone` - (tenantId, phone)
- `idx_contacts_tenant_status` - (tenantId, status)
- `idx_contacts_external_id` - (tenantId, externalId)

### ChannelIdentifier Entity

| Column        | Type            | Nullable | Default    | Description                    |
|---------------|-----------------|----------|------------|--------------------------------|
| id            | UUID            | No       | generated  | Primary key                    |
| tenantId      | VARCHAR         | No       | -          | Tenant identifier              |
| contactId     | UUID            | No       | -          | FK to contacts                 |
| channel       | ENUM            | No       | -          | whatsapp, sms, email, push     |
| identifier    | VARCHAR(255)    | No       | -          | Channel-specific identifier    |
| isPrimary     | BOOLEAN         | No       | false      | Primary for channel            |
| isVerified    | BOOLEAN         | No       | false      | Verification status            |
| metadata      | JSONB           | No       | {}         | Channel-specific metadata      |
| createdAt     | TIMESTAMPTZ     | No       | now()      | Created timestamp              |

**Unique Constraint:** (tenantId, channel, identifier)

### ContactAttribute Entity

| Column        | Type            | Nullable | Description                    |
|---------------|-----------------|----------|--------------------------------|
| id            | UUID            | No       | Primary key                    |
| tenantId      | VARCHAR         | No       | Tenant identifier              |
| contactId     | UUID            | No       | FK to contacts                 |
| key           | VARCHAR(100)    | No       | Attribute name                 |
| value         | TEXT            | Yes      | Attribute value                |
| dataType      | ENUM            | No       | string, number, boolean, date  |
| createdAt     | TIMESTAMPTZ     | No       | Created timestamp              |
| updatedAt     | TIMESTAMPTZ     | No       | Updated timestamp              |

### ContactConsent Entity

| Column        | Type            | Nullable | Description                    |
|---------------|-----------------|----------|--------------------------------|
| id            | UUID            | No       | Primary key                    |
| tenantId      | VARCHAR         | No       | Tenant identifier              |
| contactId     | UUID            | No       | FK to contacts                 |
| channel       | ENUM            | No       | Channel type                   |
| purpose       | VARCHAR(100)    | No       | Consent purpose                |
| granted       | BOOLEAN         | No       | Consent status                 |
| grantedAt     | TIMESTAMPTZ     | Yes      | When granted                   |
| revokedAt     | TIMESTAMPTZ     | Yes      | When revoked                   |
| source        | VARCHAR(100)    | Yes      | How consent was collected      |
| ipAddress     | VARCHAR(45)     | Yes      | IP when collected              |

### ContactTag Entity

| Column        | Type            | Nullable | Description                    |
|---------------|-----------------|----------|--------------------------------|
| id            | UUID            | No       | Primary key                    |
| tenantId      | VARCHAR         | No       | Tenant identifier              |
| name          | VARCHAR(100)    | No       | Tag name                       |
| color         | VARCHAR(7)      | Yes      | Hex color code                 |
| description   | TEXT            | Yes      | Tag description                |
| createdAt     | TIMESTAMPTZ     | No       | Created timestamp              |

**Unique Constraint:** (tenantId, name)

### ContactTagMapping Entity

| Column        | Type            | Nullable | Description                    |
|---------------|-----------------|----------|--------------------------------|
| id            | UUID            | No       | Primary key                    |
| contactId     | UUID            | No       | FK to contacts                 |
| tagId         | UUID            | No       | FK to contact_tags             |
| createdAt     | TIMESTAMPTZ     | No       | Created timestamp              |

### ContactTimelineEvent Entity

| Column        | Type            | Nullable | Description                    |
|---------------|-----------------|----------|--------------------------------|
| id            | UUID            | No       | Primary key                    |
| tenantId      | VARCHAR         | No       | Tenant identifier              |
| contactId     | UUID            | No       | FK to contacts                 |
| eventType     | VARCHAR(100)    | No       | Event type identifier          |
| title         | VARCHAR(255)    | No       | Event title                    |
| description   | TEXT            | Yes      | Event description              |
| metadata      | JSONB           | No       | Event-specific data            |
| occurredAt    | TIMESTAMPTZ     | No       | When event occurred            |
| createdAt     | TIMESTAMPTZ     | No       | Created timestamp              |

## 4. API Endpoints

### Create Contact

```
POST /api/v1/contacts
```

**Headers:**
- `X-Tenant-ID`: Required tenant identifier

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "source": "website_signup",
  "attributes": {
    "company": "Acme Corp",
    "role": "Engineering Manager"
  },
  "tags": ["prospect", "enterprise"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "tenant-123",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "status": "active",
    "source": "website_signup",
    "attributes": {
      "company": "Acme Corp",
      "role": "Engineering Manager"
    },
    "tags": ["prospect", "enterprise"],
    "createdAt": "2026-01-27T10:00:00Z",
    "updatedAt": "2026-01-27T10:00:00Z"
  }
}
```

### List Contacts

```
GET /api/v1/contacts
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page (max 100)       |
| status     | string  | -       | Filter by status               |
| search     | string  | -       | Full-text search               |
| tags       | string  | -       | Comma-separated tag names      |
| sortBy     | string  | createdAt | Sort field                   |
| sortOrder  | string  | DESC    | ASC or DESC                    |

**Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1250,
    "totalPages": 63
  }
}
```

### Get Contact

```
GET /api/v1/contacts/:id
```

### Update Contact

```
PATCH /api/v1/contacts/:id
```

### Delete Contact

```
DELETE /api/v1/contacts/:id
```

### Add Tag

```
POST /api/v1/contacts/:id/tags
```

**Request Body:**
```json
{
  "tagName": "vip-customer"
}
```

### Remove Tag

```
DELETE /api/v1/contacts/:id/tags/:tagId
```

### Add Attribute

```
POST /api/v1/contacts/:id/attributes
```

**Request Body:**
```json
{
  "key": "lifetime_value",
  "value": "50000",
  "dataType": "number"
}
```

### Get Timeline

```
GET /api/v1/contacts/:id/timeline
```

### Record Consent

```
POST /api/v1/contacts/:id/consent
```

**Request Body:**
```json
{
  "channel": "email",
  "purpose": "marketing",
  "granted": true,
  "source": "double_opt_in"
}
```

### Search Contacts (Elasticsearch)

```
GET /api/v1/contacts/search?q=john+doe
```

### Rebuild Search Index (Admin)

```
POST /api/v1/contacts/admin/rebuild-search-index
```

## 5. Event Bus (NATS JetStream)

### Published Events

| Subject            | Event Type              | Trigger                       |
|--------------------|-------------------------|-------------------------------|
| `contact.created`  | ContactCreatedEvent     | New contact created           |
| `contact.updated`  | ContactUpdatedEvent     | Contact fields modified       |
| `contact.deleted`  | ContactDeletedEvent     | Contact soft-deleted          |
| `contact.tagged`   | ContactTaggedEvent      | Tag added to contact          |
| `contact.untagged` | ContactUntaggedEvent    | Tag removed from contact      |

### Event Schema

```typescript
interface ContactCreatedEvent {
  version: string;          // "1.0"
  source: string;           // "contacts-service"
  tenantId: string;
  correlationId: string;
  timestamp: string;        // ISO 8601
  data: {
    contactId: string;
    email?: string;
    phone?: string;
    source?: string;
    attributes: Record<string, unknown>;
  };
}
```

### Consumers

| Module    | Subject           | Purpose                          |
|-----------|-------------------|----------------------------------|
| Segments  | `contact.created` | Evaluate segment membership      |
| Segments  | `contact.updated` | Re-evaluate segment membership   |
| Workflows | `contact.created` | Trigger onboarding workflows     |
| Analytics | `contact.created` | Track contact creation metrics   |

## 6. Logging

```typescript
// Operation start/end pattern
this.logger.log('[START] createContact', {
  tenantId,
  correlationId,
  operation: 'createContact',
});

// After completion
this.logger.log('[END] createContact', {
  tenantId,
  correlationId,
  operation: 'createContact',
  duration: Date.now() - startTime,
  contactId: contact.id,
});

// Event publishing
this.logger.log('[PUBLISH] contact.created', {
  tenantId,
  correlationId,
  contactId: contact.id,
});
```

## 7. Background Jobs

This module does not have scheduled background jobs. Search index synchronization happens on-demand via the admin endpoint.

## 8. Integration Scenarios

### Scenario 1: Contact Creation → Segment Membership

```
1. POST /api/v1/contacts (Create contact with email)
2. ContactsService creates contact in PostgreSQL
3. ContactsService indexes contact in Elasticsearch
4. EventBusService.publish('contact.created', {...})
5. SegmentsService receives event
6. SegmentRuleEngine evaluates all dynamic segments
7. Matching contacts added to segment_members
```

### Scenario 2: Contact Update → Workflow Trigger

```
1. PATCH /api/v1/contacts/:id (Update attributes)
2. ContactsService updates contact
3. EventBusService.publish('contact.updated', {...})
4. WorkflowTriggerService receives event
5. Matches against workflow triggers with type='contact.updated'
6. Creates WorkflowRun for matching workflows
```

### Scenario 3: Inbound Message → Contact Resolution

```
1. WhatsApp webhook receives inbound message
2. InboxIngestionService receives message
3. Calls ContactsService.findByChannelIdentifier(channel, phone)
4. If not found, creates new contact with phone as identifier
5. Creates InboxThread linked to contactId
6. Creates InboxMessage in thread
```

## 9. Known Limitations

1. **Elasticsearch Dependency**: Full-text search requires Elasticsearch. Falls back to database ILIKE search if ES unavailable.
2. **Bulk Operations**: No bulk import endpoint yet. Large imports should use direct database access.
3. **Merge Contacts**: No contact deduplication or merge functionality.
4. **Custom Fields Schema**: Attributes are free-form JSONB without schema validation.

## 10. Future Extensions

- [ ] Contact merge/deduplication with conflict resolution
- [ ] Bulk import with CSV/Excel support
- [ ] Custom field definitions with validation
- [ ] Contact scoring based on engagement
- [ ] GDPR data export and deletion workflows
- [ ] Contact enrichment via third-party APIs
- [ ] Real-time sync with CRM systems (Salesforce, HubSpot)
