// ============ Template Enums ============

export enum TemplateChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
  RCS = 'rcs',
}

export enum TemplateCategory {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  LIFECYCLE = 'lifecycle',
  COMPLIANCE = 'compliance',
  NOTIFICATION = 'notification',
  REMINDER = 'reminder',
}

export enum ApprovalStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum TemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}
