export enum Channel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  RCS = 'rcs',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export interface IChannelConfig {
  channel: Channel;
  providerId: string;
  credentials: Record<string, any>;
  isActive: boolean;
  settings?: Record<string, any>;
}

export interface IMessagePayload {
  channel: Channel;
  to: string;
  templateId?: string;
  variables?: Record<string, any>;
  content?: {
    subject?: string;
    body: string;
    attachments?: IAttachment[];
  };
  metadata?: Record<string, any>;
}

export interface IAttachment {
  filename: string;
  url: string;
  mimeType: string;
  size?: number;
}

export interface IMessageResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: {
    code: string;
    message: string;
  };
  sentAt: Date;
}

export interface IDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  timestamp: Date;
  metadata?: Record<string, any>;
}
