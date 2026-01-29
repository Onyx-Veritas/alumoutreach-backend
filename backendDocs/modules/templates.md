# Templates Module

## 1. Overview

The Templates Module manages reusable message templates for all communication channels (email, SMS, WhatsApp, push notifications). It provides template versioning, variable substitution, channel-specific validation, and WhatsApp HSM (Highly Structured Message) approval tracking.

**Key Responsibilities:**
- Template CRUD with versioning
- Multi-channel support (email, SMS, WhatsApp, push)
- Variable placeholder management (Handlebars syntax)
- WhatsApp HSM submission and approval tracking
- Template categories and tagging
- Template rendering with context data
- Template usage statistics

## 2. Architecture

### Components

| Component                | File                                    | Purpose                              |
|--------------------------|-----------------------------------------|--------------------------------------|
| **Controller**           | `templates.controller.ts`               | REST API endpoints                   |
| **Service**              | `templates.service.ts`                  | Business logic & versioning          |
| **Render Service**       | `services/template-render.service.ts`   | Variable substitution engine         |
| **Repository**           | `repositories/template.repository.ts`   | Database operations                  |
| **Entities**             | `entities/*.entity.ts`                  | TypeORM definitions                  |

### Module Dependencies

```
TemplatesModule
├── TypeOrmModule (Template entities)
├── LoggerModule
└── Exports: TemplatesService, TemplateRenderService, TemplateRepository
```

### Integration Points

| Integration        | Direction | Purpose                                      |
|--------------------|-----------|----------------------------------------------|
| Campaigns Module   | Inbound   | Resolve template for campaign messages       |
| Workflows Module   | Inbound   | Resolve template in SendMessage actions      |
| Sequences Module   | Inbound   | Resolve template for sequence steps          |
| Pipeline Module    | Inbound   | Render template content before send          |
| Analytics Module   | Outbound  | Template usage metrics                       |

## 3. Database Schema

### Template Entity

| Column         | Type            | Nullable | Default    | Description                    |
|----------------|-----------------|----------|------------|--------------------------------|
| id             | UUID            | No       | generated  | Primary key                    |
| tenantId       | VARCHAR         | No       | -          | Tenant identifier              |
| name           | VARCHAR(255)    | No       | -          | Template name                  |
| description    | TEXT            | Yes      | null       | Template description           |
| channel        | ENUM            | No       | -          | email, sms, whatsapp, push     |
| category       | VARCHAR(100)    | Yes      | null       | Template category              |
| status         | ENUM            | No       | 'draft'    | draft, active, archived        |
| currentVersion | INTEGER         | No       | 1          | Current active version         |
| variables      | JSONB           | No       | []         | List of variable definitions   |
| metadata       | JSONB           | No       | {}         | Channel-specific metadata      |
| usageCount     | INTEGER         | No       | 0          | Times used                     |
| lastUsedAt     | TIMESTAMPTZ     | Yes      | null       | Last usage timestamp           |
| createdBy      | UUID            | No       | -          | Creator user ID                |
| createdAt      | TIMESTAMPTZ     | No       | now()      | Created timestamp              |
| updatedAt      | TIMESTAMPTZ     | No       | now()      | Updated timestamp              |
| deletedAt      | TIMESTAMPTZ     | Yes      | null       | Soft delete timestamp          |

**Indexes:**
- `idx_templates_tenant_channel` - (tenantId, channel)
- `idx_templates_tenant_status` - (tenantId, status)
- `idx_templates_tenant_category` - (tenantId, category)

**Unique Constraint:** (tenantId, name, channel)

### TemplateVersion Entity

| Column         | Type            | Nullable | Description                    |
|----------------|-----------------|----------|--------------------------------|
| id             | UUID            | No       | Primary key                    |
| tenantId       | VARCHAR         | No       | Tenant identifier              |
| templateId     | UUID            | No       | FK to templates                |
| version        | INTEGER         | No       | Version number                 |
| subject        | VARCHAR(500)    | Yes      | Email subject line             |
| body           | TEXT            | No       | Template body content          |
| bodyHtml       | TEXT            | Yes      | HTML body (email)              |
| bodyPlain      | TEXT            | Yes      | Plain text fallback            |
| previewText    | VARCHAR(255)    | Yes      | Email preview text             |
| variables      | JSONB           | No       | Variables in this version      |
| changelog      | TEXT            | Yes      | Version change notes           |
| createdBy      | UUID            | No       | Version creator                |
| createdAt      | TIMESTAMPTZ     | No       | Created timestamp              |

**Unique Constraint:** (templateId, version)

### TemplateCategory Entity

| Column         | Type            | Nullable | Description                    |
|----------------|-----------------|----------|--------------------------------|
| id             | UUID            | No       | Primary key                    |
| tenantId       | VARCHAR         | No       | Tenant identifier              |
| name           | VARCHAR(100)    | No       | Category name                  |
| slug           | VARCHAR(100)    | No       | URL-safe identifier            |
| description    | TEXT            | Yes      | Category description           |
| parentId       | UUID            | Yes      | Parent category (hierarchical) |
| sortOrder      | INTEGER         | No       | Display order                  |
| createdAt      | TIMESTAMPTZ     | No       | Created timestamp              |

**Unique Constraint:** (tenantId, slug)

### WhatsAppHsmApproval Entity

| Column         | Type            | Nullable | Description                    |
|----------------|-----------------|----------|--------------------------------|
| id             | UUID            | No       | Primary key                    |
| tenantId       | VARCHAR         | No       | Tenant identifier              |
| templateId     | UUID            | No       | FK to templates                |
| hsmNamespace   | VARCHAR(255)    | No       | WhatsApp Business namespace    |
| hsmElementName | VARCHAR(255)    | No       | HSM element name               |
| language       | VARCHAR(10)     | No       | Language code (en, es, etc.)   |
| status         | ENUM            | No       | pending, approved, rejected    |
| rejectionReason| TEXT            | Yes      | Reason if rejected             |
| submittedAt    | TIMESTAMPTZ     | No       | Submission timestamp           |
| reviewedAt     | TIMESTAMPTZ     | Yes      | Review timestamp               |
| expiresAt      | TIMESTAMPTZ     | Yes      | Approval expiration            |

## 4. API Endpoints

### Create Template

```
POST /api/v1/templates
```

**Request Body:**
```json
{
  "name": "Welcome Email",
  "description": "Sent to new users after signup",
  "channel": "email",
  "category": "onboarding",
  "subject": "Welcome to {{company_name}}, {{first_name}}!",
  "body": "<h1>Welcome, {{first_name}}!</h1><p>Thanks for joining {{company_name}}.</p>",
  "bodyPlain": "Welcome, {{first_name}}! Thanks for joining {{company_name}}.",
  "variables": [
    {"name": "first_name", "type": "string", "required": true, "defaultValue": "there"},
    {"name": "company_name", "type": "string", "required": true}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Welcome Email",
    "channel": "email",
    "status": "draft",
    "currentVersion": 1,
    "createdAt": "2026-01-27T10:00:00Z"
  }
}
```

### List Templates

```
GET /api/v1/templates
```

**Query Parameters:**
| Parameter  | Type    | Default | Description                    |
|------------|---------|---------|--------------------------------|
| page       | number  | 1       | Page number                    |
| pageSize   | number  | 20      | Items per page                 |
| channel    | string  | -       | Filter by channel              |
| category   | string  | -       | Filter by category             |
| status     | string  | -       | Filter by status               |
| search     | string  | -       | Search by name                 |

### Get Template

```
GET /api/v1/templates/:id
```

### Get Template Version

```
GET /api/v1/templates/:id/versions/:version
```

### List Template Versions

```
GET /api/v1/templates/:id/versions
```

### Update Template (Creates New Version)

```
PUT /api/v1/templates/:id
```

**Request Body:**
```json
{
  "subject": "Welcome aboard, {{first_name}}!",
  "body": "<h1>Welcome aboard, {{first_name}}!</h1><p>We're excited to have you at {{company_name}}.</p>",
  "changelog": "Updated greeting to be more enthusiastic"
}
```

### Activate Template

```
POST /api/v1/templates/:id/activate
```

### Archive Template

```
POST /api/v1/templates/:id/archive
```

### Delete Template

```
DELETE /api/v1/templates/:id
```

### Render Template (Preview)

```
POST /api/v1/templates/:id/render
```

**Request Body:**
```json
{
  "context": {
    "first_name": "John",
    "company_name": "Acme Corp"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subject": "Welcome to Acme Corp, John!",
    "body": "<h1>Welcome, John!</h1><p>Thanks for joining Acme Corp.</p>",
    "bodyPlain": "Welcome, John! Thanks for joining Acme Corp."
  }
}
```

### Submit WhatsApp HSM for Approval

```
POST /api/v1/templates/:id/whatsapp/submit
```

**Request Body:**
```json
{
  "hsmNamespace": "acme_corp",
  "hsmElementName": "welcome_message",
  "language": "en"
}
```

### Get WhatsApp HSM Status

```
GET /api/v1/templates/:id/whatsapp/status
```

### Clone Template

```
POST /api/v1/templates/:id/clone
```

**Request Body:**
```json
{
  "name": "Welcome Email v2",
  "channel": "email"
}
```

## 5. Event Bus (NATS JetStream)

### Published Events

| Subject               | Event Type                | Trigger                       |
|-----------------------|---------------------------|-------------------------------|
| `template.created`    | TemplateCreatedEvent      | New template created          |
| `template.updated`    | TemplateUpdatedEvent      | New version created           |
| `template.activated`  | TemplateActivatedEvent    | Template set to active        |
| `template.archived`   | TemplateArchivedEvent     | Template archived             |
| `template.deleted`    | TemplateDeletedEvent      | Template deleted              |
| `template.hsm.submitted` | HsmSubmittedEvent      | WhatsApp HSM submitted        |
| `template.hsm.approved`  | HsmApprovedEvent        | WhatsApp HSM approved         |
| `template.hsm.rejected`  | HsmRejectedEvent        | WhatsApp HSM rejected         |

### Event Schema

```typescript
interface TemplateUpdatedEvent {
  version: string;
  source: string;
  tenantId: string;
  correlationId: string;
  timestamp: string;
  data: {
    templateId: string;
    channel: string;
    newVersion: number;
    previousVersion: number;
    changelog?: string;
  };
}
```

## 6. Logging

```typescript
// Template creation
this.logger.log('[START] createTemplate', {
  tenantId,
  correlationId,
  operation: 'createTemplate',
  templateName: dto.name,
  channel: dto.channel,
});

// Template render
this.logger.log('[RENDER] template', {
  tenantId,
  correlationId,
  templateId,
  version,
  variableCount: Object.keys(context).length,
});
```

## 7. Background Jobs

This module does not have scheduled background jobs. WhatsApp HSM status updates are triggered by webhook callbacks.

## 8. Integration Scenarios

### Scenario 1: Campaign Uses Template

```
1. Campaign references templateId
2. CampaignSenderService calls TemplatesService.getActiveVersion(templateId)
3. For each recipient, calls TemplateRenderService.render(template, contactData)
4. Rendered content passed to channel sender
5. TemplatesService.incrementUsageCount(templateId)
```

### Scenario 2: Template Versioning

```
1. PUT /api/v1/templates/:id with updated content
2. TemplatesService creates new TemplateVersion
3. Does NOT update currentVersion (requires explicit activation)
4. User reviews version via GET /versions/:version
5. POST /templates/:id/activate sets currentVersion
6. All new sends use new version; in-flight campaigns continue with old
```

### Scenario 3: WhatsApp HSM Workflow

```
1. Create template with channel='whatsapp'
2. POST /templates/:id/whatsapp/submit
3. System submits to WhatsApp Business API
4. WhatsAppHsmApproval record created with status='pending'
5. Webhook callback updates status to 'approved' or 'rejected'
6. Event published for notification
```

## 9. Known Limitations

1. **No Template Inheritance**: Templates cannot extend base templates.
2. **Variable Validation**: Variables are not strictly validated against schema during render.
3. **No A/B Testing**: Single template per use case; no built-in variant testing.
4. **WhatsApp Approval Delays**: HSM approval can take 24-48 hours.

## 10. Future Extensions

- [ ] Template inheritance and base templates
- [ ] A/B testing with variant selection
- [ ] Template analytics dashboard
- [ ] AI-powered template suggestions
- [ ] Template library/marketplace
- [ ] Rich text editor integration
- [ ] Image and attachment management
- [ ] Template localization with i18n support
