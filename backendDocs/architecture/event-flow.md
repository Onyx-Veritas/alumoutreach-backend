# Event Flow Architecture

## Overview

AlumOutreach uses NATS JetStream as its event bus for asynchronous communication between modules. This document describes the event flow patterns, subject naming conventions, and cross-module event dependencies.

## Event Bus Infrastructure

### NATS JetStream Configuration

```
Server: nats://localhost:4222
Stream: ALUM_EVENTS
Retention: WorkQueue (for consumers) / Limits (for replay)
Max Age: 7 days
Max Bytes: 10GB
Replicas: 3 (production)
```

### Subject Naming Convention

```
{domain}.{entity}.{action}
```

**Examples:**
- `contact.created` - Contact was created
- `pipeline.message.sent` - Message was sent via pipeline
- `campaign.started` - Campaign started execution
- `workflow.run.completed` - Workflow run finished

## Event Categories

### 1. Contact Events

```
contact.created
contact.updated
contact.deleted
contact.tagged
contact.untagged
contact.consent.granted
contact.consent.revoked
```

**Publishers:** ContactsModule  
**Consumers:** SegmentsModule, WorkflowsModule, AnalyticsModule

### 2. Segment Events

```
segment.created
segment.updated
segment.deleted
segment.evaluated
segment.member.added
segment.member.removed
```

**Publishers:** SegmentsModule  
**Consumers:** WorkflowsModule, CampaignsModule, AnalyticsModule

### 3. Template Events

```
template.created
template.updated
template.activated
template.archived
template.deleted
template.hsm.submitted
template.hsm.approved
template.hsm.rejected
```

**Publishers:** TemplatesModule  
**Consumers:** AnalyticsModule

### 4. Campaign Events

```
campaign.created
campaign.scheduled
campaign.started
campaign.paused
campaign.resumed
campaign.completed
campaign.cancelled
campaign.message.sent
campaign.message.delivered
campaign.message.opened
campaign.message.clicked
campaign.message.bounced
```

**Publishers:** CampaignsModule, PipelineModule  
**Consumers:** AnalyticsModule, InboxModule

### 5. Pipeline Events

```
pipeline.message.queued
pipeline.message.sent
pipeline.message.delivered
pipeline.message.opened
pipeline.message.clicked
pipeline.message.bounced
pipeline.message.failed
pipeline.message.complained
```

**Publishers:** PipelineModule  
**Consumers:** CampaignsModule, SequencesModule, WorkflowsModule, InboxModule, AnalyticsModule

### 6. Workflow Events

```
workflow.created
workflow.activated
workflow.paused
workflow.run.started
workflow.run.completed
workflow.run.failed
workflow.run.goal_reached
workflow.node.executed
```

**Publishers:** WorkflowsModule  
**Consumers:** AnalyticsModule

### 7. Sequence Events

```
sequence.created
sequence.activated
sequence.paused
sequence.enrollment.created
sequence.enrollment.completed
sequence.enrollment.replied
sequence.enrollment.exited
sequence.step.executed
sequence.step.pending_manual
```

**Publishers:** SequencesModule  
**Consumers:** AnalyticsModule

### 8. Inbox Events

```
inbox.thread.created
inbox.thread.updated
inbox.thread.assigned
inbox.message.received
inbox.message.sent
inbox.sla.warning
inbox.sla.breach
```

**Publishers:** InboxModule  
**Consumers:** SequencesModule (reply detection), AnalyticsModule

### 9. Webhook Events

```
webhook.email.inbound
webhook.email.delivered
webhook.email.opened
webhook.email.clicked
webhook.email.bounced
webhook.email.complained
webhook.sms.inbound
webhook.sms.delivered
webhook.whatsapp.inbound
webhook.whatsapp.delivered
webhook.whatsapp.read
```

**Publishers:** WebhookController  
**Consumers:** PipelineModule, InboxModule

## Event Flow Diagrams

### 1. Contact Creation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Contact    │────►│   contact    │────►│   Segments   │
│   Created    │     │   .created   │     │   Module     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            │              segment.member.added
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Analytics   │◄────│  Workflows   │
                     │   Module     │     │   Module     │
                     └──────────────┘     └──────────────┘
                                                 │
                                          workflow.run.started
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   Pipeline   │
                                          │   Module     │
                                          └──────────────┘
```

### 2. Campaign Execution Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Campaign    │────►│  campaign    │────►│  Analytics   │
│  Started     │     │  .started    │     │   Module     │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Pipeline    │────►│  pipeline.   │────►│  Campaigns   │
│  Queue       │     │  message.    │     │  (tracking)  │
│  Messages    │     │  sent        │     └──────────────┘
└──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Analytics   │
                     │   Module     │
                     └──────────────┘
```

### 3. Inbound Message Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Webhook    │────►│  webhook.    │────►│   Pipeline   │
│  Received    │     │  email.      │     │   Module     │
│              │     │  inbound     │     └──────────────┘
└──────────────┘     └──────────────┘            │
                            │              pipeline.message.
                            │              delivered
                            ▼                    │
                     ┌──────────────┐            ▼
                     │    Inbox     │     ┌──────────────┐
                     │   Module     │     │  Campaigns   │
                     └──────────────┘     │  (tracking)  │
                            │             └──────────────┘
                     inbox.message.
                     received
                            │
                            ▼
                     ┌──────────────┐
                     │  Sequences   │
                     │ (reply exit) │
                     └──────────────┘
```

### 4. Workflow Goal Detection Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Contact     │────►│  contact     │────►│  Workflows   │
│  Updated     │     │  .updated    │     │   Module     │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                          Goal Matched?
                                                 │
                            ┌────────────────────┼────────────────────┐
                            │ Yes                │ No                 │
                            ▼                    ▼                    │
                     ┌──────────────┐     ┌──────────────┐           │
                     │  workflow.   │     │  Continue    │           │
                     │  run.goal_   │     │  Execution   │           │
                     │  reached     │     └──────────────┘           │
                     └──────────────┘                                │
                            │                                        │
                            ▼                                        │
                     ┌──────────────┐                                │
                     │  Analytics   │◄───────────────────────────────┘
                     │   Module     │
                     └──────────────┘
```

## Event Schema

### Base Event Structure

All events follow this base structure:

```typescript
interface BaseEvent {
  // Event metadata
  version: string;          // Schema version (e.g., "1.0")
  source: string;           // Source module (e.g., "contacts-service")
  timestamp: string;        // ISO 8601 timestamp
  
  // Tenant & tracing
  tenantId: string;         // Tenant identifier
  correlationId: string;    // Request correlation ID
  
  // Event data
  data: Record<string, unknown>;
}
```

### Example Events

#### contact.created

```json
{
  "version": "1.0",
  "source": "contacts-service",
  "timestamp": "2026-01-27T10:00:00.000Z",
  "tenantId": "tenant-123",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "contactId": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john@example.com",
    "phone": "+1234567890",
    "source": "website_signup",
    "attributes": {
      "company": "Acme Corp"
    }
  }
}
```

#### pipeline.message.sent

```json
{
  "version": "1.0",
  "source": "pipeline-service",
  "timestamp": "2026-01-27T10:00:00.000Z",
  "tenantId": "tenant-123",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "messageId": "550e8400-e29b-41d4-a716-446655440002",
    "channel": "email",
    "contactId": "550e8400-e29b-41d4-a716-446655440001",
    "recipientAddress": "john@example.com",
    "sourceType": "campaign",
    "sourceId": "550e8400-e29b-41d4-a716-446655440003",
    "templateId": "550e8400-e29b-41d4-a716-446655440004",
    "externalId": "provider-msg-12345"
  }
}
```

#### workflow.run.goal_reached

```json
{
  "version": "1.0",
  "source": "workflows-service",
  "timestamp": "2026-01-27T10:00:00.000Z",
  "tenantId": "tenant-123",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "workflowId": "550e8400-e29b-41d4-a716-446655440005",
    "workflowName": "New User Onboarding",
    "runId": "550e8400-e29b-41d4-a716-446655440006",
    "contactId": "550e8400-e29b-41d4-a716-446655440001",
    "goalId": "goal-purchase",
    "goalName": "Made Purchase"
  }
}
```

## Consumer Groups

### Consumer Configuration

Each consuming module uses a durable consumer for reliable delivery:

```typescript
// Durable consumer for segments module
Consumer: SEGMENTS_CONTACT_CONSUMER
Stream: ALUM_EVENTS
Filter: contact.created, contact.updated, contact.deleted
Ack Policy: Explicit
Deliver Policy: All
Max Deliver: 3
Ack Wait: 30s
```

### Consumer Responsibilities

| Consumer | Subscribed Subjects | Processing |
|----------|---------------------|------------|
| SEGMENTS_CONTACT_CONSUMER | contact.* | Evaluate segment membership |
| WORKFLOWS_TRIGGER_CONSUMER | contact.*, segment.member.* | Match workflow triggers |
| ANALYTICS_INGEST_CONSUMER | *.* (all) | Ingest to ClickHouse |
| INBOX_WEBHOOK_CONSUMER | webhook.*.inbound | Create inbox threads |
| SEQUENCES_REPLY_CONSUMER | inbox.message.received | Detect sequence replies |
| CAMPAIGNS_TRACKING_CONSUMER | pipeline.message.* | Update campaign stats |

## Error Handling

### Retry Strategy

```typescript
// Consumer retry configuration
{
  maxDeliver: 3,        // Maximum delivery attempts
  ackWait: 30_000,      // 30 seconds to acknowledge
  backoff: [
    1_000,              // 1 second
    5_000,              // 5 seconds
    30_000,             // 30 seconds
  ],
}
```

### Dead Letter Queue

Failed events after max retries are moved to:

```
Stream: ALUM_EVENTS_DLQ
Subjects: dlq.{original_subject}
```

### Error Event

```json
{
  "originalEvent": { ... },
  "error": {
    "message": "Failed to process event",
    "code": "PROCESSING_ERROR",
    "attempts": 3,
    "lastAttempt": "2026-01-27T10:00:00.000Z"
  }
}
```

## Monitoring

### Key Metrics

| Metric | Description |
|--------|-------------|
| `events_published_total` | Total events published by subject |
| `events_consumed_total` | Total events consumed by consumer |
| `events_acked_total` | Successfully processed events |
| `events_nacked_total` | Failed events (will retry) |
| `events_dlq_total` | Events moved to DLQ |
| `consumer_lag` | Number of pending messages per consumer |
| `event_processing_duration` | Time to process events |

### Alerting Rules

```yaml
- alert: EventConsumerLagHigh
  expr: nats_consumer_pending > 10000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Event consumer lag is high"

- alert: EventDLQGrowing
  expr: rate(events_dlq_total[5m]) > 0.1
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Events are being moved to DLQ"
```

## Best Practices

### Publishing Events

1. **Include correlation ID** for request tracing
2. **Use ISO 8601 timestamps** for consistency
3. **Keep payloads small** (< 1MB)
4. **Include minimal but complete data** needed by consumers

### Consuming Events

1. **Process idempotently** - events may be redelivered
2. **Acknowledge promptly** after successful processing
3. **Use appropriate consumer groups** for scaling
4. **Log processing start/end** for observability

### Schema Evolution

1. **Version events** in the `version` field
2. **Add fields, don't remove** (backward compatible)
3. **Deprecate before removing** old fields
4. **Document breaking changes** in changelog
