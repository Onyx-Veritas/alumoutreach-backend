import { randomBytes } from 'crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 21;

export function generateId(prefix?: string): string {
  const bytes = randomBytes(ID_LENGTH);
  let id = '';
  
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  
  return prefix ? `${prefix}_${id}` : id;
}

export function generateContactId(): string {
  return generateId('con');
}

export function generateTemplateId(): string {
  return generateId('tpl');
}

export function generateSegmentId(): string {
  return generateId('seg');
}

export function generateCampaignId(): string {
  return generateId('cmp');
}

export function generateWorkflowId(): string {
  return generateId('wfl');
}

export function generateSequenceId(): string {
  return generateId('seq');
}

export function generateMessageId(): string {
  return generateId('msg');
}

export function generateConversationId(): string {
  return generateId('cnv');
}

export function generateExecutionId(): string {
  return generateId('exe');
}
