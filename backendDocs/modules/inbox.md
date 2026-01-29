# Inbox Module

## 1. Overview

The Inbox Module provides a unified inbox experience for all inbound and outbound communications across email, SMS, WhatsApp, and other channels. It enables conversation threading, message routing, agent assignment, SLA tracking, and real-time collaboration.

**Key Responsibilities:**
- Unified inbox across all channels
- Conversation threading by contact
- Message ingestion from webhooks
- Agent assignment and routing
- SLA tracking and escalation
- Canned responses
- Conversation tagging and prioritization
- Real-time message updates

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `inbox.controller.ts`                          | REST API endpoints                   |
| **Service**              | `inbox.service.ts`                             | Inbox business logic                 |
| **Ingestion Service**    | `services/inbox-ingestion.service.ts`          | Message ingestion                    |
| **Distribution Service** | `services/inbox-distribution.service.ts`       | Agent routing                        |
| **Thread Service**       | `services/inbox-thread.service.ts`             | Thread management                    |
| **Repository**           | `repositories/inbox.repository.ts`             | Database operations                  |

### Module Dependencies

```
InboxModule
├── TypeOrmModule (Inbox entities)
├── ContactsModule (Contact resolution)
├── PipelineModule (Outbound messages)
├── TemplatesModule (Canned responses)
├── EventBusModule (Real-time events)
├── RedisModule (Assignment locks)
├── LoggerModule
└── Exports: InboxService, InboxIngestionService, InboxDistributionService
```

### Message Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Webhook       │───►│   Ingestion     │───►│   Thread        │
│   (Inbound)     │    │   Service       │    │   Resolution    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent         │◄───│   Distribution  │◄───│   Create        │
│   Inbox         │    │   Service       │    │   Message       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Contacts Module    | Inbound   | Resolve contact from channel identifier      |
| Pipeline Module    | Outbound  | Send replies                                 |
| Templates Module   | Inbound   | Canned response templates                    |
| Sequences Module   | Outbound  | Notify of replies to sequence emails         |
| Campaigns Module   | Outbound  | Notify of campaign replies                   |
| Analytics Module   | Outbound  | Conversation metrics                         |

## 3. Database Schema

### InboxThread Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| contactId        | UUID            | No       | FK to contacts                 |
| channel          | ENUM            | No       | -          | email, sms, whatsapp           |
| subject          | VARCHAR(500)    | Yes      | null       | Thread subject (email)         |
| status           | ENUM            | No       | 'open'     | open, pending, resolved, closed |
| priority         | ENUM            | No       | 'normal'   | low, normal, high, urgent      |
| assignedTo       | UUID            | Yes      | null       | Assigned agent user ID         |
| assignedTeam     | VARCHAR(100)    | Yes      | null       | Assigned team                  |
| firstMessageAt   | TIMESTAMPTZ     | No       | now()      | First message time             |
| lastMessageAt    | TIMESTAMPTZ     | No       | now()      | Last message time              |
| lastAgentReplyAt | TIMESTAMPTZ     | Yes      | null       | Last agent reply time          |
| slaDeadlineAt    | TIMESTAMPTZ     | Yes      | null       | SLA deadline                   |
| slaBreach        | BOOLEAN         | No       | false      | Whether SLA breached           |
| messageCount     | INTEGER         | No       | 1          | Total messages                 |
| unreadCount      | INTEGER         | No       | 1          | Unread messages                |
| tags             | VARCHAR[]       | No       | []         | Thread tags                    |
| metadata         | JSONB           | No       | {}         | Channel-specific metadata      |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |

**Indexes:**
- `idx_threads_tenant_status` - (tenantId, status)
- `idx_threads_tenant_assigned` - (tenantId, assignedTo, status)
- `idx_threads_tenant_team` - (tenantId, assignedTeam, status)
- `idx_threads_contact` - (contactId)
- `idx_threads_sla` - (slaDeadlineAt) WHERE status = 'open'

### InboxMessage Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| threadId         | UUID            | No       | FK to inbox_threads            |
| direction        | ENUM            | No       | -          | inbound, outbound              |
| channel          | ENUM            | No       | -          | email, sms, whatsapp           |
| fromAddress      | VARCHAR(255)    | No       | -          | Sender address                 |
| toAddress        | VARCHAR(255)    | No       | -          | Recipient address              |
| subject          | VARCHAR(500)    | Yes      | null       | Message subject                |
| body             | TEXT            | No       | -          | Message body (plain text)      |
| bodyHtml         | TEXT            | Yes      | null       | HTML body (email)              |
| attachments      | JSONB           | No       | []         | Attachment metadata            |
| externalId       | VARCHAR(255)    | Yes      | null       | Provider message ID            |
| inReplyTo        | VARCHAR(255)    | Yes      | null       | Reply-to message ID            |
| sentBy           | UUID            | Yes      | null       | Agent who sent (outbound)      |
| sentAt           | TIMESTAMPTZ     | No       | now()      | Send timestamp                 |
| deliveredAt      | TIMESTAMPTZ     | Yes      | null       | Delivery timestamp             |
| readAt           | TIMESTAMPTZ     | Yes      | null       | Read timestamp                 |
| isInternal       | BOOLEAN         | No       | false      | Internal note                  |
| metadata         | JSONB           | No       | {}         | Channel metadata               |

**Indexes:**
- `idx_messages_thread` - (threadId, sentAt DESC)
- `idx_messages_external_id` - (externalId)

### InboxAssignment Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| threadId         | UUID            | No       | FK to inbox_threads            |
| userId           | UUID            | No       | Assigned user ID               |
| assignedBy       | UUID            | No       | Who assigned                   |
| assignedAt       | TIMESTAMPTZ     | No       | now()      | Assignment time                |
| unassignedAt     | TIMESTAMPTZ     | Yes      | null       | Unassignment time              |
| reason           | VARCHAR(100)    | Yes      | null       | Assignment reason              |

### InboxCannedResponse Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| shortcut         | VARCHAR(50)     | No       | -          | Keyboard shortcut              |
| name             | VARCHAR(255)    | No       | -          | Response name                  |
| content          | TEXT            | No       | -          | Response content               |
| category         | VARCHAR(100)    | Yes      | null       | Category                       |
| isShared         | BOOLEAN         | No       | true       | Shared with team               |
| createdBy        | UUID            | No       | -          | Creator user ID                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |

### InboxSlaPolicy Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| name             | VARCHAR(255)    | No       | -          | Policy name                    |
| priority         | ENUM            | No       | -          | Priority level                 |
| firstResponseMin | INTEGER         | No       | -          | First response SLA (minutes)   |
| resolutionMin    | INTEGER         | No       | -          | Resolution SLA (minutes)       |
| businessHoursOnly| BOOLEAN         | No       | true       | Count business hours only      |
| isDefault        | BOOLEAN         | No       | false      | Default policy                 |

## 4. API Endpoints

### List Threads

```
GET /api/v1/inbox/threads
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page                 |
| status     | string  | -       | Filter by status               |
| channel    | string  | -       | Filter by channel              |
| assignedTo | string  | -       | Filter by assigned agent       |
| assignedTeam | string| -       | Filter by team                 |
| priority   | string  | -       | Filter by priority             |
| unreadOnly | boolean | false   | Only show unread               |
| search     | string  | -       | Search in subject/body         |

### Get Thread

```
GET /api/v1/inbox/threads/:id
```

### Get Thread Messages

```
GET /api/v1/inbox/threads/:id/messages
```

### Reply to Thread

```
POST /api/v1/inbox/threads/:id/reply
```

**Request Body:**
```json
{
  "body": "Thank you for reaching out! I'd be happy to help...",
  "bodyHtml": "<p>Thank you for reaching out! I'd be happy to help...</p>",
  "attachments": [
    {"filename": "guide.pdf", "url": "https://..."}
  ]
}
```

### Add Internal Note

```
POST /api/v1/inbox/threads/:id/notes
```

**Request Body:**
```json
{
  "body": "Customer called and confirmed shipping address"
}
```

### Assign Thread

```
POST /api/v1/inbox/threads/:id/assign
```

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440020",
  "reason": "manual"
}
```

### Assign to Team

```
POST /api/v1/inbox/threads/:id/assign-team
```

**Request Body:**
```json
{
  "team": "support-tier-2"
}
```

### Update Thread Status

```
PATCH /api/v1/inbox/threads/:id/status
```

**Request Body:**
```json
{
  "status": "resolved"
}
```

### Update Thread Priority

```
PATCH /api/v1/inbox/threads/:id/priority
```

**Request Body:**
```json
{
  "priority": "urgent"
}
```

### Add Tags

```
POST /api/v1/inbox/threads/:id/tags
```

**Request Body:**
```json
{
  "tags": ["billing", "refund-request"]
}
```

### Mark as Read

```
POST /api/v1/inbox/threads/:id/read
```

### Mark as Unread

```
POST /api/v1/inbox/threads/:id/unread
```

### Get Inbox Stats

```
GET /api/v1/inbox/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "open": 250,
    "pending": 100,
    "resolved": 1100,
    "byChannel": {
      "email": {"open": 150, "pending": 60},
      "whatsapp": {"open": 80, "pending": 30},
      "sms": {"open": 20, "pending": 10}
    },
    "byPriority": {
      "urgent": 15,
      "high": 45,
      "normal": 170,
      "low": 20
    },
    "unassigned": 35,
    "slaBreach": 8,
    "avgFirstResponseMin": 12,
    "avgResolutionMin": 145
  }
}
```

### Get Agent Stats

```
GET /api/v1/inbox/stats/agents
```

### List Canned Responses

```
GET /api/v1/inbox/canned-responses
```

### Create Canned Response

```
POST /api/v1/inbox/canned-responses
```

**Request Body:**
```json
{
  "shortcut": "/refund",
  "name": "Refund Process",
  "content": "I understand you'd like a refund. Our refund policy allows...",
  "category": "billing"
}
```

### Get SLA Policies

```
GET /api/v1/inbox/sla-policies
```

### Create SLA Policy

```
POST /api/v1/inbox/sla-policies
```

## 5. Event Bus (NATS JetStream)

### Subscribed Events

| Subject                  | Action                                    |
|--------------------------|-------------------------------------------|
| `webhook.email.inbound`  | Create/update thread with email           |
| `webhook.sms.inbound`    | Create/update thread with SMS             |
| `webhook.whatsapp.inbound`| Create/update thread with WhatsApp       |
| `pipeline.message.delivered`| Update outbound message delivery status|

### Published Events

| Subject                    | Event Type                  | Trigger                       |
|----------------------------|-----------------------------|-------------------------------|
| `inbox.thread.created`     | InboxThreadCreatedEvent     | New thread created            |
| `inbox.thread.updated`     | InboxThreadUpdatedEvent     | Thread status/assignment changed |
| `inbox.thread.assigned`    | InboxThreadAssignedEvent    | Thread assigned to agent      |
| `inbox.message.received`   | InboxMessageReceivedEvent   | Inbound message received      |
| `inbox.message.sent`       | InboxMessageSentEvent       | Outbound message sent         |
| `inbox.sla.warning`        | InboxSlaWarningEvent        | SLA approaching deadline      |
| `inbox.sla.breach`         | InboxSlaBreachEvent         | SLA deadline breached         |

## 6. Logging

```typescript
// Inbound message
this.logger.log('[INGEST] inbound message received', {
  tenantId,
  correlationId,
  channel,
  from: fromAddress,
  threadId,
  isNewThread,
});

// Assignment
this.logger.log('[ASSIGN] thread assigned to agent', {
  tenantId,
  threadId,
  assignedTo,
  assignedBy,
  reason,
});

// Reply sent
this.logger.log('[REPLY] outbound message sent', {
  tenantId,
  threadId,
  messageId,
  channel,
  sentBy,
});
```

## 7. Background Jobs

| Job Name                    | Schedule       | Description                              |
|-----------------------------|----------------|------------------------------------------|
| `inbox-sla-checker`         | Every 5 min    | Check SLA deadlines and trigger alerts   |
| `inbox-auto-close`          | Every 1 hour   | Auto-close stale resolved threads        |
| `inbox-stats-calculator`    | Every 5 min    | Calculate inbox statistics               |
| `inbox-auto-assign`         | Every 1 min    | Auto-assign unassigned threads           |

### SLA Checker

```typescript
@Cron('*/5 * * * *')  // Every 5 minutes
async checkSlaDeadlines() {
  const atRisk = await this.threadRepository.findSlaAtRisk(15); // 15 min warning
  for (const thread of atRisk) {
    await this.eventBus.publish('inbox.sla.warning', { threadId: thread.id });
  }
  
  const breached = await this.threadRepository.findSlaBreached();
  for (const thread of breached) {
    await this.threadRepository.update(thread.id, { slaBreach: true });
    await this.eventBus.publish('inbox.sla.breach', { threadId: thread.id });
  }
}
```

## 8. Integration Scenarios

### Scenario 1: Inbound Email Processing

```
1. Email provider webhook hits /webhooks/email/inbound
2. WebhookController validates and publishes webhook.email.inbound
3. InboxIngestionService receives event
4. Extracts from/to addresses, subject, body
5. ContactsService.findByChannelIdentifier('email', from)
   - If not found, creates new contact
6. InboxThreadService.findOrCreateThread(contactId, 'email', inReplyTo)
   - If In-Reply-To matches existing, adds to thread
   - Otherwise creates new thread
7. Creates InboxMessage with direction='inbound'
8. InboxDistributionService.assignThread(thread)
   - Applies routing rules
   - Assigns to agent or team
9. Publishes inbox.message.received event
10. Real-time notification to assigned agent
```

### Scenario 2: Agent Reply Flow

```
1. Agent clicks Reply in inbox UI
2. POST /api/v1/inbox/threads/:id/reply
3. InboxService validates thread and agent permission
4. Creates InboxMessage with direction='outbound'
5. PipelineService.queue() queues message for delivery
6. Updates thread:
   - lastAgentReplyAt = now
   - status = 'pending' (awaiting customer response)
7. Publishes inbox.message.sent event
8. Pipeline delivers message
9. Webhook callback updates deliveredAt
```

### Scenario 3: Auto-Assignment

```
1. New thread created with assignedTo = null
2. InboxDistributionService.autoAssign(thread)
3. Evaluates routing rules:
   a. By channel (WhatsApp → Team A)
   b. By priority (Urgent → Senior agents)
   c. By tag (Billing → Finance team)
4. Selects agent using round-robin within team
5. Checks agent capacity (max concurrent threads)
6. If capacity available:
   - Assigns thread
   - Publishes inbox.thread.assigned
7. If no capacity:
   - Remains in team queue
```

## 9. Known Limitations

1. **No Real-Time WebSocket**: Polling required for inbox updates; no WebSocket push.
2. **Single Assignment**: Thread can only be assigned to one agent at a time.
3. **Attachment Size**: Maximum 25MB per attachment.
4. **Thread Merge**: Cannot merge duplicate threads.
5. **SLA Business Hours**: SLA calculation requires business hours configuration.

## 10. Future Extensions

- [ ] WebSocket-based real-time updates
- [ ] Thread merging for duplicate contacts
- [ ] Customer satisfaction surveys
- [ ] AI-powered suggested responses
- [ ] Sentiment analysis on incoming messages
- [ ] Automated ticket categorization
- [ ] Collision detection (multiple agents typing)
- [ ] Integration with phone/voice channels
