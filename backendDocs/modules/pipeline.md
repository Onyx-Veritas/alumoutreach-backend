# Pipeline Module

## 1. Overview

The Pipeline Module is the core message processing infrastructure of AlumOutreach. It provides a reliable, scalable queue for all outbound messages across all channels. The module handles message queuing, worker processing, retry logic, rate limiting, and delivery tracking.

**Key Responsibilities:**
- Message queue management (FIFO with priority)
- Worker-based message processing
- Channel-specific delivery (email, SMS, WhatsApp, push)
- Retry logic with exponential backoff
- Rate limiting per channel and tenant
- Delivery status tracking
- Dead letter queue for failed messages

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `pipeline.controller.ts`                       | REST API for queue management        |
| **Service**              | `pipeline.service.ts`                          | Queue operations                     |
| **Worker Service**       | `services/pipeline-worker.service.ts`          | Message processing workers           |
| **Retry Service**        | `services/pipeline-retry.service.ts`           | Retry logic                          |
| **Rate Limiter**         | `services/pipeline-rate-limiter.service.ts`    | Rate limiting                        |
| **Repository**           | `repositories/pipeline.repository.ts`          | Database operations                  |
| **Channel Senders**      | `senders/*.sender.ts`                          | Channel-specific delivery            |

### Module Dependencies

```
PipelineModule
├── TypeOrmModule (Pipeline entities)
├── RedisModule (Rate limiting, locks)
├── TemplatesModule (Template rendering)
├── ContactsModule (Recipient resolution)
├── EventBusModule (Event publishing)
├── LoggerModule
└── Exports: PipelineService, PipelineWorkerService, PipelineRetryService
```

### Message Flow

```
┌─────────────────┐    ┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│   Campaigns     │───►│   Queue     │───►│    Worker     │───►│   Channel   │
│   Workflows     │    │  (pending)  │    │  (processing) │    │   Sender    │
│   Sequences     │    └─────────────┘    └───────────────┘    └─────────────┘
│   Direct Send   │                              │                    │
└─────────────────┘                              ▼                    ▼
                                          ┌─────────────┐    ┌─────────────┐
                                          │   Retry     │    │   Webhook   │
                                          │   Queue     │    │   Handler   │
                                          └─────────────┘    └─────────────┘
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Campaigns Module   | Inbound   | Queue campaign messages                      |
| Workflows Module   | Inbound   | Queue workflow action messages               |
| Sequences Module   | Inbound   | Queue sequence step messages                 |
| Templates Module   | Inbound   | Render templates before send                 |
| Contacts Module    | Inbound   | Resolve recipient details                    |
| Analytics Module   | Outbound  | Delivery metrics                             |
| Inbox Module       | Outbound  | Delivery status for inbox threads            |

## 3. Database Schema

### PipelineMessage Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| channel          | ENUM            | No       | -          | email, sms, whatsapp, push     |
| status           | ENUM            | No       | 'pending'  | pending, processing, sent, delivered, failed, cancelled |
| priority         | INTEGER         | No       | 0          | Higher = higher priority       |
| contactId        | UUID            | No       | -          | FK to contacts                 |
| recipientAddress | VARCHAR(255)    | No       | -          | Email/phone/device token       |
| sourceType       | ENUM            | No       | -          | campaign, workflow, sequence, direct |
| sourceId         | UUID            | Yes      | null       | FK to source entity            |
| templateId       | UUID            | Yes      | null       | FK to templates                |
| subject          | VARCHAR(500)    | Yes      | null       | Message subject (email)        |
| body             | TEXT            | No       | -          | Rendered message body          |
| bodyHtml         | TEXT            | Yes      | null       | HTML body (email)              |
| metadata         | JSONB           | No       | {}         | Channel-specific metadata      |
| scheduledAt      | TIMESTAMPTZ     | Yes      | null       | Delayed send time              |
| sentAt           | TIMESTAMPTZ     | Yes      | null       | When sent                      |
| deliveredAt      | TIMESTAMPTZ     | Yes      | null       | When delivered                 |
| failedAt         | TIMESTAMPTZ     | Yes      | null       | When failed                    |
| externalId       | VARCHAR(255)    | Yes      | null       | Provider message ID            |
| retryCount       | INTEGER         | No       | 0          | Retry attempts                 |
| maxRetries       | INTEGER         | No       | 3          | Maximum retries                |
| nextRetryAt      | TIMESTAMPTZ     | Yes      | null       | Next retry time                |
| errorMessage     | TEXT            | Yes      | null       | Last error message             |
| errorCode        | VARCHAR(50)     | Yes      | null       | Error code                     |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |

**Indexes:**
- `idx_pipeline_tenant_status_priority` - (tenantId, status, priority DESC)
- `idx_pipeline_tenant_channel_status` - (tenantId, channel, status)
- `idx_pipeline_scheduled` - (status, scheduledAt) WHERE scheduledAt IS NOT NULL
- `idx_pipeline_retry` - (status, nextRetryAt) WHERE status = 'pending' AND nextRetryAt IS NOT NULL
- `idx_pipeline_external_id` - (externalId) WHERE externalId IS NOT NULL
- `idx_pipeline_source` - (sourceType, sourceId)

### PipelineDeliveryLog Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| messageId        | UUID            | No       | FK to pipeline_messages        |
| event            | ENUM            | No       | sent, delivered, opened, clicked, bounced, complained, unsubscribed |
| occurredAt       | TIMESTAMPTZ     | No       | Event timestamp                |
| metadata         | JSONB           | No       | Event-specific data            |
| ipAddress        | VARCHAR(45)     | Yes      | Recipient IP (opens/clicks)    |
| userAgent        | TEXT            | Yes      | Recipient user agent           |
| linkUrl          | TEXT            | Yes      | Clicked URL                    |

**Indexes:**
- `idx_delivery_log_message` - (messageId, occurredAt DESC)
- `idx_delivery_log_event` - (event, occurredAt)

### PipelineDeadLetter Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| tenantId         | VARCHAR         | No       | Tenant identifier              |
| originalMessageId| UUID            | No       | Original message ID            |
| channel          | ENUM            | No       | Message channel                |
| payload          | JSONB           | No       | Full message payload           |
| errorMessage     | TEXT            | No       | Final error message            |
| errorCode        | VARCHAR(50)     | Yes      | Error code                     |
| failedAt         | TIMESTAMPTZ     | No       | When moved to DLQ              |
| retriedAt        | TIMESTAMPTZ     | Yes      | If manually retried            |
| resolvedAt       | TIMESTAMPTZ     | Yes      | If resolved                    |

## 4. API Endpoints

### Queue Message

```
POST /api/v1/pipeline/messages
```

**Request Body:**
```json
{
  "channel": "email",
  "contactId": "550e8400-e29b-41d4-a716-446655440010",
  "templateId": "550e8400-e29b-41d4-a716-446655440001",
  "context": {
    "first_name": "John",
    "company_name": "Acme Corp"
  },
  "sourceType": "direct",
  "priority": 10,
  "scheduledAt": "2026-01-28T09:00:00Z",
  "metadata": {
    "fromName": "Acme Support",
    "fromEmail": "support@acme.com"
  }
}
```

### Queue Batch Messages

```
POST /api/v1/pipeline/messages/batch
```

**Request Body:**
```json
{
  "messages": [
    {
      "channel": "email",
      "contactId": "...",
      "templateId": "...",
      "context": {}
    }
  ],
  "sourceType": "campaign",
  "sourceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Get Message Status

```
GET /api/v1/pipeline/messages/:id
```

### Cancel Message

```
POST /api/v1/pipeline/messages/:id/cancel
```

### Retry Message

```
POST /api/v1/pipeline/messages/:id/retry
```

### Get Queue Stats

```
GET /api/v1/pipeline/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 5420,
    "processing": 150,
    "sent": 125000,
    "delivered": 120000,
    "failed": 500,
    "byChannel": {
      "email": {"pending": 3000, "processing": 100},
      "sms": {"pending": 1500, "processing": 30},
      "whatsapp": {"pending": 900, "processing": 20},
      "push": {"pending": 20, "processing": 0}
    },
    "throughput": {
      "lastMinute": 250,
      "lastHour": 12500,
      "last24Hours": 125000
    }
  }
}
```

### Get Dead Letter Queue

```
GET /api/v1/pipeline/dlq
```

### Retry Dead Letter Message

```
POST /api/v1/pipeline/dlq/:id/retry
```

### Purge Dead Letter Queue

```
DELETE /api/v1/pipeline/dlq
```

### Pause Queue Processing

```
POST /api/v1/pipeline/pause
```

### Resume Queue Processing

```
POST /api/v1/pipeline/resume
```

## 5. Event Bus (NATS JetStream)

### Published Events

| Subject                    | Event Type                  | Trigger                       |
|----------------------------|-----------------------------|-------------------------------|
| `pipeline.message.queued`  | MessageQueuedEvent          | Message added to queue        |
| `pipeline.message.sent`    | MessageSentEvent            | Message sent to provider      |
| `pipeline.message.delivered` | MessageDeliveredEvent     | Delivery confirmed            |
| `pipeline.message.opened`  | MessageOpenedEvent          | Message opened (tracking)     |
| `pipeline.message.clicked` | MessageClickedEvent         | Link clicked (tracking)       |
| `pipeline.message.bounced` | MessageBouncedEvent         | Message bounced               |
| `pipeline.message.failed`  | MessageFailedEvent          | Message failed permanently    |
| `pipeline.message.complained` | MessageComplainedEvent   | Spam complaint received       |

### Subscribed Events

| Subject               | Action                                    |
|-----------------------|-------------------------------------------|
| `webhook.email.*`     | Process email provider webhooks           |
| `webhook.sms.*`       | Process SMS provider webhooks             |
| `webhook.whatsapp.*`  | Process WhatsApp webhooks                 |

### Event Schema

```typescript
interface MessageSentEvent {
  version: string;
  source: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  data: {
    messageId: string;
    channel: string;
    contactId: string;
    recipientAddress: string;
    sourceType: string;
    sourceId?: string;
    externalId: string;
  };
}
```

## 6. Logging

```typescript
// Message processing
this.logger.log('[PROCESS] message started', {
  tenantId,
  correlationId,
  messageId,
  channel,
  priority,
});

// Successful send
this.logger.log('[SENT] message delivered to provider', {
  tenantId,
  correlationId,
  messageId,
  channel,
  externalId: providerResponse.id,
  duration: Date.now() - startTime,
});

// Retry scheduled
this.logger.log('[RETRY] message scheduled for retry', {
  tenantId,
  messageId,
  retryCount: message.retryCount + 1,
  nextRetryAt,
  errorCode,
});

// Dead letter
this.logger.log('[DLQ] message moved to dead letter queue', {
  tenantId,
  messageId,
  errorMessage,
  totalRetries: message.retryCount,
});
```

## 7. Background Jobs

| Job Name                    | Schedule       | Description                              |
|-----------------------------|----------------|------------------------------------------|
| `pipeline-worker`           | Continuous     | Process pending messages                 |
| `pipeline-retry-processor`  | Every 1 min    | Process retry queue                      |
| `pipeline-scheduled-sender` | Every 1 min    | Process scheduled messages               |
| `pipeline-stale-detector`   | Every 5 min    | Detect stuck processing messages         |
| `pipeline-stats-calculator` | Every 5 min    | Calculate throughput stats               |

### Worker Job

```typescript
// Continuous worker loop
async processMessages() {
  while (this.isRunning) {
    const messages = await this.repository.fetchPendingBatch(100);
    if (messages.length === 0) {
      await this.sleep(1000);
      continue;
    }
    await Promise.all(messages.map(m => this.processMessage(m)));
  }
}
```

### Retry Processor

```typescript
@Cron('* * * * *')  // Every minute
async processRetries() {
  const messages = await this.repository.findDueRetries();
  for (const message of messages) {
    await this.pipelineService.retryMessage(message.id);
  }
}
```

## 8. Rate Limiting

### Configuration

```typescript
interface RateLimitConfig {
  email: {
    perSecond: 50,
    perMinute: 2000,
    perHour: 50000,
    perDay: 500000
  },
  sms: {
    perSecond: 10,
    perMinute: 500,
    perHour: 10000,
    perDay: 100000
  },
  whatsapp: {
    perSecond: 20,
    perMinute: 1000,
    perHour: 20000,
    perDay: 200000
  },
  push: {
    perSecond: 100,
    perMinute: 5000,
    perHour: 100000,
    perDay: 1000000
  }
}
```

### Implementation

```typescript
async checkRateLimit(tenantId: string, channel: string): Promise<boolean> {
  const key = `rate:${tenantId}:${channel}`;
  const current = await this.redis.incr(key);
  if (current === 1) {
    await this.redis.expire(key, 1); // 1 second window
  }
  return current <= this.limits[channel].perSecond;
}
```

## 9. Retry Strategy

### Exponential Backoff

```typescript
calculateNextRetry(retryCount: number): Date {
  const baseDelay = 60; // 1 minute
  const maxDelay = 3600; // 1 hour
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  const jitter = Math.random() * 0.1 * delay; // 10% jitter
  return new Date(Date.now() + (delay + jitter) * 1000);
}
```

### Retry Schedule

| Retry # | Delay (approx) | Total Time |
|---------|----------------|------------|
| 1       | 1 minute       | 1 minute   |
| 2       | 2 minutes      | 3 minutes  |
| 3       | 4 minutes      | 7 minutes  |
| 4       | 8 minutes      | 15 minutes |
| 5       | 16 minutes     | 31 minutes |
| 6       | 32 minutes     | ~1 hour    |
| 7       | 60 minutes     | ~2 hours   |

### Non-Retryable Errors

| Error Code     | Description                    |
|----------------|--------------------------------|
| `INVALID_RECIPIENT` | Invalid email/phone format |
| `UNSUBSCRIBED` | Recipient unsubscribed         |
| `BLOCKED`      | Recipient blocked sender       |
| `HARD_BOUNCE`  | Permanent delivery failure     |
| `SPAM_COMPLAINT` | Spam complaint received      |

## 10. Integration Scenarios

### Scenario 1: Campaign Message Flow

```
1. CampaignSenderService calls PipelineService.queueBatch()
2. PipelineService creates PipelineMessage records with status='pending'
3. Publishes pipeline.message.queued events
4. PipelineWorker picks up messages in priority order
5. For each message:
   a. Check rate limits
   b. Render template with contact data
   c. Call channel sender (EmailSender, SmsSender, etc.)
   d. Update status to 'sent'
   e. Store externalId from provider
   f. Publish pipeline.message.sent event
6. Provider webhook triggers delivery update
7. PipelineService updates status to 'delivered'
```

### Scenario 2: Webhook Processing

```
1. Email provider sends delivery webhook
2. WebhookController receives and validates signature
3. Publishes webhook.email.delivered event
4. PipelineService subscribes and processes:
   a. Looks up message by externalId
   b. Creates PipelineDeliveryLog entry
   c. Updates message status
   d. Publishes pipeline.message.delivered event
5. CampaignsModule receives event and updates CampaignRecipient
```

### Scenario 3: Retry Flow

```
1. SmsSender receives temporary error (rate limited by provider)
2. PipelineWorkerService catches retryable error
3. Increments message.retryCount
4. Calculates nextRetryAt using exponential backoff
5. Sets status back to 'pending' with nextRetryAt
6. Logs retry scheduled
7. PipelineRetryProcessor job picks up at nextRetryAt
8. Attempts redelivery
9. If max retries exceeded, moves to dead letter queue
```

## 11. Known Limitations

1. **Single Region**: Queue is single-region; no cross-region failover.
2. **Message Size**: Maximum message body size is 1MB.
3. **Batch Size**: Maximum 1000 messages per batch.
4. **Priority Levels**: 0-100 only; higher values clamped.
5. **Scheduled Delay**: Maximum scheduled delay is 30 days.

## 12. Future Extensions

- [ ] Multi-region queue with geo-routing
- [ ] Message deduplication by content hash
- [ ] Priority queues per channel
- [ ] Dynamic rate limiting based on provider feedback
- [ ] Message compression for large bodies
- [ ] Webhook signature verification improvements
- [ ] Real-time throughput monitoring dashboard
- [ ] Automatic provider failover
