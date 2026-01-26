export const CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  RCS: 'rcs',
  PUSH: 'push',
  IN_APP: 'in_app',
} as const;

export type ChannelType = typeof CHANNELS[keyof typeof CHANNELS];

export const CHANNEL_PRIORITIES = {
  [CHANNELS.WHATSAPP]: 1,
  [CHANNELS.EMAIL]: 2,
  [CHANNELS.SMS]: 3,
  [CHANNELS.RCS]: 4,
  [CHANNELS.PUSH]: 5,
  [CHANNELS.IN_APP]: 6,
} as const;

export const CHANNEL_LABELS = {
  [CHANNELS.EMAIL]: 'Email',
  [CHANNELS.SMS]: 'SMS',
  [CHANNELS.WHATSAPP]: 'WhatsApp',
  [CHANNELS.RCS]: 'RCS',
  [CHANNELS.PUSH]: 'Push Notification',
  [CHANNELS.IN_APP]: 'In-App',
} as const;
