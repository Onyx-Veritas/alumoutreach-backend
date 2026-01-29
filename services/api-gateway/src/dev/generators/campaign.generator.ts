import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export interface GenerateCampaignsOptions {
  count: number;
  tenantId: string;
  channels?: ('email' | 'sms' | 'whatsapp' | 'push')[];
  statuses?: ('draft' | 'scheduled' | 'running' | 'paused' | 'completed')[];
  withSchedule?: boolean;
}

export interface GeneratedCampaign {
  name: string;
  description: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  subject?: string;
  previewText?: string;
  scheduleAt?: string;
  settings?: CampaignSettings;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CampaignSettings {
  sendingSpeed?: 'immediate' | 'throttled';
  throttleRate?: number;
  trackOpens?: boolean;
  trackClicks?: boolean;
  timezone?: string;
}

@Injectable()
export class CampaignGenerator {
  private readonly campaignNameTemplates = [
    '{month} Newsletter',
    'Annual Giving Campaign',
    'Event Invitation: {event}',
    'Alumni Spotlight: {month}',
    'Career Networking Update',
    'Homecoming {year}',
    'Donation Drive',
    'Welcome New Graduates',
    'Reunion Class Update',
    'Industry Insights',
    'Mentorship Program Launch',
    'Volunteer Appreciation',
  ];

  private readonly eventNames = [
    'Career Fair 2026',
    'Alumni Gala',
    'Networking Mixer',
    'Homecoming Weekend',
    'Graduation Ceremony',
    'Industry Panel',
    'Mentorship Kickoff',
    'Regional Meetup',
  ];

  private readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  private readonly emailSubjects = [
    'You\'re Invited: {event}',
    'Important Update for {name}',
    'This Month\'s Alumni News',
    'Don\'t Miss Out: {event}',
    'Thank You for Your Support',
    'Your Impact Matters',
    'Join Us for {event}',
    'A Special Message from the Dean',
  ];

  /**
   * Generate a batch of campaigns
   */
  generate(options: GenerateCampaignsOptions): GeneratedCampaign[] {
    const campaigns: GeneratedCampaign[] = [];
    const channels = options.channels || ['email', 'sms', 'whatsapp', 'push'];
    const statuses = options.statuses || ['draft', 'scheduled'];

    for (let i = 0; i < options.count; i++) {
      campaigns.push(this.generateSingle(options, channels, statuses, i));
    }

    return campaigns;
  }

  /**
   * Generate a single campaign
   */
  private generateSingle(
    options: GenerateCampaignsOptions,
    channels: ('email' | 'sms' | 'whatsapp' | 'push')[],
    statuses: ('draft' | 'scheduled' | 'running' | 'paused' | 'completed')[],
    index: number,
  ): GeneratedCampaign {
    const channel = faker.helpers.arrayElement(channels);
    const status = faker.helpers.arrayElement(statuses);
    const name = this.generateCampaignName(index);

    const campaign: GeneratedCampaign = {
      name,
      description: this.generateDescription(name, channel),
      channel,
      status,
      tags: this.generateTags(channel),
    };

    // Email-specific fields
    if (channel === 'email') {
      campaign.subject = this.generateEmailSubject();
      campaign.previewText = faker.lorem.sentence();
    }

    // Schedule for non-draft campaigns
    if (status !== 'draft' && options.withSchedule !== false) {
      campaign.scheduleAt = this.generateScheduleDate(status);
    }

    // Campaign settings
    campaign.settings = this.generateSettings(channel);

    // Random metadata
    if (faker.datatype.boolean(0.4)) {
      campaign.metadata = {
        createdBy: 'dev-playground',
        purpose: faker.helpers.arrayElement(['engagement', 'fundraising', 'awareness', 'retention']),
        targetAudience: faker.helpers.arrayElement(['all-alumni', 'recent-grads', 'donors', 'volunteers']),
        budget: faker.number.int({ min: 1000, max: 50000 }),
      };
    }

    return campaign;
  }

  /**
   * Generate campaign name from template
   */
  private generateCampaignName(index: number): string {
    const template = faker.helpers.arrayElement(this.campaignNameTemplates);
    
    return template
      .replace('{month}', faker.helpers.arrayElement(this.months))
      .replace('{year}', '2026')
      .replace('{event}', faker.helpers.arrayElement(this.eventNames))
      + (index > 0 ? ` (${index + 1})` : '');
  }

  /**
   * Generate description
   */
  private generateDescription(name: string, channel: string): string {
    const templates = [
      `${channel.toUpperCase()} campaign: ${name}`,
      `Outreach campaign via ${channel} - ${name}`,
      `Auto-generated ${channel} campaign for testing`,
      `${name} - targeting alumni via ${channel}`,
    ];
    return faker.helpers.arrayElement(templates);
  }

  /**
   * Generate email subject line
   */
  private generateEmailSubject(): string {
    const template = faker.helpers.arrayElement(this.emailSubjects);
    
    return template
      .replace('{event}', faker.helpers.arrayElement(this.eventNames))
      .replace('{name}', faker.person.firstName());
  }

  /**
   * Generate schedule date based on status
   */
  private generateScheduleDate(status: string): string {
    switch (status) {
      case 'scheduled':
        // Future date
        return faker.date.future({ years: 0.5 }).toISOString();
      case 'running':
        // Recent past (started recently)
        return faker.date.recent({ days: 7 }).toISOString();
      case 'completed':
        // Past date
        return faker.date.past({ years: 0.5 }).toISOString();
      case 'paused':
        // Recent past
        return faker.date.recent({ days: 14 }).toISOString();
      default:
        return new Date().toISOString();
    }
  }

  /**
   * Generate campaign settings
   */
  private generateSettings(channel: string): CampaignSettings {
    const settings: CampaignSettings = {
      sendingSpeed: faker.helpers.arrayElement(['immediate', 'throttled']),
      timezone: faker.helpers.arrayElement(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'UTC']),
    };

    if (settings.sendingSpeed === 'throttled') {
      settings.throttleRate = faker.helpers.arrayElement([100, 500, 1000, 5000]);
    }

    if (channel === 'email') {
      settings.trackOpens = faker.datatype.boolean(0.9);
      settings.trackClicks = faker.datatype.boolean(0.9);
    }

    return settings;
  }

  /**
   * Generate tags for campaign
   */
  private generateTags(channel: string): string[] {
    const allTags = [channel, 'outreach', 'engagement', 'fundraising', 'newsletter', 'event', 'automated'];
    const count = faker.number.int({ min: 1, max: 4 });
    return faker.helpers.arrayElements(allTags, count);
  }
}
