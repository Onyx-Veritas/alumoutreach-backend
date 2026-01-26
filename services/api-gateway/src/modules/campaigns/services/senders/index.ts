// Re-export the common SendResult interface only from email.sender (others use the same)
export { SendResult, EmailSenderService } from './email.sender';
export { SmsSenderService } from './sms.sender';
export { WhatsAppSenderService } from './whatsapp.sender';
export { PushSenderService } from './push.sender';
