import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ContactGenerator } from '../generators/contact.generator';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { InboxThreadRepository } from '../../modules/inbox/repositories/inbox-thread.repository';
import { InboxMessageRepository } from '../../modules/inbox/repositories/inbox-message.repository';
import { InboxChannel, ThreadStatus, MessageDirection, MessageDeliveryStatus } from '../../modules/inbox/entities/inbox.enums';
import { SYSTEM_USER_ID } from '../../common/constants/system';
import { faker } from '@faker-js/faker';

export interface InboxFlowResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: {
    contactsCreated: number;
    threadsCreated: number;
    messagesCreated: number;
    channels: string[];
  };
  errors?: string[];
}

@Injectable()
export class InboxFlowScenario {
  private readonly logger = new Logger(InboxFlowScenario.name);

  constructor(
    private readonly contactGenerator: ContactGenerator,
    private readonly contactsService: ContactsService,
    private readonly threadRepo: InboxThreadRepository,
    private readonly messageRepo: InboxMessageRepository,
  ) {}

  /**
   * Run the inbox flow scenario:
   * 1. Create contacts
   * 2. Create inbox threads for each contact
   * 3. Add messages to threads (simulating conversations)
   */
  async run(tenantId: string, options: {
    contactCount?: number;
    messagesPerThread?: number;
    channels?: ('email' | 'sms' | 'whatsapp')[];
    correlationId?: string;
  } = {}): Promise<InboxFlowResult> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `scenario-${Date.now()}`;
    const contactCount = options.contactCount || 10;
    const messagesPerThread = options.messagesPerThread || 5;
    const channels = options.channels || ['email', 'sms', 'whatsapp'];
    const errors: string[] = [];

    this.logger.log(`Starting inbox-flow scenario`, { tenantId, contactCount, messagesPerThread, correlationId });

    let contactsCreated = 0;
    let threadsCreated = 0;
    let messagesCreated = 0;
    const usedChannels = new Set<string>();

    try {
      // Step 1: Generate and create contacts
      this.logger.debug('Step 1: Generating contacts...');
      const generatedContacts = this.contactGenerator.generate({
        count: contactCount,
        tenantId,
        withPhone: true,
        withWhatsapp: true,
      });

      for (const contactData of generatedContacts) {
        try {
          const contact = await this.contactsService.create(
            tenantId,
            contactData as any,
            SYSTEM_USER_ID,
            correlationId,
          );
          contactsCreated++;

          // Step 2: Create a thread for this contact
          const channel = faker.helpers.arrayElement(channels);
          usedChannels.add(channel);

          const thread = await this.createThread(tenantId, contact.id, channel as InboxChannel);
          if (thread) {
            threadsCreated++;

            // Step 3: Add messages to the thread
            const messageCount = await this.addMessagesToThread(
              tenantId,
              thread.id,
              contact.id,
              channel as InboxChannel,
              messagesPerThread,
            );
            messagesCreated += messageCount;
          }
        } catch (error) {
          errors.push(`Failed to process contact ${contactData.email}: ${(error as Error).message}`);
        }
      }

      this.logger.debug(`Created ${contactsCreated} contacts, ${threadsCreated} threads, ${messagesCreated} messages`);

    } catch (error) {
      this.logger.error('Scenario failed', error);
      errors.push(`Scenario error: ${(error as Error).message}`);
    }

    const duration = Date.now() - startTime;

    return {
      scenario: 'inbox-flow',
      success: errors.length === 0,
      duration,
      summary: {
        contactsCreated,
        threadsCreated,
        messagesCreated,
        channels: Array.from(usedChannels),
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create an inbox thread for a contact using repository
   */
  private async createThread(
    tenantId: string,
    contactId: string,
    channel: InboxChannel,
  ): Promise<{ id: string } | null> {
    try {
      const thread = await this.threadRepo.create({
        id: uuidv4(),
        tenantId,
        contactId,
        channel,
        status: ThreadStatus.OPEN,
        messageCount: 0,
        unreadCount: 0,
        lastMessageAt: new Date(),
        metadata: {},
      });
      
      return { id: thread.id };
    } catch (error) {
      this.logger.warn(`Failed to create thread: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Add simulated messages to a thread using repository
   */
  private async addMessagesToThread(
    tenantId: string,
    threadId: string,
    contactId: string,
    channel: InboxChannel,
    count: number,
  ): Promise<number> {
    let created = 0;

    for (let i = 0; i < count; i++) {
      try {
        const isInbound = faker.datatype.boolean(0.4); // 40% inbound messages
        const direction = isInbound ? MessageDirection.INBOUND : MessageDirection.OUTBOUND;
        
        await this.messageRepo.create({
          id: uuidv4(),
          tenantId,
          threadId,
          contactId,
          channel,
          direction,
          content: this.generateMessageContent(channel, isInbound),
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          sentAt: new Date(Date.now() - (count - i) * 3600000), // Stagger messages by 1 hour
          deliveredAt: isInbound ? undefined : new Date(Date.now() - (count - i) * 3600000 + 60000),
          metadata: {},
        });
        
        created++;
      } catch (error) {
        this.logger.warn(`Failed to add message to thread: ${(error as Error).message}`);
      }
    }

    return created;
  }

  /**
   * Generate realistic message content
   */
  private generateMessageContent(channel: InboxChannel, isInbound: boolean): string {
    if (channel === InboxChannel.SMS) {
      // Shorter messages for SMS
      const smsMessages = isInbound
        ? [
            'Hi, is this about the alumni event?',
            'Thanks for reaching out!',
            'Can you send me more info?',
            'I\'m interested in volunteering',
            'When is the deadline?',
          ]
        : [
            'Welcome! How can we help?',
            'Thanks for your interest!',
            'Here\'s the link to register: [link]',
            'We\'ll follow up shortly.',
            'Let us know if you have questions.',
          ];
      return faker.helpers.arrayElement(smsMessages);
    }

    // Longer messages for email/whatsapp
    if (isInbound) {
      return faker.helpers.arrayElement([
        `Hi there,\n\n${faker.lorem.paragraph()}\n\nBest regards,\n${faker.person.firstName()}`,
        `Hello,\n\nI wanted to ask about ${faker.lorem.sentence()}\n\nThanks!`,
        `Good morning,\n\n${faker.lorem.sentences(2)}\n\nLooking forward to hearing from you.`,
      ]);
    } else {
      return faker.helpers.arrayElement([
        `Dear Alumni,\n\n${faker.lorem.paragraph()}\n\nBest regards,\nAlumni Relations`,
        `Thank you for reaching out!\n\n${faker.lorem.sentences(2)}\n\nWarm regards,\nThe Alumni Team`,
        `Hello!\n\n${faker.lorem.paragraph()}\n\nLet us know if you have any questions.`,
      ]);
    }
  }
}
