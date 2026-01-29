# Sequences Module

## 1. Overview

The Sequences Module provides time-based, step-by-step sales engagement automation. Unlike workflows which are event-driven, sequences are linear progressions designed for sales outreach with manual touchpoints, reply detection, and meeting scheduling integration.

**Key Responsibilities:**
- Sequence definition with ordered steps
- Step types: automated emails, manual tasks, calls, LinkedIn actions
- Reply detection and automatic exit
- Business hours and timezone awareness
- A/B testing on step variations
- Integration with calendar for meeting detection
- Sequence analytics and performance tracking

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `sequences.controller.ts`                      | REST API endpoints                   |
| **Service**              | `sequences.service.ts`                         | Sequence CRUD and management         |
| **Executor**             | `services/sequence-executor.service.ts`        | Step execution engine                |
| **Scheduler**            | `services/sequence-scheduler.service.ts`       | Step scheduling                      |
| **Reply Detector**       | `services/sequence-reply-detector.service.ts`  | Reply detection and exit             |
| **Repository**           | `repositories/sequence.repository.ts`          | Database operations                  |

### Module Dependencies

```
SequencesModule
├── TypeOrmModule (Sequence entities)
├── ContactsModule (Contact operations)
├── TemplatesModule (Template resolution)
├── PipelineModule (Message sending)
├── InboxModule (Reply detection)
├── EventBusModule (Event publishing)
├── RedisModule (Scheduling)
├── LoggerModule
└── Exports: SequencesService, SequenceExecutorService, SequenceSchedulerService
```

### Execution Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Enroll        │───►│   Schedule      │───►│   Execute       │
│   Contact       │    │   First Step    │    │   Step          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                              ┌─────────────────┐    ┌─────────────────┐
                              │   Check         │◄───│   Wait for      │
                              │   Reply/Exit    │    │   Next Step     │
                              └─────────────────┘    └─────────────────┘
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Contacts Module    | Inbound   | Get contact details                          |
| Templates Module   | Inbound   | Resolve email templates                      |
| Pipeline Module    | Outbound  | Queue automated emails                       |
| Inbox Module       | Inbound   | Detect replies for auto-exit                 |
| Analytics Module   | Outbound  | Sequence performance metrics                 |

## 3. Database Schema

### Sequence Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| name             | VARCHAR(255)    | No       | -          | Sequence name                  |
| description      | TEXT            | Yes      | null       | Sequence description           |
| status           | ENUM            | No       | 'draft'    | draft, active, paused, archived |
| channel          | ENUM            | No       | 'email'    | email, linkedin, multi         |
| settings         | JSONB           | No       | {}         | Sequence settings              |
| exitConditions   | JSONB           | No       | {}         | Auto-exit conditions           |
| stats            | JSONB           | No       | {}         | Cached statistics              |
| createdBy        | UUID            | No       | -          | Creator user ID                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |
| deletedAt        | TIMESTAMPTZ     | Yes      | null       | Soft delete timestamp          |

**Settings Schema:**
```json
{
  "timezone": "America/New_York",
  "businessHours": {
    "monday": {"start": "09:00", "end": "17:00"},
    "tuesday": {"start": "09:00", "end": "17:00"},
    ...
  },
  "excludeWeekends": true,
  "excludeHolidays": true,
  "maxContactsPerDay": 100,
  "fromEmail": "sales@acme.com",
  "fromName": "Sales Team"
}
```

### SequenceStep Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| sequenceId       | UUID            | No       | FK to sequences                |
| stepNumber       | INTEGER         | No       | -          | Step order (1-based)           |
| type             | ENUM            | No       | -          | auto_email, manual_email, call, linkedin, task |
| name             | VARCHAR(255)    | No       | -          | Step name                      |
| templateId       | UUID            | Yes      | null       | FK to templates                |
| subject          | VARCHAR(500)    | Yes      | null       | Email subject override         |
| body             | TEXT            | Yes      | null       | Message body override          |
| delayDays        | INTEGER         | No       | 0          | Days after previous step       |
| delayHours       | INTEGER         | No       | 0          | Hours after previous step      |
| sendAt           | TIME            | Yes      | null       | Specific time to send          |
| taskDescription  | TEXT            | Yes      | null       | For manual task steps          |
| variants         | JSONB           | No       | []         | A/B test variants              |
| isActive         | BOOLEAN         | No       | true       | Whether step is active         |

### SequenceEnrollment Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| sequenceId       | UUID            | No       | FK to sequences                |
| contactId        | UUID            | No       | FK to contacts                 |
| status           | ENUM            | No       | 'active'   | active, paused, completed, replied, bounced, unsubscribed, cancelled |
| currentStepNumber| INTEGER         | No       | 1          | Current step                   |
| assignedTo       | UUID            | Yes      | null       | Sales rep user ID              |
| exitReason       | VARCHAR(100)    | Yes      | null       | Why enrollment ended           |
| enrolledAt       | TIMESTAMPTZ     | No       | now()      | Enrollment time                |
| completedAt      | TIMESTAMPTZ     | Yes      | null       | Completion time                |
| lastActivityAt   | TIMESTAMPTZ     | Yes      | null       | Last activity time             |
| metadata         | JSONB           | No       | {}         | Enrollment context             |

**Indexes:**
- `idx_enrollments_sequence_status` - (sequenceId, status)
- `idx_enrollments_contact` - (contactId)
- `idx_enrollments_assigned` - (assignedTo, status)

### SequenceStepExecution Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| enrollmentId     | UUID            | No       | FK to sequence_enrollments     |
| stepId           | UUID            | No       | FK to sequence_steps           |
| stepNumber       | INTEGER         | No       | -          | Step number                    |
| variantId        | VARCHAR(50)     | Yes      | null       | A/B variant used               |
| status           | ENUM            | No       | 'scheduled'| scheduled, pending_manual, sent, completed, skipped, failed |
| scheduledAt      | TIMESTAMPTZ     | No       | -          | When scheduled to execute      |
| executedAt       | TIMESTAMPTZ     | Yes      | null       | When executed                  |
| messageId        | UUID            | Yes      | null       | FK to pipeline_messages        |
| openedAt         | TIMESTAMPTZ     | Yes      | null       | When email opened              |
| clickedAt        | TIMESTAMPTZ     | Yes      | null       | When link clicked              |
| repliedAt        | TIMESTAMPTZ     | Yes      | null       | When reply received            |
| errorMessage     | TEXT            | Yes      | null       | Error if failed                |

### SequenceSchedule Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| enrollmentId     | UUID            | No       | FK to sequence_enrollments     |
| stepId           | UUID            | No       | FK to sequence_steps           |
| scheduledAt      | TIMESTAMPTZ     | No       | -          | When to execute                |
| processedAt      | TIMESTAMPTZ     | Yes      | null       | When processed                 |

## 4. API Endpoints

### Create Sequence

```
POST /api/v1/sequences
```

**Request Body:**
```json
{
  "name": "Cold Outreach - Enterprise",
  "description": "5-step sequence for enterprise prospects",
  "channel": "email",
  "settings": {
    "timezone": "America/New_York",
    "businessHours": {
      "monday": {"start": "09:00", "end": "17:00"},
      "tuesday": {"start": "09:00", "end": "17:00"},
      "wednesday": {"start": "09:00", "end": "17:00"},
      "thursday": {"start": "09:00", "end": "17:00"},
      "friday": {"start": "09:00", "end": "17:00"}
    },
    "excludeWeekends": true,
    "fromEmail": "john.sales@acme.com",
    "fromName": "John from Acme"
  },
  "exitConditions": {
    "onReply": true,
    "onMeetingBooked": true,
    "onBounce": true,
    "onUnsubscribe": true
  },
  "steps": [
    {
      "stepNumber": 1,
      "type": "auto_email",
      "name": "Initial Outreach",
      "templateId": "550e8400-e29b-41d4-a716-446655440001",
      "delayDays": 0,
      "sendAt": "10:00"
    },
    {
      "stepNumber": 2,
      "type": "auto_email",
      "name": "Follow-up",
      "templateId": "550e8400-e29b-41d4-a716-446655440002",
      "delayDays": 3,
      "sendAt": "10:00"
    },
    {
      "stepNumber": 3,
      "type": "manual_email",
      "name": "Personalized Message",
      "delayDays": 4,
      "taskDescription": "Write a personalized follow-up based on their LinkedIn activity"
    },
    {
      "stepNumber": 4,
      "type": "call",
      "name": "Phone Call",
      "delayDays": 2,
      "taskDescription": "Call the prospect to discuss their needs"
    },
    {
      "stepNumber": 5,
      "type": "auto_email",
      "name": "Final Follow-up",
      "templateId": "550e8400-e29b-41d4-a716-446655440003",
      "delayDays": 5,
      "sendAt": "10:00"
    }
  ]
}
```

### List Sequences

```
GET /api/v1/sequences
```

### Get Sequence

```
GET /api/v1/sequences/:id
```

### Update Sequence

```
PATCH /api/v1/sequences/:id
```

### Delete Sequence

```
DELETE /api/v1/sequences/:id
```

### Activate Sequence

```
POST /api/v1/sequences/:id/activate
```

### Pause Sequence

```
POST /api/v1/sequences/:id/pause
```

### Enroll Contact

```
POST /api/v1/sequences/:id/enrollments
```

**Request Body:**
```json
{
  "contactId": "550e8400-e29b-41d4-a716-446655440010",
  "assignedTo": "550e8400-e29b-41d4-a716-446655440020",
  "startAtStep": 1,
  "metadata": {
    "source": "linkedin_import",
    "notes": "Connected on LinkedIn last week"
  }
}
```

### Bulk Enroll Contacts

```
POST /api/v1/sequences/:id/enrollments/bulk
```

**Request Body:**
```json
{
  "contactIds": ["...", "..."],
  "assignedTo": "...",
  "startAtStep": 1
}
```

### List Enrollments

```
GET /api/v1/sequences/:id/enrollments
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page                 |
| status     | string  | -       | Filter by status               |
| assignedTo | string  | -       | Filter by assigned user        |

### Get Enrollment Details

```
GET /api/v1/sequences/:id/enrollments/:enrollmentId
```

### Pause Enrollment

```
POST /api/v1/sequences/:id/enrollments/:enrollmentId/pause
```

### Resume Enrollment

```
POST /api/v1/sequences/:id/enrollments/:enrollmentId/resume
```

### Cancel Enrollment

```
POST /api/v1/sequences/:id/enrollments/:enrollmentId/cancel
```

### Skip to Step

```
POST /api/v1/sequences/:id/enrollments/:enrollmentId/skip
```

**Request Body:**
```json
{
  "toStepNumber": 4
}
```

### Complete Manual Step

```
POST /api/v1/sequences/:id/enrollments/:enrollmentId/steps/:stepNumber/complete
```

**Request Body:**
```json
{
  "notes": "Called and left voicemail",
  "outcome": "no_answer"
}
```

### Get Sequence Stats

```
GET /api/v1/sequences/:id/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sequenceId": "550e8400-e29b-41d4-a716-446655440000",
    "totalEnrollments": 500,
    "activeEnrollments": 150,
    "completedEnrollments": 200,
    "repliedEnrollments": 100,
    "replyRate": 20.0,
    "bouncedEnrollments": 25,
    "stepStats": [
      {
        "stepNumber": 1,
        "sent": 500,
        "opened": 350,
        "clicked": 100,
        "replied": 50,
        "openRate": 70.0,
        "clickRate": 20.0,
        "replyRate": 10.0
      }
    ]
  }
}
```

### Get Tasks (Manual Steps)

```
GET /api/v1/sequences/tasks
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| assignedTo | string  | -       | Filter by assigned user        |
| status     | string  | pending_manual | Filter by status         |
| dueDate    | string  | -       | Filter by due date             |

## 5. Event Bus (NATS JetStream)

### Subscribed Events

| Subject                  | Action                                    |
|--------------------------|-------------------------------------------|
| `inbox.message.received` | Check if reply to sequence email          |
| `pipeline.message.opened`| Update step execution opened status       |
| `pipeline.message.clicked`| Update step execution clicked status     |
| `pipeline.message.bounced`| Mark enrollment as bounced               |

### Published Events

| Subject                       | Event Type                    | Trigger                       |
|-------------------------------|-------------------------------|-------------------------------|
| `sequence.enrollment.created` | SequenceEnrollmentCreatedEvent| Contact enrolled              |
| `sequence.enrollment.completed`| SequenceEnrollmentCompletedEvent | All steps completed       |
| `sequence.enrollment.replied` | SequenceEnrollmentRepliedEvent| Reply detected                |
| `sequence.enrollment.exited`  | SequenceEnrollmentExitedEvent | Enrollment exited             |
| `sequence.step.executed`      | SequenceStepExecutedEvent     | Step executed                 |
| `sequence.step.pending_manual`| SequenceStepPendingManualEvent| Manual step awaiting action   |

## 6. Logging

```typescript
// Enrollment
this.logger.log('[ENROLL] contact enrolled in sequence', {
  tenantId,
  correlationId,
  sequenceId,
  enrollmentId,
  contactId,
  assignedTo,
});

// Step execution
this.logger.log('[STEP] executing sequence step', {
  tenantId,
  enrollmentId,
  stepNumber,
  stepType,
  scheduledAt,
});

// Reply detection
this.logger.log('[REPLY] reply detected, exiting sequence', {
  tenantId,
  enrollmentId,
  sequenceId,
  contactId,
  messageId,
});
```

## 7. Background Jobs

| Job Name                       | Schedule       | Description                              |
|--------------------------------|----------------|------------------------------------------|
| `sequence-scheduler`           | Every 1 min    | Schedule next steps for active enrollments |
| `sequence-step-executor`       | Every 1 min    | Execute due steps                        |
| `sequence-reply-checker`       | Every 5 min    | Check for replies and exit enrollments   |
| `sequence-stats-calculator`    | Every 15 min   | Update sequence statistics               |

### Step Executor

```typescript
@Cron('* * * * *')  // Every minute
async executeDueSteps() {
  const dueSchedules = await this.scheduleRepository.findDue();
  for (const schedule of dueSchedules) {
    const enrollment = await this.enrollmentRepository.findById(schedule.enrollmentId);
    if (enrollment.status !== 'active') continue;
    
    const step = await this.stepRepository.findById(schedule.stepId);
    await this.executeStep(enrollment, step);
    await this.scheduleRepository.markProcessed(schedule.id);
  }
}
```

## 8. Integration Scenarios

### Scenario 1: Auto-Email Step Execution

```
1. SequenceSchedulerJob finds due schedule
2. Loads enrollment and step
3. Checks business hours in contact's timezone
4. If within hours:
   a. TemplatesService renders template with contact data
   b. PipelineService.queue() queues email
   c. Creates StepExecution with messageId
   d. Schedules next step
5. If outside hours:
   a. Reschedule to next business hour
```

### Scenario 2: Reply Detection Exit

```
1. Email received in inbox
2. InboxIngestionService creates InboxMessage
3. Publishes inbox.message.received event
4. SequenceReplyDetectorService receives event
5. Checks message headers for In-Reply-To
6. Matches against sent sequence emails
7. If match found:
   a. Update enrollment status='replied'
   b. Update step execution repliedAt
   c. Publish sequence.enrollment.replied event
   d. Clear remaining schedules
```

### Scenario 3: Manual Task Workflow

```
1. Scheduler reaches manual_email step
2. Creates StepExecution with status='pending_manual'
3. Publishes sequence.step.pending_manual event
4. Sales rep sees task in task list
5. Rep completes task via POST /steps/:stepNumber/complete
6. Step marked as completed
7. Next step scheduled
```

## 9. Business Hours Logic

```typescript
calculateNextSendTime(
  enrollment: SequenceEnrollment,
  step: SequenceStep,
  settings: SequenceSettings
): Date {
  const timezone = settings.timezone || 'UTC';
  const now = DateTime.now().setZone(timezone);
  
  // Calculate base send time
  let sendTime = now.plus({
    days: step.delayDays,
    hours: step.delayHours
  });
  
  // If specific send time, set it
  if (step.sendAt) {
    const [hour, minute] = step.sendAt.split(':');
    sendTime = sendTime.set({ hour: parseInt(hour), minute: parseInt(minute) });
  }
  
  // Adjust for business hours
  while (!this.isBusinessHour(sendTime, settings)) {
    sendTime = sendTime.plus({ hours: 1 });
    if (sendTime.diff(now, 'days').days > 30) {
      throw new Error('Could not find valid send time within 30 days');
    }
  }
  
  return sendTime.toJSDate();
}
```

## 10. Known Limitations

1. **Single Channel per Sequence**: Sequences are primarily email-focused; true multi-channel requires separate sequences.
2. **No Branching**: Sequences are linear; conditional logic requires workflows.
3. **Reply Detection**: Only works for email replies; phone call responses are manual.
4. **Timezone Handling**: Contact timezone must be set for accurate business hours.

## 11. Future Extensions

- [ ] Multi-channel sequences (email + LinkedIn + calls)
- [ ] Conditional step branching
- [ ] Reply sentiment analysis
- [ ] Auto-pause on out-of-office detection
- [ ] CRM integration (Salesforce, HubSpot sync)
- [ ] Meeting booking integration (Calendly, Chili Piper)
- [ ] Sequence performance benchmarking
- [ ] AI-generated personalization suggestions
