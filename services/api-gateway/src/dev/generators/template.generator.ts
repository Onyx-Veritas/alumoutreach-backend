import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export type TemplateChannel = 'email' | 'sms' | 'whatsapp' | 'push';
export type TemplateCategory = 'transactional' | 'marketing' | 'lifecycle' | 'compliance' | 'notification' | 'reminder';

export interface GenerateTemplatesOptions {
  count: number;
  tenantId: string;
  channels?: TemplateChannel[];
  categories?: TemplateCategory[];
}

export interface GeneratedTemplate {
  name: string;
  description: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  content: EmailContent | SmsContent | WhatsAppContent | PushContent;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody?: string;
  preheader?: string;
}

export interface SmsContent {
  body: string;
  senderId?: string;
}

export interface WhatsAppContent {
  templateName: string;
  language: string;
  body: string;
}

export interface PushContent {
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
}

@Injectable()
export class TemplateGenerator {
  private readonly emailTemplateNames = [
    'Welcome Email',
    'Password Reset',
    'Event Invitation',
    'Newsletter - Monthly',
    'Donation Thank You',
    'Alumni Spotlight',
    'Job Alert Notification',
    'Reunion Announcement',
    'Graduation Congratulations',
    'Survey Request',
    'Membership Renewal',
    'Volunteer Opportunity',
    'Career Workshop Invite',
    'Homecoming Update',
    'Annual Fund Appeal',
  ];

  private readonly smsTemplateNames = [
    'Event Reminder',
    'Registration Confirmation',
    'Donation Receipt',
    'Appointment Reminder',
    'Quick Survey',
    'Payment Confirmation',
    'Shipping Update',
    'Account Verification',
  ];

  private readonly whatsappTemplateNames = [
    'Welcome Message',
    'Booking Confirmation',
    'Status Update',
    'Support Response',
    'Feedback Request',
    'Appointment Reminder',
  ];

  private readonly pushTemplateNames = [
    'New Event Alert',
    'Message Notification',
    'Special Offer',
    'Reminder',
    'Achievement Unlocked',
    'Breaking News',
  ];

  private readonly tags = [
    'welcome', 'transactional', 'marketing', 'newsletter', 'event',
    'donation', 'reminder', 'survey', 'announcement', 'notification',
    'alumni', 'engagement', 'onboarding', 'retention',
  ];

  private readonly categories: TemplateCategory[] = [
    'transactional', 'marketing', 'lifecycle', 'compliance', 'notification', 'reminder',
  ];

  /**
   * Generate a batch of templates
   */
  generate(options: GenerateTemplatesOptions): GeneratedTemplate[] {
    const templates: GeneratedTemplate[] = [];
    const channels = options.channels || ['email', 'sms', 'whatsapp', 'push'];
    const categories = options.categories || this.categories;

    for (let i = 0; i < options.count; i++) {
      const channel = faker.helpers.arrayElement(channels);
      templates.push(this.generateSingle(channel, categories, i));
    }

    return templates;
  }

  /**
   * Generate a single template
   */
  private generateSingle(
    channel: TemplateChannel,
    categories: TemplateCategory[],
    index: number,
  ): GeneratedTemplate {
    const category = faker.helpers.arrayElement(categories);
    const name = this.generateName(channel, index);
    
    return {
      name,
      description: this.generateDescription(channel, name),
      channel,
      category,
      content: this.generateContent(channel, name),
      tags: this.generateTags(channel, category),
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'dev-playground',
        index,
      },
    };
  }

  /**
   * Generate template name based on channel
   */
  private generateName(channel: TemplateChannel, index: number): string {
    const suffix = `_${Date.now().toString(36)}_${index}`;
    
    switch (channel) {
      case 'email':
        return faker.helpers.arrayElement(this.emailTemplateNames) + suffix;
      case 'sms':
        return faker.helpers.arrayElement(this.smsTemplateNames) + suffix;
      case 'whatsapp':
        return faker.helpers.arrayElement(this.whatsappTemplateNames) + suffix;
      case 'push':
        return faker.helpers.arrayElement(this.pushTemplateNames) + suffix;
      default:
        return `Template ${channel} ${suffix}`;
    }
  }

  /**
   * Generate description
   */
  private generateDescription(channel: TemplateChannel, name: string): string {
    const descriptions: Record<string, string[]> = {
      email: [
        'Standard email template for alumni communications',
        'Responsive HTML email designed for engagement',
        'Professional template with university branding',
        'Automated email for lifecycle communications',
      ],
      sms: [
        'Concise SMS message for quick updates',
        'Time-sensitive notification template',
        'Transactional SMS with tracking link',
      ],
      whatsapp: [
        'WhatsApp Business API approved template',
        'Conversational template for direct engagement',
        'Interactive message with quick reply buttons',
      ],
      push: [
        'Mobile push notification for instant alerts',
        'Rich push notification with image support',
        'Action-driven notification template',
      ],
    };

    return faker.helpers.arrayElement(descriptions[channel] || descriptions.email);
  }

  /**
   * Generate content based on channel
   */
  private generateContent(channel: TemplateChannel, name: string): EmailContent | SmsContent | WhatsAppContent | PushContent {
    switch (channel) {
      case 'email':
        return this.generateEmailContent(name);
      case 'sms':
        return this.generateSmsContent(name);
      case 'whatsapp':
        return this.generateWhatsAppContent(name);
      case 'push':
        return this.generatePushContent(name);
      default:
        return this.generateEmailContent(name);
    }
  }

  /**
   * Generate email content
   */
  private generateEmailContent(name: string): EmailContent {
    const firstName = '{{contact.firstName}}';
    const lastName = '{{contact.lastName}}';
    const universityName = 'State University';

    const subjects = [
      `${name} - Important Update`,
      `Your ${universityName} Update`,
      `Hello ${firstName}, we have news for you!`,
      `[${universityName}] ${name}`,
      `Don't miss this, ${firstName}!`,
    ];

    return {
      subject: faker.helpers.arrayElement(subjects),
      preheader: faker.lorem.sentence(),
      htmlBody: this.generateEmailHtml(firstName, lastName, name),
      textBody: this.generateEmailText(firstName, lastName, name),
    };
  }

  /**
   * Generate HTML email body
   */
  private generateEmailHtml(firstName: string, lastName: string, templateName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${templateName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background: #ffffff; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>State University</h1>
    </div>
    <div class="content">
      <p>Dear ${firstName} ${lastName},</p>
      <p>${faker.lorem.paragraphs(2)}</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{actionUrl}}" class="button">Learn More</a>
      </p>
      <p>${faker.lorem.paragraph()}</p>
      <p>Best regards,<br>The Alumni Relations Team</p>
    </div>
    <div class="footer">
      <p>State University Alumni Association</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{preferencesUrl}}">Update Preferences</a></p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email body
   */
  private generateEmailText(firstName: string, lastName: string, templateName: string): string {
    return `Dear ${firstName} ${lastName},

${faker.lorem.paragraphs(2)}

Learn More: {{actionUrl}}

${faker.lorem.paragraph()}

Best regards,
The Alumni Relations Team

---
State University Alumni Association
Unsubscribe: {{unsubscribeUrl}}`;
  }

  /**
   * Generate SMS content
   */
  private generateSmsContent(name: string): SmsContent {
    const templates = [
      'Hi {{contact.firstName}}, reminder: {{eventName}} is tomorrow at {{eventTime}}. Reply YES to confirm. Txt STOP to opt out.',
      '{{contact.firstName}}, your registration for {{eventName}} is confirmed! Details: {{eventUrl}}',
      'Thank you {{contact.firstName}}! Your donation of ${{amount}} was received. Tax receipt: {{receiptUrl}}',
      '{{contact.firstName}}, don\'t miss our upcoming {{eventName}}! RSVP: {{eventUrl}}',
      'Hi {{contact.firstName}}, quick survey: How was your experience? Reply 1-5 or visit {{surveyUrl}}',
    ];

    return {
      body: faker.helpers.arrayElement(templates),
      senderId: 'STATEUNI',
    };
  }

  /**
   * Generate WhatsApp content
   */
  private generateWhatsAppContent(name: string): WhatsAppContent {
    const templateName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
    
    const bodies = [
      'Hello {{1}}! Welcome to State University Alumni Network. We\'re excited to have you! Reply to this message to connect with our team.',
      'Hi {{1}}, your booking for {{2}} on {{3}} is confirmed. Reference: {{4}}. Reply if you need to make changes.',
      'Hello {{1}}, here\'s an update on your request: {{2}}. Our team is here to help!',
      'Hi {{1}}, we\'d love your feedback! How would you rate your recent experience? Tap below to let us know.',
    ];

    return {
      templateName,
      language: 'en',
      body: faker.helpers.arrayElement(bodies),
    };
  }

  /**
   * Generate Push notification content
   */
  private generatePushContent(name: string): PushContent {
    const titles = [
      '🎉 New Event Alert!',
      '📬 You have a new message',
      '🎁 Special offer just for you',
      '⏰ Reminder',
      '🏆 Achievement Unlocked!',
      '📰 Breaking News',
    ];

    const bodies = [
      'Don\'t miss our upcoming {{eventName}}! Tap to RSVP.',
      '{{senderName}} sent you a message. Tap to read.',
      'Exclusive {{discountPercent}}% off for alumni members. Limited time!',
      '{{eventName}} starts in {{timeUntil}}. Be there!',
      'Congratulations! You\'ve earned the {{badgeName}} badge.',
      '{{headline}} - Tap to read the full story.',
    ];

    return {
      title: faker.helpers.arrayElement(titles),
      body: faker.helpers.arrayElement(bodies),
      imageUrl: faker.datatype.boolean() ? 'https://via.placeholder.com/400x200' : undefined,
      actionUrl: '{{deepLinkUrl}}',
    };
  }

  /**
   * Generate tags for template
   */
  private generateTags(channel: TemplateChannel, category: TemplateCategory): string[] {
    const baseTags = [channel, category];
    const additionalTags = faker.helpers.arrayElements(this.tags, faker.number.int({ min: 1, max: 3 }));
    return [...new Set([...baseTags, ...additionalTags])];
  }
}
