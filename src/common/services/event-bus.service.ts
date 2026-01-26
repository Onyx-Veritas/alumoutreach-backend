import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, StringCodec, JetStreamClient, JetStreamManager } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { AppLoggerService } from '../logger/app-logger.service';
import { BaseEvent, ContactEvent, ContactEventType } from '../events/contact.events';

const STREAM_NAME = 'ALUMOUTREACH';
const CONTACT_SUBJECT_PREFIX = 'alumoutreach.contacts';

@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection | null = null;
  private jetStream: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private readonly sc = StringCodec();
  private readonly logger: AppLoggerService;
  private isConnected = false;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('EventBusService');
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    const startTime = this.logger.logOperationStart('connect to NATS', { url: natsUrl });

    try {
      this.connection = await connect({
        servers: natsUrl,
        name: 'alumoutreach-api-gateway',
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 2000,
      });

      this.jetStream = this.connection.jetstream();
      this.jsm = await this.connection.jetstreamManager();

      // Ensure stream exists
      await this.ensureStream();

      this.isConnected = true;
      this.logger.logOperationEnd('connect to NATS', startTime);
      this.logger.info('Connected to NATS JetStream', { url: natsUrl });

      // Handle connection events
      (async () => {
        if (this.connection) {
          for await (const status of this.connection.status()) {
            this.logger.info(`NATS connection status: ${status.type}`, {
              data: status.data?.toString(),
            });
          }
        }
      })();
    } catch (error) {
      this.logger.logOperationError('connect to NATS', error as Error);
      this.logger.warn('NATS connection failed, running in offline mode');
      this.isConnected = false;
    }
  }

  private async ensureStream(): Promise<void> {
    if (!this.jsm) return;

    try {
      await this.jsm.streams.info(STREAM_NAME);
      this.logger.debug('Stream already exists', { stream: STREAM_NAME });
    } catch {
      // Stream doesn't exist, create it
      await this.jsm.streams.add({
        name: STREAM_NAME,
        subjects: [`${CONTACT_SUBJECT_PREFIX}.>`],
        retention: 'limits' as never,
        max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
        max_msgs: 1000000,
        storage: 'file' as never,
        discard: 'old' as never,
      });
      this.logger.info('Created JetStream stream', { stream: STREAM_NAME });
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jetStream = null;
      this.isConnected = false;
      this.logger.info('Disconnected from NATS');
    }
  }

  async publish<T extends BaseEvent>(
    subject: string,
    event: T,
    options?: { correlationId?: string; tenantId?: string },
  ): Promise<void> {
    const correlationId = options?.correlationId || event.correlationId || uuidv4();
    const eventId = event.eventId || uuidv4();

    const enrichedEvent: T = {
      ...event,
      eventId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
    };

    const startTime = this.logger.logOperationStart('publish event', {
      subject,
      eventType: event.eventType,
      correlationId,
      tenantId: options?.tenantId || event.tenantId,
    });

    try {
      if (!this.isConnected || !this.jetStream) {
        this.logger.warn('NATS not connected, event not published', {
          subject,
          eventType: event.eventType,
        });
        return;
      }

      const payload = JSON.stringify(enrichedEvent);
      await this.jetStream.publish(subject, this.sc.encode(payload));

      this.logger.logEventPublish(event.eventType, correlationId, {
        tenantId: event.tenantId,
        subject,
        payloadSize: payload.length,
      });
      this.logger.logOperationEnd('publish event', startTime);
    } catch (error) {
      this.logger.logOperationError('publish event', error as Error, {
        subject,
        eventType: event.eventType,
        correlationId,
      });
      // Don't throw - event publishing should not break the main flow
    }
  }

  // Convenience methods for contact events
  async publishContactCreated(
    tenantId: string,
    payload: { contactId: string; fullName: string; email?: string; phone?: string; createdBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.created`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_CREATED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactUpdated(
    tenantId: string,
    payload: { contactId: string; changes: Record<string, { old: unknown; new: unknown }>; updatedBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.updated`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_UPDATED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactDeleted(
    tenantId: string,
    payload: { contactId: string; deletedBy?: string; hardDelete: boolean },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.deleted`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_DELETED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactAttributeUpdated(
    tenantId: string,
    payload: { contactId: string; key: string; value: string; previousValue?: string; updatedBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.attribute.updated`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_ATTRIBUTE_UPDATED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactConsentUpdated(
    tenantId: string,
    payload: { contactId: string; channel: string; status: string; previousStatus?: string; source: string; updatedBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.consent.updated`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_CONSENT_UPDATED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactTagAdded(
    tenantId: string,
    payload: { contactId: string; tagId: string; tagName: string; addedBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.tag.added`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_TAG_ADDED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }

  async publishContactTagRemoved(
    tenantId: string,
    payload: { contactId: string; tagId: string; tagName: string; removedBy?: string },
    correlationId: string,
  ): Promise<void> {
    await this.publish(`${CONTACT_SUBJECT_PREFIX}.tag.removed`, {
      eventId: uuidv4(),
      eventType: ContactEventType.CONTACT_TAG_REMOVED,
      tenantId,
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'api-gateway',
      payload,
    } as ContactEvent);
  }
}
