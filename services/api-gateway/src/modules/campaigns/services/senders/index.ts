// Re-export the common interfaces and services
export { SendResult, SendRequest, EmailSenderService } from './email.sender';
export { SmsSendRequest, SmsSenderService } from './sms.sender';
export { WhatsAppSendRequest, WhatsAppSenderService } from './whatsapp.sender';
export { PushSendRequest, PushSenderService } from './push.sender';
