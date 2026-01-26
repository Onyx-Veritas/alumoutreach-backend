export interface ITenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  domain?: string;
  settings: ITenantSettings;
  features: ITenantFeatures;
  plan: TenantPlan;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITenantSettings {
  timezone: string;
  dateFormat: string;
  defaultLanguage: string;
  emailFromName?: string;
  emailFromAddress?: string;
  whatsappBusinessId?: string;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  brandColors?: {
    primary: string;
    secondary: string;
  };
}

export interface ITenantFeatures {
  maxContacts: number;
  maxUsers: number;
  maxMonthlyMessages: number;
  enableWhatsapp: boolean;
  enableSms: boolean;
  enableRcs: boolean;
  enableWorkflows: boolean;
  enableSequences: boolean;
  enableAiFeatures: boolean;
  enableAdvancedAnalytics: boolean;
}

export enum TenantPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}
