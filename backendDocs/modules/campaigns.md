# Campaigns Module

## 1. Overview

The Campaigns Module orchestrates multi-channel marketing campaigns across email, SMS, WhatsApp, and push notifications. It manages campaign creation, scheduling, audience targeting, message dispatch, A/B testing, and real-time analytics.

**Key Responsibilities:**
- Campaign lifecycle management (draft → scheduled → running → completed)
- Multi-channel dispatch (email, SMS, WhatsApp, push)
- Audience targeting via segments
- Scheduling with timezone support
- A/B testing with variant management
- Real-time campaign statistics
- Rate limiting and throttling

## 2. Architecture

### Components

| Component                | File                                         | Purpose                              |
|--------------------------|----------------------------------------------|--------------------------------------|
| **Controller**           | `campaigns.controller.ts`                    | REST API endpoints                   |
| **Service**              | `campaigns.service.ts`                       | Business logic                       |
| **Scheduler**            | `services/campaign-scheduler.service.ts`     | Schedule management                  |
| **Sender**               | `services/campaign-sender.service.ts`        | Message dispatch orchestration       |
| **Stats Service**        | `services/campaign-stats.service.ts`         | Real-time analytics                  |
| **Channel Senders**      | `senders/email.sender.ts`, `sms.sender.ts`, etc. | Channel-specific dispatch       |
| **Repository**           | `repositories/campaign.repository.ts`        | Database operations                  |

### Module Dependencies

```
CampaignsModule
├── TypeOrmModule (Campaign entities)
├── TemplatesModule (Template resolution)
├── SegmentsModule (Audience targeting)
├── ContactsModule (Recipient data)
├── PipelineModule (Message queueing)
├── EventBusModule (Event publishing)
├── LoggerModule
└── Exports: CampaignsService, CampaignSchedulerService, CampaignStatsService
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Templates Module   | Inbound   | Resolve and render templates                 |
| Segments Module    | Inbound   | Get audience contacts                        |
| Contacts Module    | Inbound   | Get contact details and channel identifiers  |
| Pipeline Module    | Outbound  | Queue messages for delivery                  |
| Analytics Module   | Outbound  | Campaign performance events                  |
| Inbox Module       | Inbound   | Campaign reply handling                      |

## 3. Database Schema

### Campaign Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| name             | VARCHAR(255)    | No       | -          | Campaign name                  |
| description      | TEXT            | Yes      | null       | Campaign description           |
| channel          | ENUM            | No       | -          | email, sms, whatsapp, push     |
| status           | ENUM            | No       | 'draft'    | draft, scheduled, running, paused, completed, cancelled |
| type             | ENUM            | No       | 'one_time' | one_time, recurring, triggered |
| templateId       | UUID            | Yes      | null       | FK to templates                |
| segmentIds       | UUID[]          | No       | []         | Target segment IDs             |
| excludeSegmentIds| UUID[]          | No       | []         | Exclusion segment IDs          |
| scheduledAt      | TIMESTAMPTZ     | Yes      | null       | Scheduled send time            |
| timezone         | VARCHAR(50)     | Yes      | 'UTC'      | Schedule timezone              |
| recurringSchedule| JSONB           | Yes      | null       | Cron expression for recurring  |
| settings         | JSONB           | No       | {}         | Channel-specific settings      |
| abTestConfig     | JSONB           | Yes      | null       | A/B test configuration         |
| throttleConfig   | JSONB           | Yes      | null       | Rate limiting config           |
| startedAt        | TIMESTAMPTZ     | Yes      | null       | Actual start time              |
| completedAt      | TIMESTAMPTZ     | Yes      | null       | Completion time                |
| createdBy        | UUID            | No       | -          | Creator user ID                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |
| deletedAt        | TIMESTAMPTZ     | Yes      | null       | Soft delete timestamp          |

**Indexes:**
- `idx_campaigns_tenant_status` - (tenantId, status)
- `idx_campaigns_tenant_channel` - (tenantId, channel)
- `idx_campaigns_scheduled` - (status, scheduledAt) WHERE status = 'scheduled'

### CampaignRecipient Entity

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| tenantId         | VARCHAR         | No       | Tenant identifier              |
| campaignId       | UUID            | No       | FK to campaigns                |
| contactId        | UUID            | No       | FK to contacts                 |
| variantId        | VARCHAR(50)     | Yes      | A/B test variant               |
| status           | ENUM            | No       | pending, sent, delivered, opened, clicked, bounced, failed |
| sentAt           | TIMESTAMPTZ     | Yes      | When sent                      |
| deliveredAt      | TIMESTAMPTZ     | Yes      | When delivered                 |
| openedAt         | TIMESTAMPTZ     | Yes      | First open time                |
| clickedAt        | TIMESTAMPTZ     | Yes      | First click time               |
| failedAt         | TIMESTAMPTZ     | Yes      | When failed                    |
| failureReason    | TEXT            | Yes      | Failure description            |
| messageId        | UUID            | Yes      | FK to pipeline_messages        |

**Indexes:**
- `idx_campaign_recipients_campaign_status` - (campaignId, status)
- `idx_campaign_recipients_contact` - (contactId)

### CampaignVariant Entity (A/B Testing)

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| campaignId       | UUID            | No       | FK to campaigns                |
| variantId        | VARCHAR(50)     | No       | Variant identifier (A, B, C)   |
| name             | VARCHAR(100)    | No       | Variant name                   |
| templateId       | UUID            | No       | FK to templates                |
| subject          | VARCHAR(500)    | Yes      | Subject override (email)       |
| weight           | INTEGER         | No       | Traffic percentage (0-100)     |
| isWinner         | BOOLEAN         | No       | false                          |

### CampaignStats Entity (Materialized)

| Column           | Type            | Nullable | Description                    |
|------------------|-----------------|----------|--------------------------------|
| id               | UUID            | No       | Primary key                    |
| campaignId       | UUID            | No       | FK to campaigns                |
| variantId        | VARCHAR(50)     | Yes      | Variant (null for aggregate)   |
| totalRecipients  | INTEGER         | No       | Total recipients               |
| sentCount        | INTEGER         | No       | Messages sent                  |
| deliveredCount   | INTEGER         | No       | Delivered count                |
| openedCount      | INTEGER         | No       | Unique opens                   |
| clickedCount     | INTEGER         | No       | Unique clicks                  |
| bouncedCount     | INTEGER         | No       | Bounced count                  |
| unsubscribedCount| INTEGER         | No       | Unsubscribe count              |
| complaintCount   | INTEGER         | No       | Spam complaints                |
| updatedAt        | TIMESTAMPTZ     | No       | Last calculation               |

## 4. API Endpoints

### Create Campaign

```
POST /api/v1/campaigns
```

**Request Body:**
```json
{
  "name": "January Newsletter",
  "description": "Monthly newsletter for active subscribers",
  "channel": "email",
  "type": "one_time",
  "templateId": "550e8400-e29b-41d4-a716-446655440001",
  "segmentIds": ["550e8400-e29b-41d4-a716-446655440002"],
  "excludeSegmentIds": ["550e8400-e29b-41d4-a716-446655440003"],
  "scheduledAt": "2026-01-28T09:00:00Z",
  "timezone": "America/New_York",
  "settings": {
    "fromName": "Acme Corp",
    "fromEmail": "newsletter@acme.com",
    "replyTo": "support@acme.com",
    "trackOpens": true,
    "trackClicks": true
  },
  "throttleConfig": {
    "messagesPerHour": 10000,
    "messagesPerDay": 100000
  }
}
```

### List Campaigns

```
GET /api/v1/campaigns
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page                 |
| status     | string  | -       | Filter by status               |
| channel    | string  | -       | Filter by channel              |
| search     | string  | -       | Search by name                 |

### Get Campaign

```
GET /api/v1/campaigns/:id
```

### Update Campaign

```
PATCH /api/v1/campaigns/:id
```

### Delete Campaign

```
DELETE /api/v1/campaigns/:id
```

### Schedule Campaign

```
POST /api/v1/campaigns/:id/schedule
```

**Request Body:**
```json
{
  "scheduledAt": "2026-01-28T09:00:00Z",
  "timezone": "America/New_York"
}
```

### Start Campaign Immediately

```
POST /api/v1/campaigns/:id/start
```

### Pause Campaign

```
POST /api/v1/campaigns/:id/pause
```

### Resume Campaign

```
POST /api/v1/campaigns/:id/resume
```

### Cancel Campaign

```
POST /api/v1/campaigns/:id/cancel
```

### Get Campaign Stats

```
GET /api/v1/campaigns/:id/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "550e8400-e29b-41d4-a716-446655440000",
    "totalRecipients": 10000,
    "sentCount": 9800,
    "deliveredCount": 9500,
    "openedCount": 3200,
    "clickedCount": 850,
    "bouncedCount": 200,
    "unsubscribedCount": 15,
    "complaintCount": 2,
    "openRate": 33.68,
    "clickRate": 8.95,
    "bounceRate": 2.04,
    "variants": [
      {"variantId": "A", "openRate": 32.5, "clickRate": 8.2},
      {"variantId": "B", "openRate": 35.1, "clickRate": 9.8, "isWinner": true}
    ]
  }
}
```

### Get Campaign Recipients

```
GET /api/v1/campaigns/:id/recipients
```

### Preview Campaign

```
POST /api/v1/campaigns/:id/preview
```

**Request Body:**
```json
{
  "contactId": "550e8400-e29b-41d4-a716-446655440010"
}
```

### Create A/B Test

```
POST /api/v1/campaigns/:id/ab-test
```

**Request Body:**
```json
{
  "variants": [
    {"variantId": "A", "name": "Short Subject", "subject": "Big Sale!", "weight": 50},
    {"variantId": "B", "name": "Long Subject", "subject": "Exclusive Sale - Up to 70% Off!", "weight": 50}
  ],
  "winnerCriteria": "open_rate",
  "testDurationHours": 4,
  "testSamplePercent": 20
}
```

### Declare A/B Test Winner

```
POST /api/v1/campaigns/:id/ab-test/winner
```

**Request Body:**
```json
{
  "variantId": "B"
}
```

## 5. Event Bus (NATS JetStream)

### Published Events

| Subject                   | Event Type                | Trigger                       |
|---------------------------|---------------------------|-------------------------------|
| `campaign.created`        | CampaignCreatedEvent      | New campaign created          |
| `campaign.scheduled`      | CampaignScheduledEvent    | Campaign scheduled            |
| `campaign.started`        | CampaignStartedEvent      | Campaign execution started    |
| `campaign.paused`         | CampaignPausedEvent       | Campaign paused               |
| `campaign.resumed`        | CampaignResumedEvent      | Campaign resumed              |
| `campaign.completed`      | CampaignCompletedEvent    | All messages sent             |
| `campaign.cancelled`      | CampaignCancelledEvent    | Campaign cancelled            |
| `campaign.message.sent`   | CampaignMessageSentEvent  | Individual message sent       |
| `campaign.message.delivered` | CampaignMessageDeliveredEvent | Message delivered        |
| `campaign.message.opened` | CampaignMessageOpenedEvent | Message opened               |
| `campaign.message.clicked`| CampaignMessageClickedEvent | Link clicked                |
| `campaign.message.bounced`| CampaignMessageBouncedEvent | Message bounced             |

### Event Schema

```typescript
interface CampaignStartedEvent {
  version: string;
  source: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  data: {
    campaignId: string;
    campaignName: string;
    channel: string;
    totalRecipients: number;
    scheduledAt?: string;
    startedAt: string;
  };
}
```

## 6. Logging

```typescript
// Campaign lifecycle
this.logger.log('[LIFECYCLE] campaign status changed', {
  tenantId,
  correlationId,
  campaignId,
  fromStatus: 'scheduled',
  toStatus: 'running',
});

// Batch sending
this.logger.log('[SEND] campaign batch', {
  tenantId,
  campaignId,
  batchNumber: 5,
  batchSize: 1000,
  totalSent: 5000,
  totalRemaining: 4800,
});

// Throttling
this.logger.log('[THROTTLE] campaign rate limited', {
  tenantId,
  campaignId,
  currentRate: 10500,
  maxRate: 10000,
  delayMs: 5000,
});
```

## 7. Background Jobs

| Job Name                    | Schedule       | Description                              |
|-----------------------------|----------------|------------------------------------------|
| `campaign-scheduler`        | Every 1 min    | Check and start scheduled campaigns      |
| `campaign-stats-refresh`    | Every 5 min    | Refresh campaign statistics              |
| `campaign-ab-test-evaluator`| Every 15 min   | Evaluate A/B test winners                |
| `campaign-recurring-trigger`| Every 1 hour   | Trigger recurring campaigns              |

### Scheduler Job

```typescript
@Cron('* * * * *')  // Every minute
async processScheduledCampaigns() {
  const due = await this.campaignRepository.findScheduledDue();
  for (const campaign of due) {
    await this.campaignSenderService.startCampaign(campaign.id);
  }
}
```

## 8. Integration Scenarios

### Scenario 1: Campaign Execution Flow

```
1. POST /api/v1/campaigns/:id/start
2. CampaignsService sets status='running', startedAt=now()
3. Publishes campaign.started event
4. CampaignSenderService.startCampaign():
   a. Get contacts from SegmentsService.getSegmentContacts()
   b. Exclude contacts from excludeSegmentIds
   c. Create CampaignRecipient records with status='pending'
   d. Batch contacts (1000 per batch)
   e. For each batch:
      - Render template for each contact
      - Create PipelineMessage via PipelineModule
      - Update CampaignRecipient status='sent'
5. When all batches complete:
   a. Set campaign status='completed'
   b. Publish campaign.completed event
```

### Scenario 2: A/B Test Workflow

```
1. Create campaign with A/B test configuration
2. Start campaign
3. 20% of recipients (test sample) receive variants A or B
4. Wait for test duration (4 hours)
5. CampaignAbTestService evaluates results:
   - Calculate open rates per variant
   - Determine winner by winnerCriteria
6. Remaining 80% receive winning variant
7. Update CampaignVariant.isWinner = true
```

### Scenario 3: Delivery Tracking

```
1. Campaign message sent → PipelineModule queues message
2. PipelineWorker sends via channel provider
3. Provider webhook: delivered → PipelineModule processes
4. PipelineModule publishes message.delivered event
5. CampaignsService receives event:
   - Updates CampaignRecipient.deliveredAt
   - Increments CampaignStats.deliveredCount
6. Email pixel loaded → tracking endpoint hit
7. CampaignsService.recordOpen():
   - Updates CampaignRecipient.openedAt
   - Publishes campaign.message.opened
```

## 9. Known Limitations

1. **Concurrent Campaigns**: Maximum 5 running campaigns per tenant to prevent resource exhaustion.
2. **Recipient Limit**: Maximum 1 million recipients per campaign.
3. **Throttle Minimum**: Minimum 100 messages per hour to prevent stalls.
4. **A/B Variants**: Maximum 5 variants per A/B test.
5. **Recurring Schedule**: Minimum interval is 1 hour.

## 10. Future Extensions

- [ ] Multi-step campaigns (drip sequences via campaign)
- [ ] Dynamic content blocks
- [ ] Send time optimization per recipient
- [ ] Campaign collaboration and approval workflows
- [ ] Advanced A/B testing (multivariate, bandit algorithms)
- [ ] Campaign templates/presets
- [ ] Automated campaign performance alerts
- [ ] Integration with external ESP APIs
