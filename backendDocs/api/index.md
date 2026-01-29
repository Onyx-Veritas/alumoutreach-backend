# API Reference Index

## Base URL

```
Production:  https://api.alumoutreach.com/api/v1
Staging:     https://staging-api.alumoutreach.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication via JWT bearer token:

```http
Authorization: Bearer <access_token>
```

### Headers

| Header           | Required | Description                          |
|------------------|----------|--------------------------------------|
| `Authorization`  | Yes      | Bearer token for authentication      |
| `X-Tenant-ID`    | Yes      | Tenant identifier                    |
| `X-Correlation-ID` | No     | Request tracing ID (auto-generated if not provided) |
| `Content-Type`   | Yes*     | `application/json` for POST/PATCH/PUT |

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "timestamp": "2026-01-27T10:00:00Z",
    "path": "/api/v1/contacts",
    "details": {
      "field": "email",
      "constraint": "isNotEmpty"
    }
  }
}
```

## HTTP Status Codes

| Code | Description                                    |
|------|------------------------------------------------|
| 200  | Success                                        |
| 201  | Created                                        |
| 204  | No Content (successful delete)                 |
| 400  | Bad Request (validation error)                 |
| 401  | Unauthorized (invalid/missing token)           |
| 403  | Forbidden (insufficient permissions)           |
| 404  | Not Found                                      |
| 409  | Conflict (duplicate resource)                  |
| 422  | Unprocessable Entity                           |
| 429  | Too Many Requests (rate limited)               |
| 500  | Internal Server Error                          |
| 503  | Service Unavailable                            |

## API Modules

### Contacts API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/contacts`                           | Create contact                 |
| GET    | `/contacts`                           | List contacts                  |
| GET    | `/contacts/:id`                       | Get contact by ID              |
| PATCH  | `/contacts/:id`                       | Update contact                 |
| DELETE | `/contacts/:id`                       | Delete contact                 |
| POST   | `/contacts/:id/tags`                  | Add tag to contact             |
| DELETE | `/contacts/:id/tags/:tagId`           | Remove tag from contact        |
| POST   | `/contacts/:id/attributes`            | Add attribute                  |
| GET    | `/contacts/:id/timeline`              | Get contact timeline           |
| POST   | `/contacts/:id/consent`               | Record consent                 |
| GET    | `/contacts/search`                    | Search contacts (Elasticsearch)|

📖 [Full Contacts Documentation](../modules/contacts.md)

---

### Templates API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/templates`                          | Create template                |
| GET    | `/templates`                          | List templates                 |
| GET    | `/templates/:id`                      | Get template by ID             |
| PUT    | `/templates/:id`                      | Update template (new version)  |
| DELETE | `/templates/:id`                      | Delete template                |
| GET    | `/templates/:id/versions`             | List template versions         |
| GET    | `/templates/:id/versions/:version`    | Get specific version           |
| POST   | `/templates/:id/activate`             | Activate template              |
| POST   | `/templates/:id/archive`              | Archive template               |
| POST   | `/templates/:id/render`               | Preview rendered template      |
| POST   | `/templates/:id/clone`                | Clone template                 |
| POST   | `/templates/:id/whatsapp/submit`      | Submit WhatsApp HSM            |
| GET    | `/templates/:id/whatsapp/status`      | Get HSM approval status        |

📖 [Full Templates Documentation](../modules/templates.md)

---

### Segments API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/segments`                           | Create segment                 |
| GET    | `/segments`                           | List segments                  |
| GET    | `/segments/:id`                       | Get segment by ID              |
| PATCH  | `/segments/:id`                       | Update segment                 |
| DELETE | `/segments/:id`                       | Delete segment                 |
| GET    | `/segments/:id/members`               | Get segment members            |
| POST   | `/segments/:id/members`               | Add members (static segment)   |
| DELETE | `/segments/:id/members`               | Remove members (static segment)|
| POST   | `/segments/:id/evaluate`              | Force segment evaluation       |
| POST   | `/segments/estimate`                  | Estimate segment size          |
| GET    | `/segments/:id/history`               | Get membership history         |

📖 [Full Segments Documentation](../modules/segments.md)

---

### Campaigns API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/campaigns`                          | Create campaign                |
| GET    | `/campaigns`                          | List campaigns                 |
| GET    | `/campaigns/:id`                      | Get campaign by ID             |
| PATCH  | `/campaigns/:id`                      | Update campaign                |
| DELETE | `/campaigns/:id`                      | Delete campaign                |
| POST   | `/campaigns/:id/schedule`             | Schedule campaign              |
| POST   | `/campaigns/:id/start`                | Start campaign immediately     |
| POST   | `/campaigns/:id/pause`                | Pause campaign                 |
| POST   | `/campaigns/:id/resume`               | Resume campaign                |
| POST   | `/campaigns/:id/cancel`               | Cancel campaign                |
| GET    | `/campaigns/:id/stats`                | Get campaign statistics        |
| GET    | `/campaigns/:id/recipients`           | Get campaign recipients        |
| POST   | `/campaigns/:id/preview`              | Preview campaign for contact   |
| POST   | `/campaigns/:id/ab-test`              | Create A/B test                |
| POST   | `/campaigns/:id/ab-test/winner`       | Declare A/B test winner        |

📖 [Full Campaigns Documentation](../modules/campaigns.md)

---

### Pipeline API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/pipeline/messages`                  | Queue single message           |
| POST   | `/pipeline/messages/batch`            | Queue batch of messages        |
| GET    | `/pipeline/messages/:id`              | Get message status             |
| POST   | `/pipeline/messages/:id/cancel`       | Cancel pending message         |
| POST   | `/pipeline/messages/:id/retry`        | Retry failed message           |
| GET    | `/pipeline/stats`                     | Get queue statistics           |
| GET    | `/pipeline/dlq`                       | Get dead letter queue          |
| POST   | `/pipeline/dlq/:id/retry`             | Retry DLQ message              |
| DELETE | `/pipeline/dlq`                       | Purge DLQ                      |
| POST   | `/pipeline/pause`                     | Pause queue processing         |
| POST   | `/pipeline/resume`                    | Resume queue processing        |

📖 [Full Pipeline Documentation](../modules/pipeline.md)

---

### Workflows API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/workflows`                          | Create workflow                |
| GET    | `/workflows`                          | List workflows                 |
| GET    | `/workflows/:id`                      | Get workflow by ID             |
| PATCH  | `/workflows/:id`                      | Update workflow                |
| DELETE | `/workflows/:id`                      | Delete workflow                |
| POST   | `/workflows/:id/activate`             | Activate workflow              |
| POST   | `/workflows/:id/pause`                | Pause workflow                 |
| GET    | `/workflows/:id/stats`                | Get workflow statistics        |
| GET    | `/workflows/:id/runs`                 | List workflow runs             |
| GET    | `/workflows/:id/runs/:runId`          | Get run details                |
| POST   | `/workflows/:id/runs/:runId/cancel`   | Cancel workflow run            |
| POST   | `/workflows/:id/trigger`              | Manually trigger workflow      |
| GET    | `/workflows/:id/versions`             | List workflow versions         |
| POST   | `/workflows/:id/versions/:v/revert`   | Revert to version              |

📖 [Full Workflows Documentation](../modules/workflows.md)

---

### Sequences API

| Method | Endpoint                                          | Description                    |
|--------|---------------------------------------------------|--------------------------------|
| POST   | `/sequences`                                      | Create sequence                |
| GET    | `/sequences`                                      | List sequences                 |
| GET    | `/sequences/:id`                                  | Get sequence by ID             |
| PATCH  | `/sequences/:id`                                  | Update sequence                |
| DELETE | `/sequences/:id`                                  | Delete sequence                |
| POST   | `/sequences/:id/activate`                         | Activate sequence              |
| POST   | `/sequences/:id/pause`                            | Pause sequence                 |
| POST   | `/sequences/:id/enrollments`                      | Enroll contact                 |
| POST   | `/sequences/:id/enrollments/bulk`                 | Bulk enroll contacts           |
| GET    | `/sequences/:id/enrollments`                      | List enrollments               |
| GET    | `/sequences/:id/enrollments/:enrollmentId`        | Get enrollment details         |
| POST   | `/sequences/:id/enrollments/:enrollmentId/pause`  | Pause enrollment               |
| POST   | `/sequences/:id/enrollments/:enrollmentId/resume` | Resume enrollment              |
| POST   | `/sequences/:id/enrollments/:enrollmentId/cancel` | Cancel enrollment              |
| POST   | `/sequences/:id/enrollments/:enrollmentId/skip`   | Skip to step                   |
| POST   | `/sequences/:id/enrollments/:eid/steps/:n/complete` | Complete manual step         |
| GET    | `/sequences/:id/stats`                            | Get sequence statistics        |
| GET    | `/sequences/tasks`                                | Get pending manual tasks       |

📖 [Full Sequences Documentation](../modules/sequences.md)

---

### Inbox API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/inbox/threads`                      | List threads                   |
| GET    | `/inbox/threads/:id`                  | Get thread by ID               |
| GET    | `/inbox/threads/:id/messages`         | Get thread messages            |
| POST   | `/inbox/threads/:id/reply`            | Reply to thread                |
| POST   | `/inbox/threads/:id/notes`            | Add internal note              |
| POST   | `/inbox/threads/:id/assign`           | Assign to agent                |
| POST   | `/inbox/threads/:id/assign-team`      | Assign to team                 |
| PATCH  | `/inbox/threads/:id/status`           | Update thread status           |
| PATCH  | `/inbox/threads/:id/priority`         | Update thread priority         |
| POST   | `/inbox/threads/:id/tags`             | Add tags                       |
| POST   | `/inbox/threads/:id/read`             | Mark as read                   |
| POST   | `/inbox/threads/:id/unread`           | Mark as unread                 |
| GET    | `/inbox/stats`                        | Get inbox statistics           |
| GET    | `/inbox/stats/agents`                 | Get agent statistics           |
| GET    | `/inbox/canned-responses`             | List canned responses          |
| POST   | `/inbox/canned-responses`             | Create canned response         |
| GET    | `/inbox/sla-policies`                 | List SLA policies              |
| POST   | `/inbox/sla-policies`                 | Create SLA policy              |

📖 [Full Inbox Documentation](../modules/inbox.md)

---

### Analytics API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/analytics/overview`                 | Get overview analytics         |
| GET    | `/analytics/messages`                 | Get messages analytics         |
| GET    | `/analytics/campaigns`                | Get campaign analytics         |
| GET    | `/analytics/workflows`                | Get workflow analytics         |
| GET    | `/analytics/sequences`                | Get sequence analytics         |
| GET    | `/analytics/templates`                | Get template analytics         |
| GET    | `/analytics/traffic`                  | Get traffic analytics          |

📖 [Full Analytics Documentation](../modules/analytics.md)

---

### Health API

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/health`                             | Detailed health check          |
| GET    | `/health/live`                        | Liveness probe                 |
| GET    | `/health/ready`                       | Readiness probe                |
| GET    | `/health/ping`                        | Simple ping                    |

📖 [Full Health Documentation](../modules/health.md)

---

## Pagination

All list endpoints support pagination:

| Parameter   | Type    | Default | Description                    |
|-------------|---------|---------|--------------------------------|
| `page`      | number  | 1       | Page number (1-based)          |
| `pageSize`  | number  | 20      | Items per page (max 100)       |
| `sortBy`    | string  | varies  | Sort field                     |
| `sortOrder` | string  | DESC    | Sort direction (ASC/DESC)      |

**Example:**
```
GET /api/v1/contacts?page=2&pageSize=50&sortBy=createdAt&sortOrder=DESC
```

## Filtering

Most list endpoints support filtering via query parameters:

```
GET /api/v1/contacts?status=active&tags=vip,enterprise
GET /api/v1/campaigns?channel=email&status=running
GET /api/v1/inbox/threads?assignedTo=user-123&priority=urgent
```

## Rate Limiting

API requests are rate limited per tenant:

| Tier       | Requests/minute | Requests/hour |
|------------|-----------------|---------------|
| Free       | 60              | 1,000         |
| Starter    | 300             | 10,000        |
| Business   | 1,000           | 50,000        |
| Enterprise | Custom          | Custom        |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1706356800
```

## Webhooks

Outbound webhooks are available for real-time event notifications:

| Event Category | Events                                          |
|----------------|-------------------------------------------------|
| Contacts       | contact.created, contact.updated, contact.deleted |
| Messages       | message.sent, message.delivered, message.opened, message.clicked |
| Campaigns      | campaign.started, campaign.completed            |
| Workflows      | workflow.run.completed, workflow.run.goal_reached |
| Inbox          | inbox.message.received, inbox.thread.assigned   |

Webhook payload includes HMAC signature for verification:

```http
X-Signature: sha256=abc123...
```

## SDKs

Official SDKs available:

- **Node.js**: `npm install @alumoutreach/node-sdk`
- **Python**: `pip install alumoutreach`
- **PHP**: `composer require alumoutreach/php-sdk`
- **Ruby**: `gem install alumoutreach`

## OpenAPI Specification

Download the full OpenAPI specification:

```bash
curl https://api.alumoutreach.com/api/docs-json > openapi.json
```

Interactive documentation available at:
```
https://api.alumoutreach.com/api/docs
```
