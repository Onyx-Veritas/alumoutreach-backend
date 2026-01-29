# Analytics Module

## 1. Overview

The Analytics Module provides real-time and historical analytics for the AlumOutreach platform using ClickHouse as the OLAP datastore. It ingests events from all modules, normalizes them into a unified schema, and exposes dashboard queries for messaging, campaigns, workflows, sequences, templates, and traffic analysis.

**Key Responsibilities:**
- Event ingestion from NATS JetStream
- Event normalization to unified schema
- Storage in ClickHouse MergeTree tables
- Time-series aggregation queries
- Dashboard API endpoints
- Real-time and batch analytics

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `analytics.controller.ts`                      | REST API endpoints                   |
| **Service**              | `services/analytics.service.ts`                | Overview analytics                   |
| **Query Service**        | `services/analytics-query.service.ts`          | Dashboard-specific queries           |
| **Sync Service**         | `services/analytics-sync.service.ts`           | Event ingestion from NATS            |
| **Repository**           | `repositories/analytics.repository.ts`         | ClickHouse operations                |
| **Mapper**               | `mappers/analytics.mapper.ts`                  | Source event → analytics event       |

### Module Dependencies

```
AnalyticsModule
├── ClickHouseModule (OLAP storage)
├── EventBusModule (Event subscription)
├── LoggerModule
└── Exports: AnalyticsService, AnalyticsQueryService
```

### Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Source        │───►│   NATS          │───►│   Sync          │
│   Modules       │    │   JetStream     │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │◄───│   Query         │◄───│   ClickHouse    │
│   API           │    │   Service       │    │   (MergeTree)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Pipeline Module    | Subscribes| message.sent, message.delivered, message.opened, etc. |
| Campaigns Module   | Subscribes| campaign.started, campaign.completed         |
| Workflows Module   | Subscribes| workflow.run.started, workflow.run.completed |
| Sequences Module   | Subscribes| sequence.step.executed, sequence.enrollment.* |
| Contacts Module    | Subscribes| contact.created, contact.updated             |

## 3. ClickHouse Schema

### analytics_events Table

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
    metadata String,  -- JSON string
    occurred_at DateTime64(3),
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, event_type, occurred_at, id)
TTL occurred_at + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;
```

### Indexes

```sql
-- Secondary indexes for common query patterns
CREATE INDEX idx_channel ON analytics_events (channel) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX idx_entity_id ON analytics_events (entity_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX idx_campaign_id ON analytics_events (campaign_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX idx_contact_id ON analytics_events (contact_id) TYPE bloom_filter GRANULARITY 1;
```

### Event Types

| Event Type           | Entity Type    | Description                           |
|----------------------|----------------|---------------------------------------|
| `message_sent`       | message        | Message queued for delivery           |
| `message_delivered`  | message        | Message delivered to recipient        |
| `message_opened`     | message        | Email opened                          |
| `message_clicked`    | message        | Link clicked                          |
| `message_bounced`    | message        | Message bounced                       |
| `message_complained` | message        | Spam complaint                        |
| `message_unsubscribed`| message       | Recipient unsubscribed                |
| `campaign_started`   | campaign       | Campaign execution started            |
| `campaign_completed` | campaign       | Campaign finished                     |
| `workflow_run_started`| workflow      | Workflow run initiated                |
| `workflow_run_completed`| workflow    | Workflow run finished                 |
| `sequence_step_executed`| sequence    | Sequence step executed                |
| `contact_created`    | contact        | New contact created                   |

### Channels

| Channel     | Description           |
|-------------|-----------------------|
| `email`     | Email messages        |
| `sms`       | SMS/Text messages     |
| `whatsapp`  | WhatsApp messages     |
| `push`      | Push notifications    |

## 4. API Endpoints

### Get Overview Analytics

```
GET /api/v1/analytics/overview
```

**Query Parameters:**
| Parameter  | Type    | Default   | Description                    |
|------------|---------|-----------|--------------------------------|
| timeRange  | string  | '7d'      | Time range (1d, 7d, 30d, 90d)  |
| startDate  | string  | -         | Custom start date (ISO 8601)  |
| endDate    | string  | -         | Custom end date (ISO 8601)    |

**Response:**
```json
{
  "success": true,
  "data": {
    "timeRange": {
      "start": "2026-01-20T00:00:00Z",
      "end": "2026-01-27T23:59:59Z"
    },
    "summary": {
      "totalMessagesSent": 125000,
      "totalDelivered": 120000,
      "totalOpened": 45000,
      "totalClicked": 12000,
      "deliveryRate": 96.0,
      "openRate": 37.5,
      "clickRate": 10.0
    },
    "byChannel": {
      "email": {"sent": 80000, "delivered": 78000, "opened": 35000},
      "sms": {"sent": 30000, "delivered": 29000},
      "whatsapp": {"sent": 15000, "delivered": 14000}
    },
    "trend": [
      {"date": "2026-01-20", "sent": 18000, "delivered": 17500},
      {"date": "2026-01-21", "sent": 17500, "delivered": 17000}
    ]
  }
}
```

### Get Messages Analytics

```
GET /api/v1/analytics/messages
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '7d'      | Time range                     |
| channel     | string  | -         | Filter by channel              |
| granularity | string  | 'day'     | hour, day, week, month         |

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "sent": 125000,
      "delivered": 120000,
      "opened": 45000,
      "clicked": 12000,
      "bounced": 3000,
      "complained": 50
    },
    "timeSeries": [
      {
        "timestamp": "2026-01-20T00:00:00Z",
        "sent": 18000,
        "delivered": 17500,
        "opened": 6500,
        "clicked": 1700
      }
    ],
    "byChannel": [
      {"channel": "email", "sent": 80000, "openRate": 43.75},
      {"channel": "sms", "sent": 30000, "deliveryRate": 96.67}
    ]
  }
}
```

### Get Campaign Analytics

```
GET /api/v1/analytics/campaigns
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '30d'     | Time range                     |
| campaignId  | string  | -         | Specific campaign ID           |
| channel     | string  | -         | Filter by channel              |

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCampaigns": 15,
      "completedCampaigns": 12,
      "totalRecipients": 150000,
      "avgOpenRate": 35.5,
      "avgClickRate": 8.2
    },
    "topCampaigns": [
      {
        "campaignId": "...",
        "name": "Black Friday Sale",
        "sent": 50000,
        "openRate": 42.5,
        "clickRate": 12.3
      }
    ],
    "timeSeries": [...]
  }
}
```

### Get Workflow Analytics

```
GET /api/v1/analytics/workflows
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '30d'     | Time range                     |
| workflowId  | string  | -         | Specific workflow ID           |

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRuns": 25000,
      "completedRuns": 22000,
      "failedRuns": 500,
      "goalReachedRuns": 8000,
      "avgCompletionRate": 88.0,
      "avgConversionRate": 36.36
    },
    "topWorkflows": [
      {
        "workflowId": "...",
        "name": "New User Onboarding",
        "runs": 10000,
        "completionRate": 92.0,
        "conversionRate": 45.0
      }
    ],
    "timeSeries": [...]
  }
}
```

### Get Sequence Analytics

```
GET /api/v1/analytics/sequences
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '30d'     | Time range                     |
| sequenceId  | string  | -         | Specific sequence ID           |

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEnrollments": 5000,
      "activeEnrollments": 800,
      "completedEnrollments": 3500,
      "repliedEnrollments": 1200,
      "avgReplyRate": 24.0
    },
    "stepFunnel": [
      {"stepNumber": 1, "executed": 5000, "replied": 200},
      {"stepNumber": 2, "executed": 4500, "replied": 350},
      {"stepNumber": 3, "executed": 3800, "replied": 400}
    ],
    "topSequences": [...]
  }
}
```

### Get Template Analytics

```
GET /api/v1/analytics/templates
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '30d'     | Time range                     |
| templateId  | string  | -         | Specific template ID           |
| channel     | string  | -         | Filter by channel              |

**Response:**
```json
{
  "success": true,
  "data": {
    "topTemplates": [
      {
        "templateId": "...",
        "name": "Welcome Email",
        "usageCount": 50000,
        "openRate": 52.3,
        "clickRate": 15.2
      }
    ],
    "worstPerforming": [
      {
        "templateId": "...",
        "name": "Newsletter v1",
        "usageCount": 10000,
        "openRate": 12.5,
        "clickRate": 1.2
      }
    ]
  }
}
```

### Get Traffic Analytics

```
GET /api/v1/analytics/traffic
```

**Query Parameters:**
| Parameter   | Type    | Default   | Description                    |
|-------------|---------|-----------|--------------------------------|
| timeRange   | string  | '7d'      | Time range                     |
| granularity | string  | 'hour'    | hour, day, week                |

**Response:**
```json
{
  "success": true,
  "data": {
    "peakHours": [
      {"hour": 10, "messageCount": 15000},
      {"hour": 14, "messageCount": 18000}
    ],
    "byDayOfWeek": [
      {"day": "Monday", "messageCount": 22000},
      {"day": "Tuesday", "messageCount": 25000}
    ],
    "timeSeries": [...]
  }
}
```

## 5. Event Ingestion

### Subscribed NATS Subjects

```typescript
const ANALYTICS_SOURCE_SUBJECTS = [
  'pipeline.message.sent',
  'pipeline.message.delivered',
  'pipeline.message.opened',
  'pipeline.message.clicked',
  'pipeline.message.bounced',
  'pipeline.message.complained',
  'campaign.started',
  'campaign.completed',
  'workflow.run.started',
  'workflow.run.completed',
  'workflow.run.goal_reached',
  'sequence.step.executed',
  'sequence.enrollment.replied',
  'contact.created',
  'contact.updated',
];
```

### Event Mapping

```typescript
// Pipeline message event → AnalyticsEvent
mapPipelineEvent(event: MessageSentEvent): AnalyticsEvent {
  return {
    id: uuidv4(),
    tenantId: event.tenantId,
    eventType: 'message_sent',
    entityType: 'message',
    entityId: event.data.messageId,
    channel: event.data.channel,
    contactId: event.data.contactId,
    sourceType: event.data.sourceType,
    sourceId: event.data.sourceId,
    campaignId: event.data.sourceType === 'campaign' ? event.data.sourceId : null,
    workflowId: event.data.sourceType === 'workflow' ? event.data.sourceId : null,
    sequenceId: event.data.sourceType === 'sequence' ? event.data.sourceId : null,
    templateId: event.data.templateId,
    metadata: JSON.stringify(event.data.metadata || {}),
    occurredAt: new Date(event.timestamp),
  };
}
```

### Buffered Ingestion

```typescript
// Buffer events and flush in batches
private buffer: AnalyticsEvent[] = [];
private readonly BUFFER_SIZE = 100;
private readonly FLUSH_INTERVAL_MS = 5000;

async ingestEvent(event: AnalyticsEvent) {
  this.buffer.push(event);
  if (this.buffer.length >= this.BUFFER_SIZE) {
    await this.flushBuffer();
  }
}

@Cron('*/5 * * * * *')  // Every 5 seconds
async flushBuffer() {
  if (this.buffer.length === 0) return;
  const events = this.buffer.splice(0, this.buffer.length);
  await this.repository.insertBatch(events);
}
```

## 6. Logging

```typescript
// Event ingestion
this.logger.log('[INGEST] analytics events batch', {
  tenantId: 'multi',
  batchSize: events.length,
  eventTypes: [...new Set(events.map(e => e.eventType))],
});

// Query execution
this.logger.log('[QUERY] analytics query', {
  tenantId,
  correlationId,
  queryType: 'messages',
  timeRange,
  granularity,
  duration: Date.now() - startTime,
});
```

## 7. Background Jobs

| Job Name                    | Schedule       | Description                              |
|-----------------------------|----------------|------------------------------------------|
| `analytics-buffer-flush`    | Every 5 sec    | Flush event buffer to ClickHouse         |
| `analytics-materialized-refresh` | Every 1 hour | Refresh materialized views          |

## 8. Repository Methods

### Insert Batch

```typescript
async insertBatch(events: AnalyticsEvent[]): Promise<void> {
  const values = events.map(e => [
    e.id, e.tenantId, e.eventType, e.entityType, e.entityId,
    e.channel, e.contactId, e.userId, e.sourceType, e.sourceId,
    e.campaignId, e.workflowId, e.sequenceId, e.templateId,
    e.metadata, e.occurredAt
  ]);
  
  await this.clickhouse.insert({
    table: 'analytics_events',
    values,
    format: 'JSONEachRow',
  });
}
```

### Count by Event Type

```typescript
async countByEventType(
  tenantId: string,
  eventTypes: string[],
  startDate: Date,
  endDate: Date,
): Promise<Record<string, number>> {
  const result = await this.clickhouse.query({
    query: `
      SELECT event_type, count() as count
      FROM analytics_events
      WHERE tenant_id = {tenantId:String}
        AND event_type IN {eventTypes:Array(String)}
        AND occurred_at BETWEEN {startDate:DateTime64(3)} AND {endDate:DateTime64(3)}
      GROUP BY event_type
    `,
    query_params: { tenantId, eventTypes, startDate, endDate },
  });
  
  return Object.fromEntries(result.map(r => [r.event_type, r.count]));
}
```

### Count by Time Bucket

```typescript
async countByTimeBucket(
  tenantId: string,
  eventType: string,
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month',
): Promise<{ timestamp: Date; count: number }[]> {
  const truncFunc = {
    hour: 'toStartOfHour',
    day: 'toStartOfDay',
    week: 'toStartOfWeek',
    month: 'toStartOfMonth',
  }[granularity];
  
  const result = await this.clickhouse.query({
    query: `
      SELECT ${truncFunc}(occurred_at) as timestamp, count() as count
      FROM analytics_events
      WHERE tenant_id = {tenantId:String}
        AND event_type = {eventType:String}
        AND occurred_at BETWEEN {startDate:DateTime64(3)} AND {endDate:DateTime64(3)}
      GROUP BY timestamp
      ORDER BY timestamp
    `,
    query_params: { tenantId, eventType, startDate, endDate },
  });
  
  return result;
}
```

## 9. Known Limitations

1. **Eventual Consistency**: Analytics data may lag 5-10 seconds behind source events.
2. **No Real-Time Streaming**: Dashboard requires polling; no WebSocket updates.
3. **Aggregation Only**: Cannot drill down to individual events via API.
4. **TTL**: Data retained for 2 years; older data is automatically deleted.
5. **Single ClickHouse**: No replication; single-node deployment.

## 10. Future Extensions

- [ ] Real-time streaming dashboards via WebSocket
- [ ] Custom report builder
- [ ] Scheduled report delivery via email
- [ ] Cohort analysis
- [ ] Funnel analysis with conversion tracking
- [ ] Anomaly detection and alerting
- [ ] Export to CSV/Excel
- [ ] ClickHouse cluster for high availability
