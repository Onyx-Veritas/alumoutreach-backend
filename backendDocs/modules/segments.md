# Segments Module

## 1. Overview

The Segments Module provides dynamic audience segmentation for the AlumOutreach platform. It enables users to define rule-based filters that automatically group contacts into segments for targeted campaigns, workflows, and analytics.

**Key Responsibilities:**
- Segment definition with rule engine
- Dynamic segment membership evaluation
- Static segment support (manual assignment)
- Real-time segment membership updates on contact changes
- Segment size estimation
- Segment export and sync

## 2. Architecture

### Components

| Component                | File                                         | Purpose                              |
|--------------------------|----------------------------------------------|--------------------------------------|
| **Controller**           | `segments.controller.ts`                     | REST API endpoints                   |
| **Service**              | `segments.service.ts`                        | Business logic                       |
| **Rule Engine**          | `services/segment-rule-engine.service.ts`    | Rule parsing and evaluation          |
| **Membership Service**   | `services/segment-membership.service.ts`     | Membership management                |
| **Repository**           | `repositories/segment.repository.ts`         | Database operations                  |
| **Entities**             | `entities/*.entity.ts`                       | TypeORM definitions                  |

### Module Dependencies

```
SegmentsModule
├── TypeOrmModule (Segment entities)
├── ContactsModule (Contact queries)
├── EventBusModule (Event subscription)
├── LoggerModule
└── Exports: SegmentsService, SegmentRuleEngineService, SegmentRepository
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Contacts Module    | Inbound   | Query contacts for segment evaluation        |
| Contacts Module    | Subscribes| Listen to contact.created, contact.updated   |
| Campaigns Module   | Outbound  | Provide audience for campaign targeting      |
| Workflows Module   | Outbound  | Trigger workflows for segment entry/exit     |
| Analytics Module   | Outbound  | Segment membership metrics                   |

## 3. Database Schema

### Segment Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| name             | VARCHAR(255)    | No       | -          | Segment name                   |
| description      | TEXT            | Yes      | null       | Segment description            |
| type             | ENUM            | No       | 'dynamic'  | dynamic, static                |
| status           | ENUM            | No       | 'active'   | active, paused, archived       |
| rules            | JSONB           | No       | {}         | Segment rule definition        |
| rulesOperator    | ENUM            | No       | 'AND'      | AND, OR for rule groups        |
| memberCount      | INTEGER         | No       | 0          | Cached member count            |
| lastEvaluatedAt  | TIMESTAMPTZ     | Yes      | null       | Last full evaluation           |
| createdBy        | UUID            | No       | -          | Creator user ID                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |
| deletedAt        | TIMESTAMPTZ     | Yes      | null       | Soft delete timestamp          |

**Indexes:**
- `idx_segments_tenant_status` - (tenantId, status)
- `idx_segments_tenant_type` - (tenantId, type)

**Unique Constraint:** (tenantId, name)

### SegmentRule Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| segmentId        | UUID            | No       | FK to segments                 |
| groupIndex       | INTEGER         | No       | Rule group (for nested logic)  |
| field            | VARCHAR(100)    | No       | Contact field to evaluate      |
| operator         | ENUM            | No       | equals, contains, gt, lt, etc. |
| value            | JSONB           | No       | Comparison value(s)            |
| dataType         | ENUM            | No       | string, number, boolean, date  |
| sortOrder        | INTEGER         | No       | Order within group             |

### SegmentMember Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| tenantId         | VARCHAR         | No       | Tenant identifier              |
| segmentId        | UUID            | No       | FK to segments                 |
| contactId        | UUID            | No       | FK to contacts                 |
| addedAt          | TIMESTAMPTZ     | No       | When added to segment          |
| addedReason      | VARCHAR(50)     | No       | rule_match, manual, import     |
| removedAt        | TIMESTAMPTZ     | Yes      | When removed (soft delete)     |

**Unique Constraint:** (segmentId, contactId)

**Indexes:**
- `idx_segment_members_segment` - (segmentId, removedAt)
- `idx_segment_members_contact` - (contactId, removedAt)

### SegmentHistory Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| segmentId        | UUID            | No       | FK to segments                 |
| evaluationDate   | DATE            | No       | Evaluation date                |
| memberCount      | INTEGER         | No       | Count on that date             |
| addedCount       | INTEGER         | No       | New members that day           |
| removedCount     | INTEGER         | No       | Members removed that day       |

## 4. API Endpoints

### Create Segment

```
POST /api/v1/segments
```

**Request Body:**
```json
{
  "name": "High-Value Prospects",
  "description": "Contacts with lifetime value > $10,000 who opened email in last 30 days",
  "type": "dynamic",
  "rulesOperator": "AND",
  "rules": [
    {
      "groupIndex": 0,
      "field": "attributes.lifetime_value",
      "operator": "gt",
      "value": 10000,
      "dataType": "number"
    },
    {
      "groupIndex": 0,
      "field": "lastEmailOpenedAt",
      "operator": "gt",
      "value": "-30d",
      "dataType": "relative_date"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "High-Value Prospects",
    "type": "dynamic",
    "status": "active",
    "memberCount": 0,
    "createdAt": "2026-01-27T10:00:00Z"
  }
}
```

### List Segments

```
GET /api/v1/segments
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page                 |
| type       | string  | -       | Filter by type                 |
| status     | string  | -       | Filter by status               |
| search     | string  | -       | Search by name                 |

### Get Segment

```
GET /api/v1/segments/:id
```

### Update Segment

```
PATCH /api/v1/segments/:id
```

### Delete Segment

```
DELETE /api/v1/segments/:id
```

### Get Segment Members

```
GET /api/v1/segments/:id/members
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 50      | Items per page                 |
| sortBy     | string  | addedAt | Sort field                     |
| sortOrder  | string  | DESC    | ASC or DESC                    |

### Estimate Segment Size

```
POST /api/v1/segments/estimate
```

**Request Body:**
```json
{
  "rulesOperator": "AND",
  "rules": [
    {
      "field": "status",
      "operator": "equals",
      "value": "active"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "estimatedCount": 12500,
    "sampleContacts": [
      {"id": "...", "email": "john@example.com", "firstName": "John"},
      {"id": "...", "email": "jane@example.com", "firstName": "Jane"}
    ]
  }
}
```

### Evaluate Segment (Force Refresh)

```
POST /api/v1/segments/:id/evaluate
```

### Add Members to Static Segment

```
POST /api/v1/segments/:id/members
```

**Request Body:**
```json
{
  "contactIds": [
    "550e8400-e29b-41d4-a716-446655440010",
    "550e8400-e29b-41d4-a716-446655440011"
  ]
}
```

### Remove Members from Static Segment

```
DELETE /api/v1/segments/:id/members
```

**Request Body:**
```json
{
  "contactIds": [
    "550e8400-e29b-41d4-a716-446655440010"
  ]
}
```

### Get Segment History

```
GET /api/v1/segments/:id/history
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| startDate  | string  | -       | Start date (ISO 8601)          |
| endDate    | string  | -       | End date (ISO 8601)            |

## 5. Event Bus (NATS JetStream)

### Subscribed Events

| Subject            | Action                                    |
|--------------------|-------------------------------------------|
| `contact.created`  | Evaluate new contact against all segments |
| `contact.updated`  | Re-evaluate contact's segment membership  |
| `contact.deleted`  | Remove contact from all segments          |

### Published Events

| Subject               | Event Type              | Trigger                       |
|-----------------------|-------------------------|-------------------------------|
| `segment.created`     | SegmentCreatedEvent     | New segment created           |
| `segment.updated`     | SegmentUpdatedEvent     | Segment rules modified        |
| `segment.deleted`     | SegmentDeletedEvent     | Segment deleted               |
| `segment.evaluated`   | SegmentEvaluatedEvent   | Full segment evaluation done  |
| `segment.member.added`| SegmentMemberAddedEvent | Contact added to segment      |
| `segment.member.removed`| SegmentMemberRemovedEvent | Contact removed from segment |

### Event Schema

```typescript
interface SegmentMemberAddedEvent {
  version: string;
  source: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  data: {
    segmentId: string;
    segmentName: string;
    contactId: string;
    reason: 'rule_match' | 'manual' | 'import';
  };
}
```

## 6. Logging

```typescript
// Segment evaluation
this.logger.log('[START] evaluateSegment', {
  tenantId,
  correlationId,
  segmentId,
  segmentName,
  currentMemberCount: segment.memberCount,
});

// Rule evaluation
this.logger.log('[EVALUATE] segment rules', {
  tenantId,
  segmentId,
  rulesCount: segment.rules.length,
  matchedContactCount: matched.length,
});

// Membership change
this.logger.log('[MEMBERSHIP] segment member added', {
  tenantId,
  segmentId,
  contactId,
  reason: 'rule_match',
});
```

## 7. Background Jobs

| Job Name                 | Schedule    | Description                              |
|--------------------------|-------------|------------------------------------------|
| `segment-full-evaluation`| Daily 2 AM  | Re-evaluate all dynamic segments         |
| `segment-count-sync`     | Hourly      | Sync cached memberCount with actual      |
| `segment-history-record` | Daily 11 PM | Record daily membership stats            |

### Full Evaluation Job

```typescript
@Cron('0 2 * * *')
async evaluateAllDynamicSegments() {
  const segments = await this.segmentRepository.findAllDynamic(tenantId);
  for (const segment of segments) {
    await this.evaluateSegment(segment.id);
  }
}
```

## 8. Integration Scenarios

### Scenario 1: Real-Time Segment Update

```
1. Contact updated via PATCH /api/v1/contacts/:id
2. contact.updated event published
3. SegmentMembershipService receives event
4. Queries all dynamic segments for tenant
5. For each segment:
   a. Evaluates contact against segment rules
   b. If match and not member: add to segment, publish segment.member.added
   c. If no match and is member: remove from segment, publish segment.member.removed
```

### Scenario 2: Campaign Targeting

```
1. Campaign created with segmentIds: ['seg-1', 'seg-2']
2. CampaignService calls SegmentsService.getSegmentContacts(['seg-1', 'seg-2'])
3. Returns union of contacts from both segments
4. Removes duplicates by contactId
5. Returns list for campaign execution
```

### Scenario 3: Workflow Trigger on Segment Entry

```
1. Contact matches new segment rule
2. segment.member.added event published
3. WorkflowTriggerService receives event
4. Checks workflows with trigger: { type: 'segment_entry', segmentId: 'seg-1' }
5. Creates WorkflowRun for matching workflows
```

## 9. Rule Engine

### Supported Operators

| Operator        | Data Types              | Description                    |
|-----------------|-------------------------|--------------------------------|
| `equals`        | string, number, boolean | Exact match                    |
| `not_equals`    | string, number, boolean | Not equal                      |
| `contains`      | string                  | Substring match                |
| `not_contains`  | string                  | No substring match             |
| `starts_with`   | string                  | Prefix match                   |
| `ends_with`     | string                  | Suffix match                   |
| `gt`            | number, date            | Greater than                   |
| `gte`           | number, date            | Greater than or equal          |
| `lt`            | number, date            | Less than                      |
| `lte`           | number, date            | Less than or equal             |
| `in`            | string, number          | In list of values              |
| `not_in`        | string, number          | Not in list of values          |
| `is_set`        | any                     | Field has value                |
| `is_not_set`    | any                     | Field is null/empty            |
| `between`       | number, date            | Within range                   |

### Relative Date Values

| Value      | Description         |
|------------|---------------------|
| `-7d`      | 7 days ago          |
| `-30d`     | 30 days ago         |
| `-3m`      | 3 months ago        |
| `-1y`      | 1 year ago          |
| `today`    | Current day start   |
| `yesterday`| Previous day        |

### SQL Generation

```typescript
// Rule: { field: 'attributes.lifetime_value', operator: 'gt', value: 10000 }
// Generated SQL:
WHERE (contacts.attributes->>'lifetime_value')::numeric > 10000
```

## 10. Known Limitations

1. **Evaluation Performance**: Large segments (100k+ contacts) may take several seconds to evaluate.
2. **Complex Rules**: Maximum 20 rules per segment to prevent query complexity.
3. **Cross-Tenant Segments**: Segments cannot span multiple tenants.
4. **Attribute Indexing**: Deep JSONB queries may not use indexes effectively.

## 11. Future Extensions

- [ ] Segment intersections and unions (compound segments)
- [ ] Predictive segments using ML
- [ ] Segment comparison and overlap analysis
- [ ] Import segments from CSV
- [ ] Segment templates / presets
- [ ] Scheduled segment snapshots
- [ ] Segment-based rate limiting
