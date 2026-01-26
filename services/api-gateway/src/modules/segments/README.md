# Segmentation Service

Production-grade segmentation engine for AlumOutreach platform supporting static, dynamic, and event-driven audience segments.

## Features

### Segment Types
- **STATIC**: Manual member management - users add/remove contacts directly
- **DYNAMIC**: Rule-based auto-updating - members computed from JSON rule conditions  
- **EVENT_DRIVEN**: Triggered by events (placeholder for future implementation)

### Rule Engine
The rule engine compiles JSON rule definitions into efficient SQL queries with proper JOINs:

```typescript
// Example segment rules
{
  "logic": "AND",
  "groups": [
    {
      "logic": "OR",
      "rules": [
        { "field": "status", "operator": "equals", "value": "active" },
        { "field": "email", "operator": "ends_with", "value": "@alumni.edu" }
      ]
    },
    { "field": "tags", "operator": "has_tag", "value": "vip" }
  ]
}
```

### Supported Operators
| Operator | Description | Example Value |
|----------|-------------|---------------|
| `equals` | Exact match | `"active"` |
| `not_equals` | Not equal | `"inactive"` |
| `contains` | Substring match | `"@gmail"` |
| `starts_with` | Prefix match | `"Dr."` |
| `ends_with` | Suffix match | `"@edu"` |
| `in` | In array | `["a", "b", "c"]` |
| `not_in` | Not in array | `["x", "y"]` |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison | `100` |
| `between` | Range | `[10, 50]` |
| `is_null`, `is_not_null` | Null checks | - |
| `has_tag` | Has specific tag | `"vip"` |
| `has_any_tag` | Has any of tags | `["vip", "donor"]` |
| `has_all_tags` | Has all tags | `["active", "verified"]` |
| `has_attribute` | Custom attribute exists | - |
| `has_event` | Timeline event exists | `"email_opened"` |
| `event_count_gte`, `event_count_lte` | Event count | `5` |

### Supported Fields
- **Contact fields**: `email`, `phone`, `firstName`, `lastName`, `status`, `source`, `createdAt`, `updatedAt`, `lastActivityAt`
- **Tags**: `tags` (with tag operators)
- **Attributes**: `attributes.customField` (JSONB attribute lookup)
- **Timeline**: `timeline.eventType` or `events.eventType`
- **Channels**: `channel.email`, `channel.sms`, `channel.whatsapp`

## API Endpoints

### Segments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/segments` | Create segment |
| GET | `/api/v1/segments` | List segments (with search/filter) |
| GET | `/api/v1/segments/:id` | Get segment by ID |
| PATCH | `/api/v1/segments/:id` | Update segment |
| DELETE | `/api/v1/segments/:id` | Soft delete segment |

### Segment Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/segments/:id/preview` | Preview matching contacts |
| POST | `/api/v1/segments/:id/recompute` | Force recompute dynamic segment |
| POST | `/api/v1/segments/:id/archive` | Archive segment |
| POST | `/api/v1/segments/:id/unarchive` | Unarchive segment |
| GET | `/api/v1/segments/:id/count` | Get member count |

### Member Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/segments/:id/members` | List segment members |
| POST | `/api/v1/segments/:id/members` | Add members (static only) |
| DELETE | `/api/v1/segments/:id/members` | Remove members (static only) |
| GET | `/api/v1/segments/:id/members/:contactId/check` | Check membership |

### Contact-centric
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/segments/contact/:contactId` | Get segments for contact |

## Background Job

The `SegmentRefreshJobService` runs every 5 minutes to refresh dynamic segments:
1. Finds segments where `nextRefreshAt <= NOW()`
2. Recomputes membership using the rule engine
3. Updates member counts and next refresh time
4. Publishes NATS events for each refresh

## Events Published (NATS)

| Event | When |
|-------|------|
| `segment.created` | New segment created |
| `segment.updated` | Segment modified |
| `segment.deleted` | Segment deleted |
| `segment.membership.updated` | Members added/removed manually |
| `segment.refreshed` | Dynamic segment recomputed |

## Database Tables

### `segments`
Main segment entity with rules, config, and membership tracking.

### `segment_members`
Junction table linking segments to contacts with source tracking.

## Files Structure

```
src/modules/segments/
├── controllers/
│   └── segments.controller.ts    # REST API endpoints
├── dto/
│   └── segment.dto.ts            # Request/Response DTOs
├── entities/
│   ├── segment.entity.ts         # Segment entity with rules
│   └── segment-member.entity.ts  # Member junction entity
├── mappers/
│   └── segment.mapper.ts         # Entity-to-DTO mappers
├── repositories/
│   └── segment.repository.ts     # Database operations
├── services/
│   ├── segment-rule-engine.ts    # SQL rule compiler
│   ├── segments.service.ts       # Business logic
│   └── segment-refresh.job.ts    # Background refresh job
├── validators/
│   └── segment-validators.ts     # Rule validation
└── segments.module.ts            # Module definition
```

## Usage Example

```typescript
// Create a dynamic segment for active VIP alumni
const segment = await segmentsService.create({
  name: 'Active VIP Alumni',
  type: SegmentType.DYNAMIC,
  rules: {
    logic: 'AND',
    groups: [
      { field: 'status', operator: 'equals', value: 'active' },
      { field: 'tags', operator: 'has_tag', value: 'vip' },
      { field: 'email', operator: 'ends_with', value: '@alumni.edu' }
    ]
  },
  refreshIntervalMinutes: 30,
  color: '#4F46E5',
  tags: ['marketing', 'high-value']
}, userId, tenantId);

// Preview before saving
const preview = await segmentsService.preview(segmentId, {
  rules: newRules,
  limit: 100
}, tenantId);
console.log(`Would match ${preview.totalMatches} contacts`);
```
