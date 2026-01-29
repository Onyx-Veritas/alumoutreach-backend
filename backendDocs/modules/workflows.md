# Workflows Module

## 1. Overview

The Workflows Module provides a visual, event-driven automation engine for AlumOutreach. It enables users to create complex, multi-step automation flows triggered by events such as contact creation, segment entry, form submissions, or scheduled times. The module supports conditional branching, delays, multi-channel actions, and goal-based exits.

**Key Responsibilities:**
- Visual workflow builder with drag-and-drop nodes
- Event-based and scheduled triggers
- Conditional branching (if/else, switch)
- Delay nodes with duration and time-of-day support
- Action nodes (send email, SMS, WhatsApp, update contact, add tag, etc.)
- Goal-based workflow exits
- Workflow analytics and run history
- Workflow versioning and activation

## 2. Architecture

### Components

| Component                | File                                           | Purpose                              |
|--------------------------|------------------------------------------------|--------------------------------------|
| **Controller**           | `workflows.controller.ts`                      | REST API endpoints                   |
| **Service**              | `workflows.service.ts`                         | Workflow CRUD and management         |
| **Executor**             | `services/workflow-executor.service.ts`        | Run execution engine                 |
| **Trigger Service**      | `services/workflow-trigger.service.ts`         | Event trigger matching               |
| **Scheduler**            | `services/workflow-scheduler.service.ts`       | Scheduled workflow processing        |
| **Node Handlers**        | `handlers/*.handler.ts`                        | Node-specific execution logic        |
| **Repository**           | `repositories/workflow.repository.ts`          | Database operations                  |

### Module Dependencies

```
WorkflowsModule
├── TypeOrmModule (Workflow entities)
├── ContactsModule (Contact operations)
├── TemplatesModule (Template resolution)
├── SegmentsModule (Segment membership)
├── PipelineModule (Message sending)
├── EventBusModule (Trigger subscription)
├── RedisModule (Run state caching)
├── LoggerModule
└── Exports: WorkflowsService, WorkflowExecutorService, WorkflowTriggerService
```

### Execution Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Trigger   │───►│   Create    │───►│   Execute   │───►│   Process   │
│   Event     │    │   Run       │    │   Nodes     │    │   Actions   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │   Check     │
                                      │   Goals     │
                                      └─────────────┘
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Contacts Module    | Subscribes| Trigger on contact.created, contact.updated  |
| Contacts Module    | Inbound   | Update contact attributes/tags               |
| Segments Module    | Subscribes| Trigger on segment.member.added              |
| Templates Module   | Inbound   | Resolve templates for send actions           |
| Pipeline Module    | Outbound  | Queue messages for delivery                  |
| Analytics Module   | Outbound  | Workflow execution metrics                   |

## 3. Database Schema

### Workflow Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| name             | VARCHAR(255)    | No       | -          | Workflow name                  |
| description      | TEXT            | Yes      | null       | Workflow description           |
| status           | ENUM            | No       | 'draft'    | draft, active, paused, archived |
| version          | INTEGER         | No       | 1          | Current version                |
| trigger          | JSONB           | No       | {}         | Trigger configuration          |
| nodes            | JSONB           | No       | []         | Node definitions               |
| edges            | JSONB           | No       | []         | Node connections               |
| goals            | JSONB           | No       | []         | Goal definitions               |
| settings         | JSONB           | No       | {}         | Workflow settings              |
| stats            | JSONB           | No       | {}         | Cached statistics              |
| createdBy        | UUID            | No       | -          | Creator user ID                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt        | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |
| deletedAt        | TIMESTAMPTZ     | Yes      | null       | Soft delete timestamp          |

**Indexes:**
- `idx_workflows_tenant_status` - (tenantId, status)

### WorkflowRun Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| workflowId       | UUID            | No       | FK to workflows                |
| workflowVersion  | INTEGER         | No       | -          | Workflow version at start      |
| contactId        | UUID            | No       | FK to contacts                 |
| status           | ENUM            | No       | 'running'  | running, completed, failed, goal_reached, cancelled |
| currentNodeId    | VARCHAR(100)    | Yes      | null       | Current node in execution      |
| triggerEvent     | JSONB           | No       | {}         | Event that triggered run       |
| context          | JSONB           | No       | {}         | Run context/variables          |
| goalReachedId    | VARCHAR(100)    | Yes      | null       | Goal that was reached          |
| errorMessage     | TEXT            | Yes      | null       | Error if failed                |
| startedAt        | TIMESTAMPTZ     | No       | now()      | Run start time                 |
| completedAt      | TIMESTAMPTZ     | Yes      | null       | Run completion time            |

**Indexes:**
- `idx_workflow_runs_workflow_status` - (workflowId, status)
- `idx_workflow_runs_contact` - (contactId)
- `idx_workflow_runs_started` - (startedAt DESC)

### WorkflowRunStep Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| runId            | UUID            | No       | FK to workflow_runs            |
| nodeId           | VARCHAR(100)    | No       | -          | Node identifier                |
| nodeType         | VARCHAR(50)     | No       | -          | Node type                      |
| status           | ENUM            | No       | 'pending'  | pending, running, completed, failed, skipped |
| input            | JSONB           | No       | {}         | Input to node                  |
| output           | JSONB           | No       | {}         | Output from node               |
| errorMessage     | TEXT            | Yes      | null       | Error if failed                |
| startedAt        | TIMESTAMPTZ     | Yes      | null       | Step start time                |
| completedAt      | TIMESTAMPTZ     | Yes      | null       | Step completion time           |
| scheduledAt      | TIMESTAMPTZ     | Yes      | null       | For delay nodes                |

**Indexes:**
- `idx_run_steps_run` - (runId)
- `idx_run_steps_scheduled` - (status, scheduledAt) WHERE status = 'pending'

### WorkflowVersion Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| workflowId       | UUID            | No       | FK to workflows                |
| version          | INTEGER         | No       | -          | Version number                 |
| trigger          | JSONB           | No       | {}         | Trigger config at version      |
| nodes            | JSONB           | No       | []         | Nodes at version               |
| edges            | JSONB           | No       | []         | Edges at version               |
| goals            | JSONB           | No       | []         | Goals at version               |
| changelog        | TEXT            | Yes      | null       | Version notes                  |
| createdBy        | UUID            | No       | -          | Version creator                |
| createdAt        | TIMESTAMPTZ     | No       | now()      | Created timestamp              |

### WorkflowSchedule Entity

| Column           | Type            | Nullable | Default    | Description                    |
|------------------|-----------------|----------|------------|--------------------------------|
| id               | UUID            | No       | generated  | Primary key                    |
| tenantId         | VARCHAR         | No       | -          | Tenant identifier              |
| workflowId       | UUID            | No       | FK to workflows                |
| runId            | UUID            | No       | FK to workflow_runs            |
| stepId           | UUID            | No       | FK to workflow_run_steps       |
| scheduledAt      | TIMESTAMPTZ     | No       | -          | When to resume                 |
| processedAt      | TIMESTAMPTZ     | Yes      | null       | When processed                 |

**Indexes:**
- `idx_workflow_schedule_due` - (scheduledAt) WHERE processedAt IS NULL

## 4. API Endpoints

### Create Workflow

```
POST /api/v1/workflows
```

**Request Body:**
```json
{
  "name": "New User Onboarding",
  "description": "Welcome sequence for new signups",
  "trigger": {
    "type": "event",
    "event": "contact.created",
    "conditions": [
      {"field": "source", "operator": "equals", "value": "website_signup"}
    ]
  },
  "nodes": [
    {
      "id": "node-1",
      "type": "send_email",
      "position": {"x": 100, "y": 100},
      "data": {
        "templateId": "550e8400-e29b-41d4-a716-446655440001",
        "fromName": "Acme Team",
        "fromEmail": "hello@acme.com"
      }
    },
    {
      "id": "node-2",
      "type": "delay",
      "position": {"x": 100, "y": 200},
      "data": {
        "duration": 86400,
        "unit": "seconds"
      }
    },
    {
      "id": "node-3",
      "type": "condition",
      "position": {"x": 100, "y": 300},
      "data": {
        "conditions": [
          {"field": "hasOpened", "operator": "equals", "value": true}
        ]
      }
    }
  ],
  "edges": [
    {"source": "trigger", "target": "node-1"},
    {"source": "node-1", "target": "node-2"},
    {"source": "node-2", "target": "node-3"}
  ],
  "goals": [
    {
      "id": "goal-1",
      "name": "Purchased",
      "event": "contact.attribute_changed",
      "conditions": [
        {"field": "attributes.has_purchased", "operator": "equals", "value": true}
      ]
    }
  ]
}
```

### List Workflows

```
GET /api/v1/workflows
```

### Get Workflow

```
GET /api/v1/workflows/:id
```

### Update Workflow

```
PATCH /api/v1/workflows/:id
```

### Delete Workflow

```
DELETE /api/v1/workflows/:id
```

### Activate Workflow

```
POST /api/v1/workflows/:id/activate
```

### Pause Workflow

```
POST /api/v1/workflows/:id/pause
```

### Get Workflow Stats

```
GET /api/v1/workflows/:id/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflowId": "550e8400-e29b-41d4-a716-446655440000",
    "totalRuns": 15000,
    "runningRuns": 250,
    "completedRuns": 14500,
    "failedRuns": 50,
    "goalReachedRuns": 2000,
    "conversionRate": 13.79,
    "avgDuration": 172800,
    "nodeStats": {
      "node-1": {"executed": 15000, "succeeded": 14950, "failed": 50},
      "node-2": {"executed": 14950, "succeeded": 14950, "waiting": 250}
    }
  }
}
```

### Get Workflow Runs

```
GET /api/v1/workflows/:id/runs
```

### Get Workflow Run Details

```
GET /api/v1/workflows/:id/runs/:runId
```

### Cancel Workflow Run

```
POST /api/v1/workflows/:id/runs/:runId/cancel
```

### Manually Trigger Workflow

```
POST /api/v1/workflows/:id/trigger
```

**Request Body:**
```json
{
  "contactId": "550e8400-e29b-41d4-a716-446655440010"
}
```

### Get Workflow Versions

```
GET /api/v1/workflows/:id/versions
```

### Revert to Version

```
POST /api/v1/workflows/:id/versions/:version/revert
```

## 5. Node Types

### Trigger Nodes

| Type             | Description                                    |
|------------------|------------------------------------------------|
| `event`          | Trigger on system event (contact.created, etc.) |
| `segment_entry`  | Trigger when contact enters segment            |
| `segment_exit`   | Trigger when contact exits segment             |
| `schedule`       | Trigger at scheduled time (cron)               |
| `webhook`        | Trigger via external webhook                   |

### Action Nodes

| Type             | Description                                    |
|------------------|------------------------------------------------|
| `send_email`     | Send email via Pipeline                        |
| `send_sms`       | Send SMS via Pipeline                          |
| `send_whatsapp`  | Send WhatsApp message via Pipeline             |
| `send_push`      | Send push notification via Pipeline            |
| `update_contact` | Update contact attributes                      |
| `add_tag`        | Add tag to contact                             |
| `remove_tag`     | Remove tag from contact                        |
| `add_to_segment` | Add contact to static segment                  |
| `remove_from_segment` | Remove contact from segment               |
| `webhook`        | Call external webhook                          |
| `slack`          | Send Slack notification                        |

### Flow Control Nodes

| Type             | Description                                    |
|------------------|------------------------------------------------|
| `delay`          | Wait for specified duration                    |
| `wait_until`     | Wait until specific date/time                  |
| `condition`      | If/else branching                              |
| `switch`         | Multi-way branching                            |
| `split`          | A/B testing split                              |
| `end`            | Workflow completion                            |

## 6. Event Bus (NATS JetStream)

### Subscribed Events

| Subject                  | Action                                    |
|--------------------------|-------------------------------------------|
| `contact.created`        | Match against event triggers              |
| `contact.updated`        | Match against event triggers              |
| `segment.member.added`   | Match against segment entry triggers      |
| `segment.member.removed` | Match against segment exit triggers       |
| `pipeline.message.opened`| Check goal conditions                     |
| `pipeline.message.clicked`| Check goal conditions                    |

### Published Events

| Subject                   | Event Type                | Trigger                       |
|---------------------------|---------------------------|-------------------------------|
| `workflow.run.started`    | WorkflowRunStartedEvent   | New run created               |
| `workflow.run.completed`  | WorkflowRunCompletedEvent | Run reached end               |
| `workflow.run.failed`     | WorkflowRunFailedEvent    | Run failed                    |
| `workflow.run.goal_reached`| WorkflowGoalReachedEvent | Goal condition met            |
| `workflow.node.executed`  | WorkflowNodeExecutedEvent | Node completed execution      |

## 7. Logging

```typescript
// Run start
this.logger.log('[RUN] workflow run started', {
  tenantId,
  correlationId,
  workflowId,
  runId,
  contactId,
  triggerType: trigger.type,
});

// Node execution
this.logger.log('[NODE] executing node', {
  tenantId,
  runId,
  nodeId,
  nodeType,
  input: sanitizedInput,
});

// Goal reached
this.logger.log('[GOAL] goal reached', {
  tenantId,
  runId,
  goalId,
  goalName,
  contactId,
});
```

## 8. Background Jobs

| Job Name                       | Schedule       | Description                              |
|--------------------------------|----------------|------------------------------------------|
| `workflow-delay-processor`     | Every 1 min    | Process delay nodes due for resume       |
| `workflow-schedule-trigger`    | Every 1 min    | Trigger scheduled workflows              |
| `workflow-stale-run-detector`  | Every 15 min   | Detect stuck runs                        |
| `workflow-stats-calculator`    | Every 5 min    | Update workflow statistics               |

### Delay Processor

```typescript
@Cron('* * * * *')  // Every minute
async processDelays() {
  const dueSchedules = await this.scheduleRepository.findDue();
  for (const schedule of dueSchedules) {
    await this.executorService.resumeRun(schedule.runId, schedule.stepId);
    await this.scheduleRepository.markProcessed(schedule.id);
  }
}
```

## 9. Integration Scenarios

### Scenario 1: Event Trigger → Workflow Execution

```
1. Contact created via POST /api/v1/contacts
2. ContactsService publishes contact.created event
3. WorkflowTriggerService receives event
4. Queries workflows with trigger.type='event' AND trigger.event='contact.created'
5. For each matching workflow:
   a. Evaluate trigger conditions against contact
   b. If match, create WorkflowRun
   c. Publish workflow.run.started event
   d. Execute first node
6. WorkflowExecutorService processes nodes in sequence
7. When end node reached, set run status='completed'
```

### Scenario 2: Delay Node Execution

```
1. WorkflowExecutorService reaches delay node
2. Creates WorkflowRunStep with status='pending', scheduledAt=now()+delay
3. Creates WorkflowSchedule record
4. Run waits (status='running', currentNodeId=delay node)
5. Background job finds due schedule
6. Calls ExecutorService.resumeRun()
7. Execution continues from next node
```

### Scenario 3: Goal-Based Exit

```
1. Workflow running for contact (user in onboarding flow)
2. User completes purchase
3. ContactsService updates attributes.has_purchased=true
4. contact.updated event published
5. WorkflowGoalChecker receives event
6. Queries running WorkflowRuns for contact
7. Evaluates goal conditions for each run
8. If goal matched:
   a. Set run status='goal_reached', goalReachedId=goal.id
   b. Publish workflow.run.goal_reached event
   c. Skip remaining nodes
```

## 10. Known Limitations

1. **Concurrent Runs**: Same contact can have multiple concurrent runs of same workflow.
2. **Node Limit**: Maximum 100 nodes per workflow.
3. **Delay Maximum**: Maximum delay is 365 days.
4. **Condition Complexity**: Maximum 10 conditions per condition node.
5. **No Loops**: Circular edges not supported.

## 11. Future Extensions

- [ ] Sub-workflows (workflow within workflow)
- [ ] Wait for event node (pause until specific event)
- [ ] Time window constraints (only execute during business hours)
- [ ] Workflow templates library
- [ ] Visual debugging with step-through
- [ ] Workflow comparison and diff
- [ ] Automatic workflow optimization suggestions
- [ ] Multi-contact workflows (e.g., for companies)
